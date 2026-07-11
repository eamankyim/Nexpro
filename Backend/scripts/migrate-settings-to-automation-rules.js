/**
 * Seed AutomationRule rows from legacy customer-notification and job-invoice settings.
 *
 * Usage:
 *   node scripts/migrate-settings-to-automation-rules.js --dry-run
 *   node scripts/migrate-settings-to-automation-rules.js --execute
 *   node scripts/migrate-settings-to-automation-rules.js --execute --tenant-id <uuid>
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize, testConnection } = require('../config/database');
const { Tenant, Setting, AutomationRule } = require('../models');
const { getTemplateByKey } = require('../services/automationEngineService');
const { TEMPLATE_KEYS } = require('../services/customerNotificationBridgeService');

const isExecute = process.argv.includes('--execute');
const isDryRun = process.argv.includes('--dry-run') || !isExecute;

const getArgValue = (name, fallback) => {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
};

const requestedTenantId = getArgValue('--tenant-id', null)?.trim() || null;

/**
 * @param {string} tenantId
 * @param {string} templateKey
 * @returns {Promise<object|null>}
 */
async function findExistingRuleForTemplate(tenantId, templateKey) {
  const rules = await AutomationRule.findAll({ where: { tenantId } });
  return rules.find((rule) => rule.metadata?.templateKey === templateKey) || null;
}

/**
 * @param {object} template
 * @returns {object}
 */
function buildOverdueEmailOnlyActionConfig(template) {
  return {
    actions: [{
      type: 'send_email_platform',
      subject: 'Payment reminder — invoice {{invoiceNumber}}',
      body: 'Hi {{customerName}},\n\nThis is a friendly reminder that invoice {{invoiceNumber}} for {{balance}} is overdue.\n\nPay online: {{paymentLink}}\n\n— {{businessName}}',
    }],
  };
}

/**
 * @returns {Array<{ templateKey: string, enabled: boolean, customize?: (template: object) => object }>}
 */
function buildMigrationCandidates(customerPrefs, jobInvoicePrefs) {
  const candidates = [];

  if (customerPrefs.autoSendInvoiceToCustomer !== false) {
    candidates.push({ templateKey: TEMPLATE_KEYS.INVOICE_SENT, enabled: true });
  }
  if (customerPrefs.autoSendReceiptToCustomer === true) {
    candidates.push({ templateKey: TEMPLATE_KEYS.SALE_COMPLETED_RECEIPT, enabled: true });
  }
  if (customerPrefs.sendPaymentReminderEmail === true) {
    candidates.push({
      templateKey: TEMPLATE_KEYS.OVERDUE_INVOICE_REMINDER,
      enabled: true,
      customize: (template) => ({
        ...template,
        actionConfig: buildOverdueEmailOnlyActionConfig(template),
      }),
    });
  }
  if (customerPrefs.sendInvoicePaidConfirmationToCustomer !== false) {
    candidates.push({ templateKey: TEMPLATE_KEYS.PAYMENT_RECEIVED_THANK_YOU, enabled: true });
  }

  if (jobInvoicePrefs.emailCustomerJobTrackingOnJobCreation === true
    && jobInvoicePrefs.customerJobTrackingEnabled !== false) {
    candidates.push({ templateKey: TEMPLATE_KEYS.JOB_CREATED_TRACKING_EMAIL, enabled: true });
  }
  if (jobInvoicePrefs.smsCustomerJobTrackingOnJobCreation === true
    && jobInvoicePrefs.customerJobTrackingEnabled !== false) {
    candidates.push({ templateKey: TEMPLATE_KEYS.JOB_CREATED_TRACKING_SMS, enabled: true });
  }
  if (jobInvoicePrefs.autoSendInvoiceOnJobCreation === true) {
    candidates.push({ templateKey: TEMPLATE_KEYS.JOB_CREATED_SEND_INVOICE, enabled: true });
  }

  return candidates;
}

async function migrateTenant(tenantId, tenantName, summary) {
  const [customerPrefsRow, jobInvoiceRow] = await Promise.all([
    Setting.findOne({ where: { tenantId, key: 'customer-notification-preferences' } }),
    Setting.findOne({ where: { tenantId, key: 'job-invoice' } }),
  ]);

  const customerPrefs = customerPrefsRow?.value || {};
  const jobInvoicePrefs = jobInvoiceRow?.value || {};
  const candidates = buildMigrationCandidates(customerPrefs, jobInvoicePrefs);

  for (const candidate of candidates) {
    const existing = await findExistingRuleForTemplate(tenantId, candidate.templateKey);
    if (existing) {
      summary.skipped += 1;
      console.log(`  skip ${candidate.templateKey} (rule exists: ${existing.name})`);
      continue;
    }

    const baseTemplate = getTemplateByKey(candidate.templateKey);
    if (!baseTemplate) {
      summary.missingTemplate += 1;
      console.warn(`  missing template definition: ${candidate.templateKey}`);
      continue;
    }

    const template = candidate.customize ? candidate.customize(baseTemplate) : baseTemplate;
    const payload = {
      tenantId,
      name: template.name,
      enabled: candidate.enabled,
      triggerType: template.triggerType,
      triggerConfig: template.triggerConfig || {},
      conditionConfig: template.conditionConfig || {},
      actionConfig: template.actionConfig || { actions: [] },
      scheduleConfig: {
        ...(template.scheduleConfig || {}),
        migratedFromSettings: true,
      },
      metadata: {
        templateKey: candidate.templateKey,
        migratedFromSettings: true,
        reviewNote: template.reviewNote || null,
      },
    };

    summary.planned += 1;
    console.log(`  ${isDryRun ? 'would create' : 'create'} ${candidate.templateKey} (${template.triggerType})`);

    if (isExecute) {
      await AutomationRule.create(payload);
      summary.created += 1;
    }
  }
}

async function main() {
  console.log(`[migrate-settings-to-automation-rules] mode=${isDryRun ? 'dry-run' : 'execute'}`);
  await testConnection();

  const where = requestedTenantId ? { id: requestedTenantId } : {};
  const tenants = await Tenant.findAll({ where, attributes: ['id', 'name'], order: [['createdAt', 'ASC']] });
  if (requestedTenantId && tenants.length === 0) {
    throw new Error(`Tenant not found: ${requestedTenantId}`);
  }

  const summary = { tenants: tenants.length, planned: 0, created: 0, skipped: 0, missingTemplate: 0 };

  for (const tenant of tenants) {
    console.log(`\nTenant ${tenant.name} (${tenant.id})`);
    await migrateTenant(tenant.id, tenant.name, summary);
  }

  console.log('\nSummary:', summary);
  if (isDryRun) {
    console.log('Dry run complete. Re-run with --execute to apply changes.');
  }
}

main()
  .catch((error) => {
    console.error('[migrate-settings-to-automation-rules] failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await sequelize.close();
    } catch (_error) {
      // ignore close errors
    }
  });
