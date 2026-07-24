const { Op } = require('sequelize');
const {
  Sale,
  SaleItem,
  SaleActivity,
  SaleReturn,
  Invoice,
  Payment,
  Product,
  ProductVariant,
} = require('../models');
const { reverseAndDestroyJournalEntries } = require('./accountingService');
const { reverseAndDestroyLedgerEntriesForSale } = require('./dealerLedgerService');
const { updateCustomerBalance } = require('./customerBalanceService');

/**
 * Build Payment where-clause fragments that match rows linked to a sale or its invoices.
 * Covers sale-record payments, split-pay remnants, and credit-invoice payments.
 * @param {string} saleId
 * @param {string[]} invoiceIds
 * @returns {object[]}
 */
const buildSaleLinkedPaymentOr = (saleId, invoiceIds = []) => {
  const paymentOr = [
    { description: `sale:${saleId}` },
    { description: { [Op.like]: `sale:${saleId}%` } },
    { description: { [Op.like]: `%sale:${saleId}%` } },
  ];
  for (const invoiceId of invoiceIds) {
    if (!invoiceId) continue;
    paymentOr.push(
      { description: `invoice:${invoiceId}` },
      { description: { [Op.like]: `%invoice:${invoiceId}%` } },
    );
  }
  return paymentOr;
};

/**
 * Permanently delete a sale inside an existing transaction: restore stock (when applicable),
 * cascade-remove payments, invoices, journals, dealer ledger rows for that sale, activities, and items.
 *
 * @param {object} params
 * @param {import('../models/Sale')} params.sale - Sale instance (items should be loaded when stock restore is needed)
 * @param {string} params.tenantId
 * @param {import('sequelize').Transaction} params.transaction
 * @returns {Promise<{ invoiceIds: string[] }>}
 * @throws {{ statusCode: number, message: string }} when the sale has returns/exchanges
 *
 * @example
 * await hardDeleteSaleInTransaction({ sale, tenantId, transaction });
 */
const hardDeleteSaleInTransaction = async ({ sale, tenantId, transaction }) => {
  if (!sale || !tenantId || !transaction) {
    const err = new Error('sale, tenantId, and transaction are required for hard delete');
    err.statusCode = 500;
    throw err;
  }

  const returnCount = await SaleReturn.count({
    where: { tenantId, originalSaleId: sale.id },
    transaction,
  });
  if (returnCount > 0) {
    const err = new Error(
      'Cannot permanently delete a sale that has returns or exchanges. Remove those first, or keep the sale for audit.',
    );
    err.statusCode = 400;
    err.errorCode = 'SALE_HAS_RETURNS';
    throw err;
  }

  // Ensure items are available for stock restore (caller may have included them already).
  let items = sale.items;
  if (!items) {
    items = await SaleItem.findAll({
      where: { saleId: sale.id },
      transaction,
    });
  }

  const linkedInvoices = await Invoice.findAll({
    where: {
      tenantId,
      [Op.or]: [
        { saleId: sale.id },
        ...(sale.invoiceId ? [{ id: sale.invoiceId }] : []),
      ],
    },
    transaction,
  });
  const invoiceIds = [...new Set(linkedInvoices.map((invoice) => invoice.id).filter(Boolean))];
  const customerIds = new Set(
    [sale.customerId, ...linkedInvoices.map((invoice) => invoice.customerId)].filter(Boolean),
  );

  if (sale.status !== 'cancelled' && sale.status !== 'refunded') {
    for (const item of items || []) {
      const product = item.productId
        ? await Product.findByPk(item.productId, { transaction })
        : null;
      if (!item.productVariantId && product && product.trackStock !== false) {
        const newQuantity = parseFloat(product.quantityOnHand || 0) + parseFloat(item.quantity);
        await product.update({ quantityOnHand: newQuantity }, { transaction });
      }

      if (item.productVariantId) {
        const variant = await ProductVariant.findByPk(item.productVariantId, { transaction });
        const parent = product || (item.productId
          ? await Product.findByPk(item.productId, { transaction })
          : null);
        if (variant && parent?.trackStock !== false && variant.trackStock !== false) {
          const newVariantQuantity = parseFloat(variant.quantityOnHand || 0) + parseFloat(item.quantity);
          await variant.update({ quantityOnHand: newVariantQuantity }, { transaction });
        }
      }
    }
  }

  await reverseAndDestroyLedgerEntriesForSale({
    tenantId,
    saleId: sale.id,
    transaction,
  });

  const paymentOr = buildSaleLinkedPaymentOr(sale.id, invoiceIds);
  await Payment.destroy({
    where: {
      tenantId,
      [Op.or]: paymentOr,
    },
    transaction,
  });

  const journalSources = [
    { source: 'sale_revenue', sourceId: sale.id },
    { source: 'sale_cogs', sourceId: sale.id },
    ...invoiceIds.flatMap((invoiceId) => ([
      { source: 'invoice_revenue', sourceId: invoiceId },
      { source: 'invoice_payment', sourceId: invoiceId },
    ])),
  ];
  await reverseAndDestroyJournalEntries({
    tenantId,
    sources: journalSources,
    transaction,
  });

  if (sale.invoiceId) {
    await sale.update({ invoiceId: null }, { transaction });
  }
  for (const invoice of linkedInvoices) {
    if (invoice.saleId === sale.id) {
      await invoice.update({ saleId: null }, { transaction });
    }
    await invoice.destroy({ transaction });
  }

  for (const customerId of customerIds) {
    await updateCustomerBalance(customerId, transaction);
  }

  await SaleActivity.destroy({
    where: { saleId: sale.id },
    transaction,
  });

  await SaleItem.destroy({
    where: { saleId: sale.id },
    transaction,
  });

  await sale.destroy({ transaction });

  return { invoiceIds };
};

/**
 * Load a sale with items for hard-delete (includes soft-deleted sales).
 * @param {{ tenantId: string, saleId: string, transaction: import('sequelize').Transaction }} params
 * @returns {Promise<import('../models/Sale')|null>}
 */
const findSaleForHardDelete = async ({ tenantId, saleId, transaction }) => {
  return Sale.findOne({
    where: { tenantId, id: saleId },
    include: [
      { model: SaleItem, as: 'items' },
      { model: Invoice, as: 'invoice' },
    ],
    transaction,
  });
};

module.exports = {
  hardDeleteSaleInTransaction,
  findSaleForHardDelete,
  buildSaleLinkedPaymentOr,
};
