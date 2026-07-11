const { Op } = require('sequelize');
const { AutomationRule, Setting, SaleActivity } = require('../models');

/** Dedupe window for receipt sends (built-in vs POS auto_send vs automation). */
const RECEIPT_DEDUPE_WINDOW_MINUTES = 5;

const TEMPLATE_KEYS = {
  INVOICE_SENT: 'invoice_sent_notification',
  SALE_COMPLETED_RECEIPT: 'sale_completed_receipt',
  PAYMENT_RECEIVED_THANK_YOU: 'payment_received_thank_you',
  OVERDUE_INVOICE_REMINDER: 'overdue_invoice_reminder',
  JOB_CREATED_TRACKING_EMAIL: 'job_created_tracking_email',
  JOB_CREATED_TRACKING_SMS: 'job_created_tracking_sms',
  JOB_CREATED_SEND_INVOICE: 'job_created_send_invoice',
};

/** Template keys that should also match by trigger type (any custom overdue rule). */
const TEMPLATE_KEY_TRIGGER_TYPES = {
  [TEMPLATE_KEYS.OVERDUE_INVOICE_REMINDER]: 'invoice_overdue',
};

/**
 * Find an enabled automation rule seeded from or matching a template key.
 * @param {string} tenantId
 * @param {string} templateKey
 * @returns {Promise<object|null>}
 */
async function getEnabledRuleByTemplateKey(tenantId, templateKey) {
  if (!tenantId || !templateKey) return null;
  const rules = await AutomationRule.findAll({
    where: { tenantId, enabled: true },
    attributes: ['id', 'name', 'triggerType', 'metadata', 'enabled'],
  });
  return rules.find((rule) => rule.metadata?.templateKey === templateKey) || null;
}

/**
 * Find an enabled automation rule by trigger type.
 * @param {string} tenantId
 * @param {string} triggerType
 * @returns {Promise<object|null>}
 */
async function getEnabledRuleByTriggerType(tenantId, triggerType) {
  if (!tenantId || !triggerType) return null;
  return AutomationRule.findOne({
    where: { tenantId, enabled: true, triggerType },
    attributes: ['id', 'name', 'triggerType', 'metadata', 'enabled'],
  });
}

/**
 * When an enabled automation rule exists for this template (or matching trigger),
 * built-in channel sends should be skipped.
 * @param {string} tenantId
 * @param {string} templateKey
 * @returns {Promise<boolean>}
 */
async function shouldUseAutomationInsteadOfBuiltIn(tenantId, templateKey) {
  if (await getEnabledRuleByTemplateKey(tenantId, templateKey)) return true;
  const triggerType = TEMPLATE_KEY_TRIGGER_TYPES[templateKey];
  if (triggerType && await getEnabledRuleByTriggerType(tenantId, triggerType)) return true;
  return false;
}

/**
 * Dual-read: feature is on if the legacy setting is on OR a matching automation rule is enabled.
 * @param {string} tenantId
 * @param {{ settingEnabled?: boolean, templateKey: string }} params
 * @returns {Promise<boolean>}
 */
async function isCustomerNotificationEffectiveEnabled(tenantId, { settingEnabled = false, templateKey }) {
  if (settingEnabled) return true;
  return Boolean(await getEnabledRuleByTemplateKey(tenantId, templateKey));
}

/**
 * Whether POS auto-send receipt mode is enabled for the tenant.
 * @param {string} tenantId
 * @returns {Promise<boolean>}
 */
async function isPosAutoSendReceiptEnabled(tenantId) {
  const row = await Setting.findOne({ where: { tenantId, key: 'pos_config' } });
  const mode = row?.value?.receipt?.mode;
  return mode === 'auto_send' || mode === 'auto_both';
}

/**
 * Whether a receipt was sent for this sale within the dedupe window.
 * @param {string} tenantId
 * @param {string} saleId
 * @returns {Promise<boolean>}
 */
async function hasRecentReceiptForSale(tenantId, saleId) {
  if (!tenantId || !saleId) return false;
  const threshold = new Date(Date.now() - RECEIPT_DEDUPE_WINDOW_MINUTES * 60 * 1000);
  const recent = await SaleActivity.findOne({
    where: {
      tenantId,
      saleId,
      type: 'receipt_sent',
      createdAt: { [Op.gte]: threshold },
    },
    attributes: ['id'],
  });
  return Boolean(recent);
}

/**
 * Record a receipt_sent activity for dedupe (built-in auto-send path).
 * @param {string} tenantId
 * @param {string} saleId
 * @param {{ source?: string, channels?: string[] }} [metadata]
 * @returns {Promise<void>}
 */
async function recordReceiptSentActivity(tenantId, saleId, metadata = {}) {
  await SaleActivity.create({
    saleId,
    tenantId,
    type: 'receipt_sent',
    subject: 'Receipt Sent',
    notes: metadata.source ? `Receipt sent (${metadata.source})` : 'Receipt sent',
    createdBy: null,
    metadata: { automated: true, ...metadata },
  });
}

module.exports = {
  TEMPLATE_KEYS,
  TEMPLATE_KEY_TRIGGER_TYPES,
  RECEIPT_DEDUPE_WINDOW_MINUTES,
  getEnabledRuleByTemplateKey,
  getEnabledRuleByTriggerType,
  shouldUseAutomationInsteadOfBuiltIn,
  isCustomerNotificationEffectiveEnabled,
  isPosAutoSendReceiptEnabled,
  hasRecentReceiptForSale,
  recordReceiptSentActivity,
};
