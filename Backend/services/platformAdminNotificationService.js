const { User } = require('../models');
const emailService = require('./emailService');

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const toDisplay = (value, fallback = 'N/A') => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

const sendToPlatformAdmins = async ({ subject, html, text }) => {
  const admins = await User.findAll({
    where: { isPlatformAdmin: true, isActive: true },
    attributes: ['email'],
    raw: true,
  });

  const configuredRecipients = [
    process.env.ADMIN_EMAIL,
    process.env.PLATFORM_ADMIN_EMAIL,
    process.env.SUPPORT_EMAIL,
    process.env.ONLINE_STORE_OPS_EMAIL,
  ];

  const recipients = Array.from(
    new Set(
      [
        ...admins.map((admin) => admin?.email),
        ...configuredRecipients,
      ]
        .map((email) => String(email || '').trim().toLowerCase())
        .filter(Boolean)
    )
  );

  if (recipients.length === 0) {
    return;
  }

  await Promise.all(
    recipients.map((email) =>
      emailService.sendPlatformMessage(email, subject, html, text).catch((err) => {
        console.error('[PlatformAdminNotify] Failed sending to %s: %s', email, err?.message || err);
      })
    )
  );
};

const notifyAccountCreated = async ({
  userName,
  userEmail,
  source = 'unknown',
  tenantName,
  tenantId,
}) => {
  const subject = `New account created: ${toDisplay(userEmail)}`;
  const html = `
    <h2>New account created</h2>
    <p>A new user account was created on African Business Suite.</p>
    <ul>
      <li><strong>Name:</strong> ${escapeHtml(toDisplay(userName))}</li>
      <li><strong>Email:</strong> ${escapeHtml(toDisplay(userEmail))}</li>
      <li><strong>Source:</strong> ${escapeHtml(toDisplay(source))}</li>
      <li><strong>Tenant:</strong> ${escapeHtml(toDisplay(tenantName))}</li>
      <li><strong>Tenant ID:</strong> ${escapeHtml(toDisplay(tenantId))}</li>
    </ul>
  `.trim();

  const text = [
    'New account created',
    `Name: ${toDisplay(userName)}`,
    `Email: ${toDisplay(userEmail)}`,
    `Source: ${toDisplay(source)}`,
    `Tenant: ${toDisplay(tenantName)}`,
    `Tenant ID: ${toDisplay(tenantId)}`,
  ].join('\n');

  await sendToPlatformAdmins({ subject, html, text });
};

const notifyTenantOnboarded = async ({
  tenantName,
  tenantId,
  businessType,
  companyEmail,
  companyPhone,
  actorName,
  actorEmail,
}) => {
  const subject = `Tenant onboarding completed: ${toDisplay(tenantName)}`;
  const html = `
    <h2>Tenant onboarding completed</h2>
    <p>A tenant has completed onboarding.</p>
    <ul>
      <li><strong>Tenant:</strong> ${escapeHtml(toDisplay(tenantName))}</li>
      <li><strong>Tenant ID:</strong> ${escapeHtml(toDisplay(tenantId))}</li>
      <li><strong>Business type:</strong> ${escapeHtml(toDisplay(businessType))}</li>
      <li><strong>Company email:</strong> ${escapeHtml(toDisplay(companyEmail))}</li>
      <li><strong>Company phone:</strong> ${escapeHtml(toDisplay(companyPhone))}</li>
      <li><strong>Completed by:</strong> ${escapeHtml(toDisplay(actorName))} (${escapeHtml(toDisplay(actorEmail))})</li>
    </ul>
  `.trim();

  const text = [
    'Tenant onboarding completed',
    `Tenant: ${toDisplay(tenantName)}`,
    `Tenant ID: ${toDisplay(tenantId)}`,
    `Business type: ${toDisplay(businessType)}`,
    `Company email: ${toDisplay(companyEmail)}`,
    `Company phone: ${toDisplay(companyPhone)}`,
    `Completed by: ${toDisplay(actorName)} (${toDisplay(actorEmail)})`,
  ].join('\n');

  await sendToPlatformAdmins({ subject, html, text });
};

const notifyDataDeletionRequested = async ({
  userName,
  userEmail,
  userId,
  tenantName,
  tenantId,
  reason,
  requestedAt,
}) => {
  const subject = `Data deletion requested: ${toDisplay(userEmail)}`;
  const html = `
    <h2>Data deletion request</h2>
    <p>A user requested account and workspace data deletion from the mobile app.</p>
    <ul>
      <li><strong>User:</strong> ${escapeHtml(toDisplay(userName))}</li>
      <li><strong>User email:</strong> ${escapeHtml(toDisplay(userEmail))}</li>
      <li><strong>User ID:</strong> ${escapeHtml(toDisplay(userId))}</li>
      <li><strong>Tenant:</strong> ${escapeHtml(toDisplay(tenantName))}</li>
      <li><strong>Tenant ID:</strong> ${escapeHtml(toDisplay(tenantId))}</li>
      <li><strong>Requested at:</strong> ${escapeHtml(toDisplay(requestedAt))}</li>
      <li><strong>Reason:</strong> ${escapeHtml(toDisplay(reason, 'No reason provided'))}</li>
    </ul>
    <p>Review the stored request in the tenant settings table before deleting data.</p>
  `.trim();

  const text = [
    'Data deletion request',
    `User: ${toDisplay(userName)}`,
    `User email: ${toDisplay(userEmail)}`,
    `User ID: ${toDisplay(userId)}`,
    `Tenant: ${toDisplay(tenantName)}`,
    `Tenant ID: ${toDisplay(tenantId)}`,
    `Requested at: ${toDisplay(requestedAt)}`,
    `Reason: ${toDisplay(reason, 'No reason provided')}`,
    '',
    'Review the stored request in the tenant settings table before deleting data.',
  ].join('\n');

  await sendToPlatformAdmins({ subject, html, text });
};

