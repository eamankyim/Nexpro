const { Op } = require('sequelize');
const { SystemHealthIssue, DeliveryEvent, InviteToken, Tenant } = require('../models');
const { isCriticalDeliveryError } = require('./deliveryEventService');
const { getFrontendBaseUrlFromEnv } = require('../utils/frontendUrl');

const NOTIFY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * Build a stable fingerprint for deduping health issues.
 * @param {{ channel: string, provider?: string|null, errorCode?: string|null, tenantId?: string|null }} parts
 * @returns {string}
 */
function buildFingerprint({ channel, provider, errorCode, tenantId }) {
  const parts = [
    String(channel || 'unknown').toLowerCase(),
    String(provider || 'unknown').toLowerCase(),
    String(errorCode || 'DELIVERY_FAILED').toUpperCase(),
    tenantId || 'platform',
  ];
  return parts.join(':').slice(0, 255);
}

/**
 * Human-readable title/summary for a delivery failure.
 * @param {object} input
 */
function describeDeliveryFailure(input) {
  const channel = String(input.channel || 'api').toLowerCase();
  const code = String(input.errorCode || 'DELIVERY_FAILED').toUpperCase();
  const provider = input.provider || 'unknown';

  if (code === 'EAUTH') {
    return {
      title: 'Email authentication failed',
      summary: `SMTP/email credentials were rejected (${provider}). Update workspace or platform email settings.`,
      severity: 'critical',
      category: 'email',
    };
  }
  if (code === 'SMS_PROVIDER_SENDER_NOT_APPROVED') {
    return {
      title: 'SMS Sender ID not approved',
      summary: `Provider (${provider}) rejected the Sender ID. Register/approve it in the provider dashboard.`,
      severity: 'critical',
      category: 'sms',
    };
  }
  if (code === 'PLATFORM_EMAIL_NOT_CONFIGURED' || code === 'SMS_NOT_CONFIGURED') {
    return {
      title: code === 'SMS_NOT_CONFIGURED' ? 'SMS not configured' : 'Platform email not configured',
      summary: input.errorMessage || 'Required messaging configuration is missing.',
      severity: 'critical',
      category: channel === 'sms' ? 'sms' : 'config',
    };
  }

  return {
    title: `${channel.toUpperCase()} delivery failed`,
    summary: input.errorMessage || `${channel} send failed (${code}) via ${provider}`,
    severity: isCriticalDeliveryError(code) ? 'critical' : 'warning',
    category: ['email', 'sms', 'whatsapp', 'api'].includes(channel) ? channel : 'api',
  };
}

/**
 * Email platform admins for a critical open issue (deduped via notifiedAt).
 * @param {import('../models/SystemHealthIssue')} issue
 * @param {boolean} force
 */
async function maybeNotifyCriticalIssue(issue, force = false) {
  if (!issue || issue.severity !== 'critical') return;
  if (!['open', 'acknowledged'].includes(issue.status)) return;

  const now = Date.now();
  const lastNotified = issue.notifiedAt ? new Date(issue.notifiedAt).getTime() : 0;
  if (!force && lastNotified && now - lastNotified < NOTIFY_COOLDOWN_MS) return;

  try {
    let tenantName = null;
    if (issue.tenantId) {
      const tenant = await Tenant.findByPk(issue.tenantId, { attributes: ['name'] });
      tenantName = tenant?.name || null;
    }

    const frontendUrl = getFrontendBaseUrlFromEnv();
    const adminHealthUrl = `${frontendUrl}/admin/health`;
    const { notifySystemHealthIssue } = require('./platformAdminNotificationService');
    await notifySystemHealthIssue({
      title: issue.title,
      summary: issue.summary,
      severity: issue.severity,
      category: issue.category,
      tenantName,
      tenantId: issue.tenantId,
      occurrenceCount: issue.occurrenceCount,
      adminHealthUrl,
      fingerprint: issue.fingerprint,
    });

    await issue.update({ notifiedAt: new Date() });
  } catch (err) {
    console.error('[SystemHealth] Failed to notify platform admins:', err?.message || err);
  }
}

/**
 * Upsert an open health issue from a failed delivery.
 * @param {object} input
 */
