import dayjs from 'dayjs';
import { STUDIO_LIKE_TYPES } from '../constants/studioLikeTypes';

export const DEFAULT_STUDIO_QUOTE_TERMS = [
  'Quotation valid for 30 days from the date of issue.',
  '20% advance payment before project commencement.',
  'Remaining payments based on agreed milestones.',
  'Three (3) months warranty included after final delivery.',
  'Third-party services such as hosting, SMS, WhatsApp API and domain registration are excluded unless stated otherwise.',
];

/**
 * @param {string|null|undefined} businessType
 * @returns {'product'|'project'}
 */
export const resolveQuoteTemplateKind = (businessType) => {
  const type = String(businessType || '').toLowerCase();
  if (type === 'shop' || type === 'pharmacy') return 'product';
  if (STUDIO_LIKE_TYPES.includes(type) || type === 'studio') return 'project';
  // Non-retail quote tenants default to project quotation
  return type ? 'project' : 'product';
};

/**
 * Split terms text into bullet lines.
 * @param {string|null|undefined} text
 * @returns {string[]}
 */
export const splitTermsIntoBullets = (text) => {
  if (!text || !String(text).trim()) return [];
  return String(text)
    .split(/\r?\n|•|;/)
    .map((line) => line.replace(/^[-*\d.)\s]+/, '').trim())
    .filter(Boolean);
};

/**
 * Build a config-driven print model for quotations.
 * @param {object} quote
 * @param {object} [options]
 * @param {string} [options.businessType]
 * @param {object} [options.organization]
 * @returns {object|null}
 */
export function buildQuotePrintModel(quote, options = {}) {
  if (!quote) return null;

  const businessType = options.businessType || options.organization?.businessType || '';
  const templateKind = resolveQuoteTemplateKind(businessType);
  const organization = options.organization || {};
  const isProject = templateKind === 'project';

  const subtotal = parseFloat(quote.subtotal || 0);
  const discountTotal = parseFloat(quote.discountTotal || 0);
  const taxAmount = parseFloat(quote.taxAmount || 0);
  const taxRate = parseFloat(quote.taxRate || 0);
  const totalAmount = parseFloat(quote.totalAmount || 0);

  const scopeOfWork = String(quote.scopeOfWork || quote.description || '').trim();
  const termsRaw = String(
    quote.termsAndConditions
    || quote.notes
    || organization.defaultTermsAndConditions
    || ''
  ).trim();
  const termsBullets = splitTermsIntoBullets(termsRaw);
  const effectiveTermsBullets = termsBullets.length
    ? termsBullets
    : (isProject ? DEFAULT_STUDIO_QUOTE_TERMS : []);

  const paymentSchedule = (Array.isArray(quote.paymentSchedule) ? quote.paymentSchedule : [])
    .map((row) => ({
      label: String(row?.label || '').trim(),
      amount: row?.amount != null && row.amount !== '' ? Number(row.amount) : null,
      percent: row?.percent != null && row.percent !== '' ? Number(row.percent) : null,
    }))
    .filter((row) => row.label);

  const showClientAcceptance = isProject && quote.showClientAcceptance !== false;

  const items = (quote.items || []).map((item) => {
    const quantity = parseFloat(item.quantity || 0);
    const unitPrice = parseFloat(item.unitPrice || 0);
    const discountAmount = parseFloat(item.discountAmount || 0);
    const total = parseFloat(
      item.total != null ? item.total : (quantity * unitPrice) - discountAmount
    );
    return {
      ...item,
      description: item.description || '',
      quantity,
      unitPrice,
      discountAmount,
      total,
      productCode: item.product?.sku || item.product?.productCode || item.productCode || item.metadata?.productCode || '',
    };
  });

  return {
    templateKind,
    documentTitle: isProject ? 'QUOTATION' : 'PROFORMA INVOICE',
    documentSubtitle: isProject ? null : `Quote ${quote.quoteNumber}`,
    sections: {
      projectSummary: isProject && Boolean(String(quote.title || '').trim() || String(quote.description || '').trim()),
      items: {
        showProductCode: !isProject,
        qtyLabel: 'Qty',
        rateLabel: isProject ? 'Rate' : 'Unit Price',
        amountLabel: 'Amount',
      },
      totals: {
        showBalanceDue: false,
        projectCostLabel: isProject ? 'Project Cost' : 'Subtotal',
        grandTotalLabel: 'Grand Total',
      },
      scopeOfWork: isProject && Boolean(scopeOfWork),
      terms: effectiveTermsBullets.length > 0,
      paymentSchedule: isProject && paymentSchedule.length > 0,
      clientAcceptance: showClientAcceptance,
      jobDetails: false,
    },
    data: {
      quoteNumber: quote.quoteNumber,
      status: quote.status,
      title: quote.title || '',
      description: quote.description || '',
      createdAt: quote.createdAt,
      validUntil: quote.validUntil,
      customer: quote.customer || null,
      items,
      subtotal,
      discountTotal,
      discountReason: quote.discountReason || '',
      taxAmount,
      taxRate,
      totalAmount,
      scopeOfWork,
      termsBullets: effectiveTermsBullets,
      paymentSchedule,
      showClientAcceptance,
      notes: quote.notes || '',
    },
    // Legacy invoice-shaped payload for product PrintableInvoice path
    invoicePayload: {
      ...quote,
      invoiceNumber: quote.quoteNumber,
      invoiceDate: quote.createdAt || quote.updatedAt || new Date(),
      dueDate: quote.validUntil || quote.createdAt || new Date(),
      subtotal,
      taxAmount,
      taxRate,
      discountAmount: discountTotal,
      discountType: 'fixed',
      discountValue: discountTotal,
      totalAmount,
      amountPaid: 0,
      balance: totalAmount,
      termsAndConditions: termsRaw || effectiveTermsBullets.join('\n'),
      items,
      job: null,
      paymentTerms: null,
    },
    meta: {
      dateLabel: dayjs(quote.createdAt || new Date()).format('MMMM D, YYYY'),
      validUntilLabel: quote.validUntil
        ? dayjs(quote.validUntil).format('MMMM D, YYYY')
        : null,
      statusLabel: quote.status
        ? String(quote.status).charAt(0).toUpperCase() + String(quote.status).slice(1)
        : null,
    },
  };
}
