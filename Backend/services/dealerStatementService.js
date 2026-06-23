const { Op } = require('sequelize');
const { Dealer, DealerLedgerEntry, Shop, User } = require('../models');
const { applyTenantFilter } = require('../utils/tenantUtils');
const { roundMoney } = require('./dealerBalanceService');

/**
 * Net balance from ledger entries (debits increase, credits decrease).
 * @param {Array<{ direction: string, amount: number|string }>} entries
 * @returns {number}
 */
const netBalanceFromEntries = (entries) => {
  let balance = 0;
  for (const entry of entries) {
    balance = entry.direction === 'debit'
      ? roundMoney(balance + parseFloat(entry.amount))
      : roundMoney(balance - parseFloat(entry.amount));
  }
  return balance;
};

/**
 * Sum amounts for entries matching a predicate.
 * @param {Array<{ amount: number|string }>} entries
 * @param {(entry: object) => boolean} predicate
 * @returns {number}
 */
const sumEntryAmounts = (entries, predicate) => roundMoney(
  entries.filter(predicate).reduce((sum, entry) => sum + parseFloat(entry.amount), 0),
);

/**
 * Classify period activity for statement summary lines.
 * Opening-balance entries belong in opening balance, not total charges.
 * @param {Array<{ entryType: string, direction: string, amount: number|string }>} lines
 * @returns {{ periodOpeningBalance: number, totalCharges: number, totalPayments: number }}
 */
const summarizePeriodActivity = (lines) => {
  const periodOpeningBalance = netBalanceFromEntries(
    lines.filter((line) => line.entryType === 'opening_balance'),
  );
  const totalCharges = sumEntryAmounts(
    lines,
    (line) => line.direction === 'debit'
      && (line.entryType === 'sale_charge' || line.entryType === 'adjustment'),
  );
  const totalPayments = sumEntryAmounts(
    lines,
    (line) => line.direction === 'credit'
      && (line.entryType === 'payment' || line.entryType === 'adjustment'),
  );

  return { periodOpeningBalance, totalCharges, totalPayments };
};

/**
 * Build dealer account statement for a date range.
 * @param {object} params
 * @param {string} params.dealerId
 * @param {string} params.tenantId
 * @param {string|Date} [params.startDate]
 * @param {string|Date} [params.endDate]
 */
const getDealerStatement = async ({ dealerId, tenantId, startDate, endDate }) => {
  const dealer = await Dealer.findOne({
    where: applyTenantFilter(tenantId, { id: dealerId }),
    include: [{ model: require('../models').DealerPriceTier, as: 'priceTier', required: false }],
  });
  if (!dealer) {
    throw new Error('Dealer not found');
  }

  const rangeStart = startDate ? new Date(startDate) : null;
  const rangeEnd = endDate ? new Date(endDate) : new Date();
  if (rangeEnd) {
    rangeEnd.setHours(23, 59, 59, 999);
  }

  const priorWhere = {
    dealerId,
    tenantId,
  };
  if (rangeStart) {
    priorWhere.entryDate = { [Op.lt]: rangeStart };
  }

  const priorEntries = rangeStart
    ? await DealerLedgerEntry.findAll({
      where: priorWhere,
      attributes: ['direction', 'amount'],
      order: [['entryDate', 'ASC'], ['createdAt', 'ASC']],
    })
    : [];

  const priorOpeningBalance = netBalanceFromEntries(priorEntries);

  const activityWhere = {
    dealerId,
    tenantId,
  };
  if (rangeStart || rangeEnd) {
    activityWhere.entryDate = {};
    if (rangeStart) activityWhere.entryDate[Op.gte] = rangeStart;
    if (rangeEnd) activityWhere.entryDate[Op.lte] = rangeEnd;
  }

  const entries = await DealerLedgerEntry.findAll({
    where: activityWhere,
    include: [
      { model: Shop, as: 'shop', attributes: ['id', 'name'], required: false },
      { model: User, as: 'createdByUser', attributes: ['id', 'name'], required: false },
    ],
    order: [['entryDate', 'ASC'], ['createdAt', 'ASC']],
  });

  let runningBalance = priorOpeningBalance;
  const lines = entries.map((entry) => {
    runningBalance = entry.direction === 'debit'
      ? roundMoney(runningBalance + parseFloat(entry.amount))
      : roundMoney(runningBalance - parseFloat(entry.amount));
    return {
      id: entry.id,
      entryType: entry.entryType,
      direction: entry.direction,
      amount: roundMoney(entry.amount),
      balanceAfter: roundMoney(runningBalance),
      description: entry.description,
      entryDate: entry.entryDate,
      shop: entry.shop,
      saleId: entry.saleId,
      paymentId: entry.paymentId,
      createdByUser: entry.createdByUser,
    };
  });

  const { periodOpeningBalance, totalCharges, totalPayments } = summarizePeriodActivity(lines);
  const openingBalance = roundMoney(priorOpeningBalance + periodOpeningBalance);
  const closingBalance = lines.length > 0
    ? lines[lines.length - 1].balanceAfter
    : openingBalance;

  return {
    dealer: {
      id: dealer.id,
      businessName: dealer.businessName,
      contactName: dealer.contactName,
      phone: dealer.phone,
      email: dealer.email,
      creditTerms: dealer.creditTerms,
      creditLimit: roundMoney(dealer.creditLimit),
      balance: roundMoney(dealer.balance),
    },
    period: {
      startDate: rangeStart,
      endDate: rangeEnd,
    },
    openingBalance,
    closingBalance,
    entries: lines,
    totals: {
      debits: totalCharges,
      credits: totalPayments,
      charges: totalCharges,
      payments: totalPayments,
    },
  };
};

/**
 * Outstanding dealers report — tenant-wide receivables.
 * @param {string} tenantId
 */
const getOutstandingDealersReport = async (tenantId) => {
  const where = applyTenantFilter(tenantId, { isActive: true });

  const dealers = await Dealer.findAll({
    where,
    attributes: ['id', 'businessName', 'contactName', 'phone', 'balance', 'creditLimit', 'creditTerms'],
    order: [['balance', 'DESC']],
  });

  const rows = dealers
    .map((dealer) => ({
      id: dealer.id,
      businessName: dealer.businessName,
      contactName: dealer.contactName,
      phone: dealer.phone,
      balance: roundMoney(dealer.balance),
      creditLimit: roundMoney(dealer.creditLimit),
      creditTerms: dealer.creditTerms,
      availableCredit: roundMoney(Math.max(parseFloat(dealer.creditLimit || 0) - parseFloat(dealer.balance || 0), 0)),
      overLimit: parseFloat(dealer.creditLimit || 0) > 0
        && parseFloat(dealer.balance || 0) > parseFloat(dealer.creditLimit || 0),
    }))
    .filter((row) => row.balance > 0);

  const totalOutstanding = roundMoney(rows.reduce((sum, row) => sum + row.balance, 0));

  return {
    totalOutstanding,
    dealerCount: rows.length,
    dealers: rows,
  };
};

module.exports = {
  getDealerStatement,
  getOutstandingDealersReport,
  netBalanceFromEntries,
  summarizePeriodActivity,
};