async function upsertIssueFromDeliveryFailure(input = {}) {
  const fingerprint = buildFingerprint({
    channel: input.channel,
    provider: input.provider,
    errorCode: input.errorCode,
    tenantId: input.tenantId,
  });
  const desc = describeDeliveryFailure(input);
  const now = new Date();

  const existing = await SystemHealthIssue.findOne({ where: { fingerprint } });
  if (existing) {
    const wasResolved = existing.status === 'resolved';
    await existing.update({
      severity: desc.severity,
      category: desc.category,
      title: desc.title,
      summary: desc.summary,
      tenantId: input.tenantId || existing.tenantId,
      status: wasResolved ? 'open' : existing.status,
      lastSeenAt: now,
      occurrenceCount: (existing.occurrenceCount || 0) + 1,
      lastErrorMessage: input.errorMessage ? String(input.errorMessage).slice(0, 5000) : existing.lastErrorMessage,
      resolvedAt: wasResolved ? null : existing.resolvedAt,
      metadata: {
        ...(existing.metadata || {}),
        ...(input.metadata || {}),
        source: input.source || existing.metadata?.source,
        provider: input.provider || existing.metadata?.provider,
        subjectOrContext: input.subjectOrContext || existing.metadata?.subjectOrContext,
      },
    });
    await maybeNotifyCriticalIssue(existing, wasResolved);
    return existing;
  }

  const created = await SystemHealthIssue.create({
    fingerprint,
    severity: desc.severity,
    category: desc.category,
    title: desc.title,
    summary: desc.summary,
    tenantId: input.tenantId || null,
    status: 'open',
    firstSeenAt: now,
    lastSeenAt: now,
    occurrenceCount: 1,
    lastErrorMessage: input.errorMessage ? String(input.errorMessage).slice(0, 5000) : null,
    metadata: {
      ...(input.metadata || {}),
      source: input.source || null,
      provider: input.provider || null,
      subjectOrContext: input.subjectOrContext || null,
    },
  });
  await maybeNotifyCriticalIssue(created, true);
  return created;
}

/**
 * Soft-resolve matching open issues when a similar delivery succeeds.
 * Only resolves when errorCode is known (same fingerprint space as failures).
 * @param {object} input
 */
async function resolveIssueOnDeliverySuccess(input = {}) {
  if (!input.errorCode) {
    // Resolve generic channel+provider+tenant critical config issues on any success
    const fingerprints = [
      buildFingerprint({
        channel: input.channel,
        provider: input.provider,
        errorCode: input.channel === 'sms' ? 'SMS_NOT_CONFIGURED' : 'PLATFORM_EMAIL_NOT_CONFIGURED',
        tenantId: input.tenantId,
      }),
    ];
    if (input.channel === 'email') {
      fingerprints.push(buildFingerprint({
        channel: 'email',
        provider: input.provider,
        errorCode: 'EAUTH',
        tenantId: input.tenantId,
      }));
    }
    if (input.channel === 'sms') {
      fingerprints.push(buildFingerprint({
        channel: 'sms',
        provider: input.provider,
        errorCode: 'SMS_PROVIDER_SENDER_NOT_APPROVED',
        tenantId: input.tenantId,
      }));
    }
    await SystemHealthIssue.update(
      { status: 'resolved', resolvedAt: new Date() },
      {
        where: {
          fingerprint: { [Op.in]: fingerprints },
          status: { [Op.in]: ['open', 'acknowledged'] },
        },
      }
    );
    return;
  }

  const fingerprint = buildFingerprint({
    channel: input.channel,
    provider: input.provider,
    errorCode: input.errorCode,
    tenantId: input.tenantId,
  });
  await SystemHealthIssue.update(
    { status: 'resolved', resolvedAt: new Date() },
    {
      where: {
        fingerprint,
        status: { [Op.in]: ['open', 'acknowledged'] },
      },
    }
  );
}

/**
 * Acknowledge an open issue.
 * @param {string} issueId
 */
async function acknowledgeIssue(issueId) {
  const issue = await SystemHealthIssue.findByPk(issueId);
  if (!issue) return null;
  if (issue.status === 'resolved') return issue;
  await issue.update({
    status: 'acknowledged',
    acknowledgedAt: new Date(),
  });
  return issue;
}

/**
 * Manually resolve an issue.
 * @param {string} issueId
 */
async function resolveIssue(issueId) {
  const issue = await SystemHealthIssue.findByPk(issueId);
  if (!issue) return null;
  await issue.update({
    status: 'resolved',
    resolvedAt: new Date(),
  });
  return issue;
}

/**
 * Backfill issues from recent failed invites (until all paths write delivery_events).
 */
