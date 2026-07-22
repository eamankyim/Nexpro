const { DealerLedgerEntry } = require('../models');
const { applyBalanceChange, parseAmount } = require('./dealerBalanceService');

/**
 * Append a dealer ledger entry and update cached balance atomically.
 * @param {object} params
 * @param {import('sequelize').Transaction} [params.transaction]
 * @returns {Promise<import('../models/DealerLedgerEntry')>}
 */
const recordLedgerEntry = async ({
  tenantId,
  dealerId,
  shopId = null,
  entryType,
  direction,
  amount,
  saleId = null,
  paymentId = null,
  description = null,
  entryDate = new Date(),
  createdBy = null,
  metadata = {},
  transaction = null,
}) => {
  const normalizedAmount = parseAmount(amount);
  const { balanceAfter } = await applyBalanceChange({
    dealerId,
    direction,
    amount: normalizedAmount,
    transaction,
  });

  return DealerLedgerEntry.create({
    tenantId,
    dealerId,
    shopId,
    entryType,
    direction,
    amount: normalizedAmount,
    balanceAfter,
    saleId,
    paymentId,
    description,
    entryDate,
    createdBy,
    metadata,
  }, { transaction });
};

const recordOpeningBalance = (params) => recordLedgerEntry({
  ...params,
  entryType: 'opening_balance',
  direction: 'debit',
  description: params.description || 'Opening balance',
});

const recordSaleCharge = (params) => recordLedgerEntry({
  ...params,
  entryType: 'sale_charge',
  direction: 'debit',
  description: params.description || 'Sale charged to account',
});

const recordPayment = (params) => recordLedgerEntry({
  ...params,
  entryType: 'payment',
  direction: 'credit',
  description: params.description || 'Payment received',
});

const recordAdjustment = (params) => {
  const direction = params.direction === 'credit' ? 'credit' : 'debit';
  return recordLedgerEntry({
    ...params,
    entryType: 'adjustment',
    direction,
    description: params.description || 'Ledger adjustment',
  });
};

/**
 * Reverse dealer balance impact for ledger rows tied to a sale, then delete those rows.
 * Used when an admin permanently deletes a paid/dealer sale.
 * @param {{ tenantId: string, saleId: string, transaction: import('sequelize').Transaction }} params
 * @returns {Promise<number>}
 */
const reverseAndDestroyLedgerEntriesForSale = async ({ tenantId, saleId, transaction }) => {
  if (!tenantId || !saleId || !transaction) return 0;

  const entries = await DealerLedgerEntry.findAll({
    where: { tenantId, saleId },
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  for (const entry of entries) {
    const reverseDirection = entry.direction === 'debit' ? 'credit' : 'debit';
    await applyBalanceChange({
      dealerId: entry.dealerId,
      direction: reverseDirection,
      amount: entry.amount,
      transaction,
    });
    await entry.destroy({ transaction });
  }

  return entries.length;
};

module.exports = {
  recordLedgerEntry,
  recordOpeningBalance,
  recordSaleCharge,
  recordPayment,
  recordAdjustment,
  reverseAndDestroyLedgerEntriesForSale,
};
