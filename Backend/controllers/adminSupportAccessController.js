const { Tenant, TenantAccessAudit } = require('../models');
const { SupportAccessSession } = require('../models');
const {
  DEFAULT_SESSION_HOURS,
  MAX_REASON_LENGTH,
  endOtherActiveSessions,
} = require('../utils/supportAccess');
const { getTenantEffectiveEntitlements } = require('../utils/tenantEntitlements');

const buildSessionResponse = async (session) => {
  const tenant = await Tenant.findByPk(session.tenantId, {
    attributes: ['id', 'name', 'slug', 'status', 'plan', 'businessType', 'metadata'],
  });
  const accessControl = tenant
    ? await getTenantEffectiveEntitlements(tenant, { logContext: 'support_access_start' })
    : null;

  return {
    session: {
      id: session.id,
      tenantId: session.tenantId,
      adminUserId: session.adminUserId,
      supportTicketId: session.supportTicketId,
      reason: session.reason,
      mode: session.mode,
      startedAt: session.startedAt,
      expiresAt: session.expiresAt,
      endedAt: session.endedAt,
    },
    tenant: tenant
      ? {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          status: tenant.status,
          plan: tenant.plan,
          businessType: tenant.businessType,
          effectiveFeatureFlags: accessControl?.effectiveFeatureFlags || {},
        }
      : null,
  };
};

exports.startSupportAccess = async (req, res, next) => {
  try {
    const tenantId = req.params.id;
    const { reason, supportTicketId, hours } = req.body || {};

    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ success: false, message: 'A reason is required for support access' });
    }

    const trimmedReason = String(reason).trim().slice(0, MAX_REASON_LENGTH);
    const tenant = await Tenant.findByPk(tenantId);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    const sessionHours = Math.min(Math.max(Number(hours) || DEFAULT_SESSION_HOURS, 1), 8);
    const expiresAt = new Date(Date.now() + sessionHours * 60 * 60 * 1000);

    await endOtherActiveSessions(req.user.id);

    const session = await SupportAccessSession.create({
      tenantId,
      adminUserId: req.user.id,
      supportTicketId: supportTicketId || null,
      reason: trimmedReason,
      mode: 'read_only',
      expiresAt,
      metadata: {
        userAgent: req.headers['user-agent'] || null,
        ip: req.ip || null,
      },
    });

    await TenantAccessAudit.create({
      tenantId,
      actorUserId: req.user.id,
      action: 'support_access_started',
      before: {},
      after: {
        sessionId: session.id,
        mode: session.mode,
        expiresAt: session.expiresAt,
        supportTicketId: session.supportTicketId,
      },
      reason: trimmedReason,
    });

    const data = await buildSessionResponse(session);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.endSupportAccess = async (req, res, next) => {
  try {
    const sessionId = req.params.sessionId || req.body?.sessionId;
    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'Session id is required' });
    }

    const session = await SupportAccessSession.findOne({
      where: {
        id: sessionId,
        adminUserId: req.user.id,
        endedAt: null,
      },
    });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Active support session not found' });
    }

    await session.update({ endedAt: new Date() });

    await TenantAccessAudit.create({
      tenantId: session.tenantId,
      actorUserId: req.user.id,
      action: 'support_access_ended',
      before: { sessionId: session.id },
      after: { endedAt: session.endedAt },
      reason: session.reason,
    });

    res.status(200).json({
      success: true,
      data: { sessionId: session.id, endedAt: session.endedAt },
    });
  } catch (error) {
    next(error);
  }
};

exports.getActiveSupportAccess = async (req, res, next) => {
  try {
    const session = await SupportAccessSession.findOne({
      where: {
        adminUserId: req.user.id,
        endedAt: null,
        expiresAt: { [require('sequelize').Op.gt]: new Date() },
      },
      order: [['startedAt', 'DESC']],
    });

    if (!session) {
      return res.status(200).json({ success: true, data: null });
    }

    const data = await buildSessionResponse(session);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
