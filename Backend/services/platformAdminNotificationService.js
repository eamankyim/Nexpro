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

  const recipients = admins
    .map((admin) => String(admin?.email || '').trim().toLowerCase())
    .filter(Boolean);

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

module.exports = {
  notifyAccountCreated,
  notifyTenantOnboarded,
};

