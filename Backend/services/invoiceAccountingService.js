const accountingService = require('./accountingService');
const { getAccountByCode } = accountingService;
const { getAccountCodes } = require('../config/accountingAccountCodes');
const { JournalEntry } = require('../models');

const resolveDepositAccountCode = (codes, paymentMethod) => {
  if (!paymentMethod) return codes.cash;
  const normalized = String(paymentMethod).toLowerCase();
  switch (normalized) {
    case 'cash':
    case 'mobile_money':
    case 'momo':
      return codes.cash;
    case 'bank_transfer':
    case 'wire':
    case 'card':
    case 'cheque':
    case 'check':
      return codes.undeposited;
    default:
      return codes.cash;
  }
};

const createInvoicePaymentJournal = async ({
  invoice,
  amount,
  paymentDate = new Date(),
  paymentMethod = 'cash',
  referenceNumber = null,
  paymentRecordNumber = null,
  metadata = {},
  userId = null
}) => {
  if (!invoice || !invoice.id) {
    throw new Error('Invoice is required to create payment journal entry');
  }

  const paymentAmount = parseFloat(amount || 0);
  if (!paymentAmount || Number.isNaN(paymentAmount) || paymentAmount <= 0) {
    return null;
  }

  const tenantId = invoice.tenantId;
  const codes = await getAccountCodes(tenantId);
  const depositCode = resolveDepositAccountCode(codes, paymentMethod);
  const accountsReceivableAccount = await getAccountByCode(tenantId, codes.accountsReceivable);
  const depositAccount = await getAccountByCode(tenantId, depositCode);

  if (!accountsReceivableAccount || !depositAccount) {
    const missing = [];
    if (!accountsReceivableAccount) missing.push(`Accounts Receivable (${codes.accountsReceivable})`);
    if (!depositAccount) missing.push(`Deposit (${depositCode})`);
    throw new Error(`Missing required account(s): ${missing.join(', ')}`);
  }

  const description = `Payment received for invoice ${invoice.invoiceNumber || invoice.id}`;

  return accountingService.createJournalEntry({
    tenantId,
    reference: invoice.invoiceNumber || invoice.id,
    description,
    entryDate: paymentDate,
    status: 'posted',
    source: 'invoice_payment',
    sourceId: invoice.id,
    metadata: {
      ...metadata,
      invoiceId: invoice.id,
      customerId: invoice.customerId || null,
      jobId: invoice.jobId || null,
      paymentMethod,
      referenceNumber,
      paymentRecordNumber
    },
    userId,
    lines: [
      {
        accountId: depositAccount.id,
        debit: paymentAmount,
        credit: 0,
        description
      },
      {
        accountId: accountsReceivableAccount.id,
        debit: 0,
        credit: paymentAmount,
        description: `Invoice ${invoice.invoiceNumber || invoice.id} settlement`
      }
    ]
  });
};

/**
 * Create a posted journal entry for revenue recognition when an invoice is created (accrual).
 * Dr Accounts Receivable (total), Cr Revenue (subtotal), Cr VAT Payable (tax).
 * Idempotent: skips if journal already exists for this invoice.
 * @param {Object} invoice - Invoice instance with id, tenantId, totalAmount, subtotal, taxAmount, invoiceNumber, invoiceDate
 * @param {string} [userId] - User who created the invoice (optional)
 * @returns {Promise<Object|null>} Created journal entry or null if skipped/failed
 */
const createInvoiceRevenueJournal = async (invoice, userId = null) => {
  if (!invoice || !invoice.id) return null;
  const tenantId = invoice.tenantId;
  
  const totalAmount = parseFloat(invoice.totalAmount ?? 0);
  const subtotal = parseFloat(invoice.subtotal ?? totalAmount);
  const taxAmount = parseFloat(invoice.taxAmount ?? 0);
  const discountAmount = parseFloat(invoice.discountAmount ?? 0);
  
  // Revenue is subtotal minus discount (pre-tax amount)
  const revenueAmount = subtotal - discountAmount;
  
  if (!totalAmount || Number.isNaN(totalAmount) || totalAmount <= 0) return null;

  const existing = await JournalEntry.findOne({
    where: { tenantId, source: 'invoice_revenue', sourceId: invoice.id }
  });
  if (existing) return null;

  const codes = await getAccountCodes(tenantId);
  const arAccount = await getAccountByCode(tenantId, codes.accountsReceivable);
  const revenueAccount = await getAccountByCode(tenantId, codes.revenue);
  const vatPayableAccount = taxAmount > 0 ? await getAccountByCode(tenantId, codes.vatPayable) : null;
  
  if (!arAccount || !revenueAccount) return null;

  const entryDate = invoice.invoiceDate ? new Date(invoice.invoiceDate) : new Date();
  const description = `Revenue from invoice ${invoice.invoiceNumber || invoice.id}`;

  // Build journal lines: Dr AR (total), Cr Revenue (subtotal - discount), Cr VAT Payable (tax)
  const lines = [
    {
      accountId: arAccount.id,
      debit: totalAmount,
      credit: 0,
      description
    },
    {
      accountId: revenueAccount.id,
      debit: 0,
      credit: revenueAmount,
      description: `Sales revenue - ${invoice.invoiceNumber || invoice.id}`
    }
  ];

  // Add VAT liability line if there's tax and the account exists
  if (taxAmount > 0 && vatPayableAccount) {
    lines.push({
      accountId: vatPayableAccount.id,
      debit: 0,
      credit: taxAmount,
      description: `VAT on invoice ${invoice.invoiceNumber || invoice.id}`
    });
  } else if (taxAmount > 0 && !vatPayableAccount) {
    // If VAT account doesn't exist, include tax in revenue (fallback behavior)
    lines[1].credit = revenueAmount + taxAmount;
  }

  return accountingService.createJournalEntry({
    tenantId,
    reference: `INV-${invoice.invoiceNumber || invoice.id}`,
    description,
    entryDate,
    status: 'posted',
    source: 'invoice_revenue',
    sourceId: invoice.id,
    metadata: {
      invoiceId: invoice.id,
      customerId: invoice.customerId || null,
      jobId: invoice.jobId || null,
      saleId: invoice.saleId || null,
      subtotal,
      taxAmount,
      discountAmount
    },
    userId,
    lines
  });
};

module.exports = {
  createInvoicePaymentJournal,
  createInvoiceRevenueJournal
};




