const crypto = require('crypto');
const { Job, JobItem, Customer, Setting, Tenant } = require('../models');
const { applyTenantFilter } = require('../utils/tenantUtils');
const { getTenantLogoUrl } = require('../utils/tenantLogo');

const JOB_INVOICE_DEFAULTS = {
  autoSendInvoiceOnJobCreation: false,
  customerJobTrackingEnabled: false,
  emailCustomerJobTrackingOnJobCreation: false
};

/**
 * @param {string} tenantId
 * @returns {Promise<typeof JOB_INVOICE_DEFAULTS & Record<string, unknown>>}
 */
async function getJobInvoiceSettingValue(tenantId) {
  const row = await Setting.findOne({ where: { tenantId, key: 'job-invoice' } });
  return { ...JOB_INVOICE_DEFAULTS, ...(row?.value || {}) };
}

/**
 * Ensure workspace job has a public view token for tracking links.
 * @param {string} jobId
 * @param {string} tenantId
 * @returns {Promise<string|null>}
 */
async function ensureJobViewToken(jobId, tenantId) {
  const job = await Job.findOne({ where: applyTenantFilter(tenantId, { id: jobId }) });
  if (!job?.tenantId) return null;
  if (job.viewToken) return job.viewToken;
  const viewToken = crypto.randomBytes(32).toString('hex');
  await job.update({ viewToken });
  return viewToken;
}

/**
 * Email customer a link to track their job when workspace settings allow it.
 * @param {{ tenantId: string, jobId: string, triggeredByUserId: string|null }} params
 */
async function maybeSendJobTrackingEmailOnJobCreated({ tenantId, jobId, triggeredByUserId }) {
  const flags = await getJobInvoiceSettingValue(tenantId);
  if (flags.customerJobTrackingEnabled !== true || flags.emailCustomerJobTrackingOnJobCreation !== true) {
    return;
  }

  const job = await Job.findOne({
    where: applyTenantFilter(tenantId, { id: jobId }),
    include: [
      { model: Customer, as: 'customer', attributes: ['id', 'name', 'company', 'email'] },
      { model: JobItem, as: 'items', attributes: ['description'], required: false }
    ]
  });
  if (!job?.customer?.email) return;

  const viewToken = await ensureJobViewToken(job.id, tenantId);
  if (!viewToken) return;

  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  const trackUrl = `${frontendUrl}/track-job/${viewToken}`;

  const tenant = await Tenant.findByPk(tenantId, { attributes: ['id', 'name', 'metadata'] });
  const orgRow = await Setting.findOne({ where: { tenantId, key: 'organization' } });
  const org = orgRow?.value || {};
  const company = {
    name: org.name || tenant?.name || 'Your service provider',
    logo: org.logoUrl || getTenantLogoUrl(tenant),
    primaryColor: org.primaryColor || tenant?.metadata?.primaryColor || '#166534'
  };

  const emailTemplates = require('./emailTemplates');
  const emailService = require('./emailService');
  const { subject, html, text } = emailTemplates.jobTrackingNotification(job, job.customer, trackUrl, company);

  await emailService.sendMessage(tenantId, job.customer.email, subject, html, text);
}

module.exports = {
  getJobInvoiceSettingValue,
  ensureJobViewToken,
  maybeSendJobTrackingEmailOnJobCreated,
  JOB_INVOICE_DEFAULTS
};
