import { CURRENCY } from '../constants';
import { formatDecimal } from './formatNumber';
import { buildTestContextFromForm } from './automationForm';

/** Top-level placeholders that can fall back to nested invoice fields in preview. */
const INVOICE_PLACEHOLDER_FALLBACKS = {
  dueDate: ['invoice.dueDate'],
  invoiceNumber: ['invoice.invoiceNumber'],
  balance: ['invoice.balance'],
  amount: ['invoice.balance', 'invoice.totalAmount'],
  totalAmount: ['invoice.totalAmount'],
};

/**
 * Read a dotted path from a trigger/preview context object.
 * @param {Record<string, unknown>} context
 * @param {string} keyPath
 * @returns {unknown}
 */
function getContextValue(context, keyPath) {
  return String(keyPath)
    .split('.')
    .reduce((acc, part) => (acc != null && typeof acc === 'object' ? acc[part] : undefined), context);
}

/**
 * Resolve {{placeholder}} and {{nested.key}} tokens in a template string.
 * Mirrors Backend/services/automationEngineService.js applyTemplateValues for strings.
 * @param {string|null|undefined} template
 * @param {Record<string, unknown>} context
 * @returns {string}
 */
export function resolveAutomationTemplatePreview(template, context = {}) {
  if (template == null) return '';
  return String(template).replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key) => {
    let value = getContextValue(context, key);
    if ((value == null || value === '') && !String(key).includes('.')) {
      for (const fallbackPath of INVOICE_PLACEHOLDER_FALLBACKS[key] || []) {
        value = getContextValue(context, fallbackPath);
        if (value != null && value !== '') break;
      }
    }
    if (value == null) return '';
    if (key === 'dueDate' || String(key).endsWith('.dueDate')) {
      return formatPreviewDate(value) || String(value);
    }
    return String(value);
  });
}

/**
 * Format a numeric preview amount as "GHS 150.00".
 * @param {number|string|null|undefined} amount
 * @returns {string}
 */
function formatPreviewAmount(amount) {
  return `${CURRENCY.CODE} ${formatDecimal(amount)}`;
}

/**
 * Format an ISO date string for message previews (e.g. "15 Jul 2026").
 * @param {string|null|undefined} isoDate
 * @returns {string}
 */
export function formatPreviewDate(isoDate) {
  if (!isoDate) return '';
  const date = isoDate instanceof Date ? isoDate : new Date(isoDate);
  if (Number.isNaN(date.getTime())) return String(isoDate);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Build a sample invoice due date for preview/test context.
 * @param {string} triggerType
 * @param {Record<string, unknown>} triggerConfig
 * @returns {string} ISO date (YYYY-MM-DD)
 */
export function getSampleDueDateIso(triggerType, triggerConfig = {}) {
  const today = new Date();
  const sampleDueDate = new Date(today);
  if (triggerType === 'invoice_overdue') {
    sampleDueDate.setDate(today.getDate() - Number(triggerConfig.daysAfterDue ?? 1));
  } else {
    sampleDueDate.setDate(today.getDate() + Number(triggerConfig.daysBeforeDue ?? 2));
  }
  return sampleDueDate.toISOString().slice(0, 10);
}

/**
 * Build trigger-context sample values for live message preview in the automation builder.
 * Uses buildTestContextFromForm for trigger-aware values, then applies human-readable samples.
 * @param {object} params
 * @param {string} params.name
 * @param {string} params.triggerType
 * @param {Record<string, unknown>} params.triggerForm
 * @param {Record<string, unknown>} params.conditionForm
 * @param {Record<string, unknown>[]} params.actionRows
 * @param {string} [params.businessName] - Real workspace / branch display name
 * @returns {Record<string, unknown>}
 */
export function buildPreviewContextFromForm({
  name,
  triggerType,
  triggerForm,
  conditionForm,
  actionRows,
  businessName,
}) {
  const base = buildTestContextFromForm({
    name,
    triggerType,
    triggerForm,
    conditionForm,
    actionRows,
  });

  const formattedAmount = formatPreviewAmount(base.amount);
  const formattedBalance = formatPreviewAmount(base.balance);
  const formattedTotalSpend = formatPreviewAmount(base.totalSpend);
  const dueDateSource =
    base.dueDate ??
    (base.invoice && typeof base.invoice === 'object' ? base.invoice.dueDate : undefined) ??
    getSampleDueDateIso(triggerType, triggerForm);
  const formattedDueDate = formatPreviewDate(dueDateSource);

  return {
    ...base,
    businessName: (businessName || '').trim() || base.businessName,
    customerName: 'John Doe',
    invoiceNumber: 'INV-SAMPLE-0001',
    quoteNumber: 'QTE-SAMPLE-0001',
    productName: 'Sample Product',
    sku: 'SKU-SAMPLE',
    amount: formattedAmount,
    balance: formattedBalance,
    totalAmount: formattedAmount,
    paymentAmount: formattedAmount,
    amountPaid: formattedAmount,
    totalSpend: formattedTotalSpend,
    dueDate: formattedDueDate,
    paymentLink: 'https://pay.example.com/invoice/sample',
    reviewLink: 'https://review.example.com/sample-workspace',
    reviewUrl: 'https://review.example.com/sample-workspace',
    jobNumber: 'JOB-SAMPLE-0001',
    jobTitle: 'Sample print job',
    trackingLink: 'https://app.example.com/track-job/sample-token',
    trackingLinkLine: 'Track your order: https://app.example.com/track-job/sample-token',
    saleNumber: 'SALE-SAMPLE-0001',
    sourceNumber: 'JOB-SAMPLE-0001',
    date: formatPreviewDate(new Date()),
    periodLabel: 'yesterday',
    totalSales: formattedAmount,
    totalSalesFormatted: formattedAmount,
    transactionCount: '12',
    topProducts: 'Sample Product A (GHS 450.00), Sample Product B (GHS 320.00)',
    overdueDays: String(base.overdueDays ?? 3),
    paymentMethod: 'Mobile Money',
    paymentNumber: 'PAY-SAMPLE-001',
    lastPurchaseDaysAgo: String(base.lastPurchaseDaysAgo ?? 45),
    quantityOnHand: String(base.quantityOnHand ?? 2),
    reorderLevel: String(base.reorderLevel ?? 5),
    dateOfBirth: formatPreviewDate(base.dateOfBirth),
    email: 'john.doe@example.com',
    phone: '+233 20 123 4567',
    customer: {
      ...(base.customer && typeof base.customer === 'object' ? base.customer : {}),
      name: 'John Doe',
      email: 'john.doe@example.com',
      phone: '+233 20 123 4567',
    },
    invoice: {
      ...(base.invoice && typeof base.invoice === 'object' ? base.invoice : {}),
      dueDate: formattedDueDate,
      invoiceNumber: 'INV-SAMPLE-0001',
      balance: formattedBalance,
      totalAmount: formattedAmount,
    },
  };
}

/**
 * Resolve WhatsApp template parameters (comma-separated) for preview.
 * @param {string} parametersText
 * @param {Record<string, unknown>} context
 * @returns {string[]}
 */
export function resolveWhatsAppParametersPreview(parametersText, context = {}) {
  return String(parametersText ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((param) => resolveAutomationTemplatePreview(param, context));
}