async function backfillFromFailedInvites() {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const failedInvites = await InviteToken.findAll({
    where: {
      emailStatus: 'failed',
      updatedAt: { [Op.gte]: since },
    },
    attributes: ['id', 'tenantId', 'emailLastError', 'updatedAt'],
    order: [['updatedAt', 'DESC']],
    limit: 50,
  });

  for (const invite of failedInvites) {
    const errorMessage = invite.emailLastError || 'Invite email failed';
    const { normalizeDeliveryErrorCode } = require('./deliveryEventService');
    const errorCode = normalizeDeliveryErrorCode('email', null, errorMessage);
    const fingerprint = buildFingerprint({
      channel: 'email',
      provider: 'smtp',
      errorCode,
      tenantId: invite.tenantId,
    });
    const existing = await SystemHealthIssue.findOne({
      where: {
        fingerprint,
        status: { [Op.in]: ['open', 'acknowledged'] },
      },
      attributes: ['id'],
    });
    if (existing) continue;

    await upsertIssueFromDeliveryFailure({
      tenantId: invite.tenantId,
      channel: 'email',
      provider: 'smtp',
      source: 'invite_email_backfill',
      errorCode,
      errorMessage,
      subjectOrContext: `invite:${invite.id}`,
      metadata: { inviteId: invite.id, backfill: true },
    });
  }
}

/**
 * Build config readiness checks for platform email/SMS.
 * @returns {Promise<object[]>}
 */
async function getConfigChecks() {
  const checks = [];
  try {
    const { getSavedPlatformEmailConfig } = require('./platformEmailSettingsService');
    const emailConfig = await getSavedPlatformEmailConfig();
    const emailReady = !!(
      emailConfig
      && (
        (emailConfig.provider === 'sendgrid' && emailConfig.sendgridApiKey)
        || (emailConfig.smtpHost && emailConfig.smtpUser && emailConfig.smtpPassword)
        || (emailConfig.fromEmail && emailConfig.provider)
      )
    );
    checks.push({
      key: 'platform_email',
      label: 'Platform email',
      ok: emailReady,
      detail: emailReady
        ? `Configured (${emailConfig.provider || 'smtp'})`
        : 'Platform email settings missing or incomplete',
    });
  } catch (err) {
    checks.push({
      key: 'platform_email',
      label: 'Platform email',
      ok: false,
      detail: err?.message || 'Failed to load platform email settings',
    });
  }

  try {
    const { getSavedPlatformSmsConfig } = require('./platformSmsSettingsService');
    const smsConfig = await getSavedPlatformSmsConfig();
    const smsReady = !!(smsConfig && (smsConfig.apiKey || smsConfig.authToken || smsConfig.accountSid));
    checks.push({
      key: 'platform_sms',
      label: 'Platform SMS',
      ok: smsReady,
      detail: smsReady
        ? `Configured (${smsConfig.provider || 'unknown'})`
        : 'Platform SMS settings missing or incomplete',
    });
  } catch (err) {
    checks.push({
      key: 'platform_sms',
      label: 'Platform SMS',
      ok: false,
      detail: err?.message || 'Failed to load platform SMS settings',
    });
  }

  return checks;
}

/**
 * Aggregate 24h channel stats from delivery_events.
 */
async function getChannelStats24h() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await DeliveryEvent.findAll({
    where: { createdAt: { [Op.gte]: since } },
    attributes: ['channel', 'status', 'createdAt'],
    raw: true,
  });

  const channels = {
    email: { success24h: 0, failed24h: 0, lastFailureAt: null },
    sms: { success24h: 0, failed24h: 0, lastFailureAt: null },
    whatsapp: { success24h: 0, failed24h: 0, lastFailureAt: null },
  };

  for (const row of rows) {
    const key = String(row.channel || '').toLowerCase();
    if (!channels[key]) continue;
    if (row.status === 'success') channels[key].success24h += 1;
    else {
      channels[key].failed24h += 1;
      if (!channels[key].lastFailureAt || new Date(row.createdAt) > new Date(channels[key].lastFailureAt)) {
        channels[key].lastFailureAt = row.createdAt;
      }
    }
  }

  return channels;
}

/**
 * Compose System Health payload extras (issues, channels, failures, config).
 */