/**
 * Notify platform admins / ops when a merchant submits a custom domain for verification.
 * @param {{
 *   customDomain: string,
 *   tenantName?: string,
 *   tenantId?: string,
 *   slug?: string,
 *   displayName?: string,
 *   actorName?: string,
 *   actorEmail?: string,
 * }} payload
 */
const notifyCustomDomainSubmitted = async ({
  customDomain,
  tenantName,
  tenantId,
  slug,
  displayName,
  actorName,
  actorEmail,
}) => {
  const subject = `Online Store domain pending: ${toDisplay(customDomain)}`;
  const html = `
    <h2>Custom domain submitted</h2>
    <p>A merchant requested custom domain verification for their Online Store.</p>
    <ul>
      <li><strong>Domain:</strong> ${escapeHtml(toDisplay(customDomain))}</li>
      <li><strong>Store slug:</strong> ${escapeHtml(toDisplay(slug))}</li>
      <li><strong>Store name:</strong> ${escapeHtml(toDisplay(displayName))}</li>
      <li><strong>Tenant:</strong> ${escapeHtml(toDisplay(tenantName))}</li>
      <li><strong>Tenant ID:</strong> ${escapeHtml(toDisplay(tenantId))}</li>
      <li><strong>Submitted by:</strong> ${escapeHtml(toDisplay(actorName))} (${escapeHtml(toDisplay(actorEmail))})</li>
    </ul>
    <p>Review and verify in Control Center → Custom domains. Remember to add the domain in Vercel before marking verified.</p>
  `.trim();

  const text = [
    'Custom domain submitted',
    `Domain: ${toDisplay(customDomain)}`,
    `Store slug: ${toDisplay(slug)}`,
    `Store name: ${toDisplay(displayName)}`,
    `Tenant: ${toDisplay(tenantName)}`,
    `Tenant ID: ${toDisplay(tenantId)}`,
    `Submitted by: ${toDisplay(actorName)} (${toDisplay(actorEmail)})`,
    '',
    'Review and verify in Control Center → Custom domains. Remember to add the domain in Vercel before marking verified.',
  ].join('\n');

  await sendToPlatformAdmins({ subject, html, text });
};

/**
 * Notify platform admins of a critical System Health issue (deduped by caller).
 * @param {{
 *   title: string,
 *   summary?: string,
 *   severity?: string,
 *   category?: string,
 *   tenantName?: string,
 *   tenantId?: string,
 *   occurrenceCount?: number,
 *   adminHealthUrl?: string,
 *   fingerprint?: string,
 * }} payload
 */
const notifySystemHealthIssue = async ({
  title,
  summary,
  severity = 'critical',
  category,
  tenantName,
  tenantId,
  occurrenceCount,
  adminHealthUrl,
  fingerprint,
}) => {
  const subject = `[System Health] ${toDisplay(title)}`;
  const html = `
    <h2>System Health alert</h2>
    <p>A critical platform issue was detected.</p>
    <ul>
      <li><strong>Title:</strong> ${escapeHtml(toDisplay(title))}</li>
      <li><strong>Severity:</strong> ${escapeHtml(toDisplay(severity))}</li>
      <li><strong>Category:</strong> ${escapeHtml(toDisplay(category))}</li>
      <li><strong>Summary:</strong> ${escapeHtml(toDisplay(summary))}</li>
      <li><strong>Tenant:</strong> ${escapeHtml(toDisplay(tenantName))}</li>
      <li><strong>Tenant ID:</strong> ${escapeHtml(toDisplay(tenantId))}</li>
      <li><strong>Occurrences:</strong> ${escapeHtml(toDisplay(occurrenceCount))}</li>
      <li><strong>Fingerprint:</strong> ${escapeHtml(toDisplay(fingerprint))}</li>
    </ul>
    <p><a href="${escapeHtml(toDisplay(adminHealthUrl, '#'))}">Open System Health</a></p>
  `.trim();

  const text = [
    'System Health alert',
    `Title: ${toDisplay(title)}`,
    `Severity: ${toDisplay(severity)}`,
    `Category: ${toDisplay(category)}`,
    `Summary: ${toDisplay(summary)}`,
    `Tenant: ${toDisplay(tenantName)}`,
    `Tenant ID: ${toDisplay(tenantId)}`,
    `Occurrences: ${toDisplay(occurrenceCount)}`,
    `Fingerprint: ${toDisplay(fingerprint)}`,
    `System Health: ${toDisplay(adminHealthUrl)}`,
  ].join('\n');

  await sendToPlatformAdmins({ subject, html, text });
};

module.exports = {
  notifyAccountCreated,
  notifyTenantOnboarded,
  notifyDataDeletionRequested,
  notifyCustomDomainSubmitted,
  notifySystemHealthIssue,
};

