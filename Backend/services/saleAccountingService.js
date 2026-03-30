const accountingService = require('./accountingService');
const { getAccountByCode } = accountingService;
const { getAccountCodes } = require('../config/accountingAccountCodes');
const { JournalEntry } = require('../models');
const { Sale, SaleItem, Product } = require('../models');

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

/**
 * Create a posted journal entry for sales revenue when a sale is completed.
 * Dr Cash/Undeposited (total), Cr Revenue (subtotal - discount), Cr VAT Payable (tax).
 * Idempotent: skips if journal already exists for this sale. Ensures trial balance revenue matches total sales.
 * @param {string} tenantId - Tenant UUID
 * @param {string} saleId - Sale UUID
 * @param {string} [userId] - User who created the sale (optional)
 * @returns {Promise<Object|null>} Created journal entry or null if skipped/failed
 */
const createSaleRevenueJournal = async (tenantId, saleId, userId = null) => {
  if (!tenantId || !saleId) return null;

  const existing = await JournalEntry.findOne({
    where: { tenantId, source: 'sale_revenue', sourceId: saleId }
  });
  if (existing) return null;

  const sale = await Sale.findByPk(saleId, { 
    attributes: ['id', 'tenantId', 'saleNumber', 'total', 'subtotal', 'discount', 'tax', 'paymentMethod', 'createdAt'] 
  });
  if (!sale) return null;

  const totalAmount = parseFloat(sale.total || 0);
  const taxAmount = parseFloat(sale.tax || 0);

  // Revenue excludes VAT: cash total minus tax (works for tax-inclusive and tax-exclusive totals)
  const revenueAmount = Math.max(0, totalAmount - taxAmount);
  
  if (!totalAmount || Number.isNaN(totalAmount) || totalAmount <= 0) return null;

  const codes = await getAccountCodes(tenantId);
  const depositCode = resolveDepositAccountCode(codes, sale.paymentMethod);
  const depositAccount = await getAccountByCode(tenantId, depositCode);
  const revenueAccount = await getAccountByCode(tenantId, codes.revenue);
  const vatPayableAccount = taxAmount > 0 ? await getAccountByCode(tenantId, codes.vatPayable) : null;
  
  if (!depositAccount || !revenueAccount) return null;

  const entryDate = sale.createdAt ? new Date(sale.createdAt) : new Date();
  const description = `Sale revenue - ${sale.saleNumber || saleId}`;

  // Build journal lines: Dr Deposit (total), Cr Revenue (subtotal - discount), Cr VAT Payable (tax)
  const lines = [
    {
      accountId: depositAccount.id,
      debit: Math.round(totalAmount * 100) / 100,
      credit: 0,
      description
    },
    {
      accountId: revenueAccount.id,
      debit: 0,
      credit: Math.round(revenueAmount * 100) / 100,
      description: `Sales revenue - ${sale.saleNumber || saleId}`
    }
  ];

  // Add VAT liability line if there's tax and the account exists
  if (taxAmount > 0 && vatPayableAccount) {
    lines.push({
      accountId: vatPayableAccount.id,
      debit: 0,
      credit: Math.round(taxAmount * 100) / 100,
      description: `VAT on sale ${sale.saleNumber || saleId}`
    });
  } else if (taxAmount > 0 && !vatPayableAccount) {
    // If VAT account doesn't exist, include tax in revenue (fallback behavior)
    lines[1].credit = Math.round((revenueAmount + taxAmount) * 100) / 100;
  }

  return accountingService.createJournalEntry({
    tenantId,
    reference: sale.saleNumber || saleId,
    description,
    entryDate,
    status: 'posted',
    source: 'sale_revenue',
    sourceId: saleId,
    metadata: {
      saleId,
      revenueAmount,
      taxAmount
    },
    userId,
    lines
  });
};

/**
 * Create a posted journal entry for cost of sales when a sale is completed: Dr COGS Cr Inventory.
 * Idempotent: skips if journal already exists for this sale.
 * @param {string} tenantId - Tenant UUID
 * @param {string} saleId - Sale UUID
 * @param {string} [userId] - User who created the sale (optional)
 * @returns {Promise<Object|null>} Created journal entry or null if skipped/failed
 */
const createSaleCogsJournal = async (tenantId, saleId, userId = null) => {
  if (!tenantId || !saleId) return null;

  const existing = await JournalEntry.findOne({
    where: { tenantId, source: 'sale_cogs', sourceId: saleId }
  });
  if (existing) return null;

  const sale = await Sale.findByPk(saleId, {
    include: [
      {
        model: SaleItem,
        as: 'items',
        include: [{ model: Product, as: 'product', attributes: ['id', 'costPrice', 'trackStock'] }]
      }
    ]
  });
  if (!sale || !sale.items || sale.items.length === 0) return null;

  let totalCogs = 0;
  const lines = [];
  for (const item of sale.items) {
    const product = item.product || (await Product.findByPk(item.productId, { attributes: ['costPrice', 'trackStock'] }));
    if (!product || product.trackStock === false) continue;
    const qty = parseFloat(item.quantity || 0);
    const costPerUnit = parseFloat(product.costPrice || 0);
    const lineCogs = qty * costPerUnit;
    if (lineCogs <= 0) continue;
    totalCogs += lineCogs;
  }
  if (totalCogs <= 0) return null;

  const codes = await getAccountCodes(tenantId);
  const cogsAccount = await getAccountByCode(tenantId, codes.cogs);
  const inventoryAccount = await getAccountByCode(tenantId, codes.inventory);
  if (!cogsAccount || !inventoryAccount) return null;

  const entryDate = sale.createdAt ? new Date(sale.createdAt) : new Date();
  const description = `COGS - Sale ${sale.saleNumber || saleId}`;

  return accountingService.createJournalEntry({
    tenantId,
    reference: sale.saleNumber || saleId,
    description,
    entryDate,
    status: 'posted',
    source: 'sale_cogs',
    sourceId: saleId,
    metadata: { saleId },
    userId,
    lines: [
      {
        accountId: cogsAccount.id,
        debit: Math.round(totalCogs * 100) / 100,
        credit: 0,
        description
      },
      {
        accountId: inventoryAccount.id,
        debit: 0,
        credit: Math.round(totalCogs * 100) / 100,
        description: `Inventory - Sale ${sale.saleNumber || saleId}`
      }
    ]
  });
};

module.exports = {
  createSaleCogsJournal,
  createSaleRevenueJournal
};