async function buildHealthDashboardExtras() {
  try {
    await backfillFromFailedInvites();
  } catch (err) {
    console.warn('[SystemHealth] Invite backfill skipped:', err?.message);
  }

  const [openIssues, recentFailures, channels, configChecks, openCriticalCount] = await Promise.all([
    SystemHealthIssue.findAll({
      where: { status: { [Op.in]: ['open', 'acknowledged'] } },
      include: [{ model: Tenant, as: 'tenant', attributes: ['id', 'name'], required: false }],
      order: [
        ['severity', 'ASC'],
        ['lastSeenAt', 'DESC'],
      ],
      limit: 50,
    }),
    DeliveryEvent.findAll({
      where: { status: 'failed' },
      include: [{ model: Tenant, as: 'tenant', attributes: ['id', 'name'], required: false }],
      order: [['createdAt', 'DESC']],
      limit: 20,
    }),
    getChannelStats24h(),
    getConfigChecks(),
    SystemHealthIssue.count({
      where: {
        status: { [Op.in]: ['open', 'acknowledged'] },
        severity: 'critical',
      },
    }),
  ]);

  // Open/resolve config probe issues without spamming occurrence counts
  for (const check of configChecks) {
    const fingerprint = `config:${check.key}:platform`;
    const existing = await SystemHealthIssue.findOne({ where: { fingerprint } });
    if (!check.ok) {
      if (!existing || existing.status === 'resolved') {
        await SystemHealthIssue.create({
          fingerprint,
          severity: 'warning',
          category: 'config',
          title: `${check.label} not ready`,
          summary: check.detail,
          tenantId: null,
          status: 'open',
          firstSeenAt: new Date(),
          lastSeenAt: new Date(),
          occurrenceCount: 1,
          lastErrorMessage: check.detail,
          metadata: { configKey: check.key },
        }).catch(async () => {
          if (existing) {
            await existing.update({
              status: 'open',
              resolvedAt: null,
              lastSeenAt: new Date(),
              summary: check.detail,
              lastErrorMessage: check.detail,
            });
          }
        });
      } else {
        await existing.update({
          lastSeenAt: new Date(),
          summary: check.detail,
          lastErrorMessage: check.detail,
        });
      }
    } else if (existing && ['open', 'acknowledged'].includes(existing.status)) {
      await existing.update({ status: 'resolved', resolvedAt: new Date() });
    }
  }

  const refreshedOpenIssues = await SystemHealthIssue.findAll({
    where: { status: { [Op.in]: ['open', 'acknowledged'] } },
    include: [{ model: Tenant, as: 'tenant', attributes: ['id', 'name'], required: false }],
    order: [['lastSeenAt', 'DESC']],
    limit: 50,
  });

  const refreshedCritical = await SystemHealthIssue.count({
    where: {
      status: { [Op.in]: ['open', 'acknowledged'] },
      severity: 'critical',
    },
  });

  // Sort critical first
  const severityRank = { critical: 0, warning: 1, info: 2 };
  const sortedIssues = [...refreshedOpenIssues].sort((a, b) => {
    const ra = severityRank[a.severity] ?? 9;
    const rb = severityRank[b.severity] ?? 9;
    if (ra !== rb) return ra - rb;
    return new Date(b.lastSeenAt) - new Date(a.lastSeenAt);
  });

  let overallStatus = 'healthy';
  if (refreshedCritical > 0) overallStatus = 'critical';
  else if (sortedIssues.length > 0 || configChecks.some((c) => !c.ok)) overallStatus = 'degraded';

  return {
    overallStatus,
    openCriticalCount: refreshedCritical,
    openIssues: sortedIssues.map((issue) => ({
      id: issue.id,
      fingerprint: issue.fingerprint,
      severity: issue.severity,
      category: issue.category,
      title: issue.title,
      summary: issue.summary,
      tenantId: issue.tenantId,
      tenantName: issue.tenant?.name || null,
      status: issue.status,
      firstSeenAt: issue.firstSeenAt,
      lastSeenAt: issue.lastSeenAt,
      occurrenceCount: issue.occurrenceCount,
      lastErrorMessage: issue.lastErrorMessage,
      notifiedAt: issue.notifiedAt,
      metadata: issue.metadata,
    })),
    channels,
    recentFailures: recentFailures.map((ev) => ({
      id: ev.id,
      tenantId: ev.tenantId,
      tenantName: ev.tenant?.name || null,
      channel: ev.channel,
      provider: ev.provider,
      source: ev.source,
      errorCode: ev.errorCode,
      errorMessage: ev.errorMessage,
      recipientMasked: ev.recipientMasked,
      subjectOrContext: ev.subjectOrContext,
      createdAt: ev.createdAt,
    })),
    configChecks,
  };
}

/**
 * Count open critical issues for Overview / nav badge.
 */
async function countOpenCriticalIssues() {
  return SystemHealthIssue.count({
    where: {
      status: { [Op.in]: ['open', 'acknowledged'] },
      severity: 'critical',
    },
  });
}

module.exports = {
  buildFingerprint,
  describeDeliveryFailure,
  upsertIssueFromDeliveryFailure,
  resolveIssueOnDeliverySuccess,
  acknowledgeIssue,
  resolveIssue,
  backfillFromFailedInvites,
  getConfigChecks,
  getChannelStats24h,
  buildHealthDashboardExtras,
  countOpenCriticalIssues,
  maybeNotifyCriticalIssue,
  NOTIFY_COOLDOWN_MS,
};
