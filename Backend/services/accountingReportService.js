const { Op } = require('sequelize');
const { AccountBalance, Account } = require('../models');
const { applyTenantFilter } = require('../utils/tenantUtils');
const { getAccountCodes } = require('../config/accountingAccountCodes');

/**
 * Get (fiscalYear, period) pairs that fall within [startDate, endDate].
 * period is month 1-12.
 * @returns {{ fiscalYear: number, period: number }[]}
 */
function getPeriodsInRange(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const periods = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= endMonth) {
    periods.push({ fiscalYear: cursor.getFullYear(), period: cursor.getMonth() + 1 });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return periods;
}

/**
 * Check if tenant has any posted accounting data (account balances).
 */
async function hasAccountingData(tenantId) {
  const count = await AccountBalance.count({
    where: applyTenantFilter(tenantId, {})
  });
  return count > 0;
}

/**
 * Get income & expenditure report from accounting (AccountBalance by account type).
 * Same response shape as reportController.getIncomeExpenditureReport.
 */
async function getIncomeExpenditureFromAccounting(tenantId, startDate, endDate) {
  const periods = getPeriodsInRange(startDate, endDate);
  if (periods.length === 0) {
    return {
      income: { total: 0, label: 'Income (from accounting)' },
      expenditure: { total: 0, byCategory: [] },
      surplusDeficit: 0
    };
  }

  const balances = await AccountBalance.findAll({
    attributes: ['debit', 'credit', 'balance'],
    where: {
      ...applyTenantFilter(tenantId, {}),
      [Op.or]: periods.map((p) => ({ fiscalYear: p.fiscalYear, period: p.period }))
    },
    include: [
      {
        model: Account,
        as: 'account',
        attributes: ['type', 'category'],
        where: applyTenantFilter(tenantId, {}),
        required: true
      }
    ],
    raw: false
  });

  let incomeTotal = 0;
  const expenditureByCategory = {};
  let expenditureTotal = 0;

  const typeNorm = (t) => (t ? String(t).toLowerCase() : '');
  for (const row of balances) {
    const type = typeNorm(row.account?.type);
    const category = row.account?.category || 'Uncategorized';
    const debit = parseFloat(row.debit || 0);
    const credit = parseFloat(row.credit || 0);

    if (type === 'income' || type === 'revenue') {
      incomeTotal += credit - debit;
    } else if (type === 'expense' || type === 'cogs') {
      const amount = debit - credit;
      expenditureTotal += amount;
      expenditureByCategory[category] = (expenditureByCategory[category] || 0) + amount;
    }
  }

  const byCategory = Object.entries(expenditureByCategory)
    .map(([category, amount]) => ({ category, amount, count: 0 }))
    .sort((a, b) => b.amount - a.amount);

  return {
    income: {
      total: Math.round(incomeTotal * 100) / 100,
      label: 'Income (from accounting)'
    },
    expenditure: {
      total: Math.round(expenditureTotal * 100) / 100,
      byCategory
    },
    surplusDeficit: Math.round((incomeTotal - expenditureTotal) * 100) / 100
  };
}

/**
 * Get profit & loss compliance report from accounting.
 * Same response shape as reportController.getProfitLossComplianceReport.
 */
async function getProfitLossComplianceFromAccounting(tenantId, startDate, endDate) {
  const periods = getPeriodsInRange(startDate, endDate);
  if (periods.length === 0) {
    return {
      revenue: 0,
      expenses: 0,
      grossProfit: 0,
      profitMargin: 0,
      expensesByCategory: []
    };
  }

  const balances = await AccountBalance.findAll({
    attributes: ['debit', 'credit'],
    where: {
      ...applyTenantFilter(tenantId, {}),
      [Op.or]: periods.map((p) => ({ fiscalYear: p.fiscalYear, period: p.period }))
    },
    include: [
      {
        model: Account,
        as: 'account',
        attributes: ['type', 'category'],
        where: applyTenantFilter(tenantId, {}),
        required: true
      }
    ],
    raw: false
  });

  let revenue = 0;
  let expenses = 0;
  const expensesByCategory = {};

  const typeNorm = (t) => (t ? String(t).toLowerCase() : '');
  for (const row of balances) {
    const type = typeNorm(row.account?.type);
    const category = row.account?.category || 'Uncategorized';
    const debit = parseFloat(row.debit || 0);
    const credit = parseFloat(row.credit || 0);

    if (type === 'income' || type === 'revenue') {
      revenue += credit - debit;
    } else if (type === 'expense' || type === 'cogs') {
      const amount = debit - credit;
      expenses += amount;
      expensesByCategory[category] = (expensesByCategory[category] || 0) + amount;
    }
  }

  const grossProfit = revenue - expenses;
  const profitMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const byCategory = Object.entries(expensesByCategory).map(([category, amount]) => ({
    category,
    amount: Math.round(amount * 100) / 100,
    count: 0
  })).sort((a, b) => b.amount - a.amount);

  return {
    revenue: Math.round(revenue * 100) / 100,
    expenses: Math.round(expenses * 100) / 100,
    grossProfit: Math.round(grossProfit * 100) / 100,
    profitMargin: Math.round(profitMargin * 100) / 100,
    expensesByCategory: byCategory
  };
}

/**
 * Get financial position (balance sheet) from accounting as at a given date.
 * Sums AccountBalance for all periods up to and including asAtDate.
 * Same response shape as reportController.getFinancialPositionReport.
 */
async function getFinancialPositionFromAccounting(tenantId, asAtDate) {
  const asAt = new Date(asAtDate);
  const year = asAt.getFullYear();
  const month = asAt.getMonth() + 1;

  const balances = await AccountBalance.findAll({
    attributes: ['accountId', 'balance'],
    where: {
      ...applyTenantFilter(tenantId, {}),
      [Op.or]: [
        { fiscalYear: { [Op.lt]: year } },
        { fiscalYear: year, period: { [Op.lte]: month } }
      ]
    },
    include: [
      {
        model: Account,
        as: 'account',
        attributes: ['type'],
        where: applyTenantFilter(tenantId, {}),
        required: true
      }
    ],
    raw: false
  });

  // Sum by account: we have multiple periods per account, so group by accountId and sum
  const byAccount = {};
  for (const row of balances) {
    const id = row.accountId;
    if (!byAccount[id]) byAccount[id] = { type: row.account?.type, balance: 0 };
    byAccount[id].balance += parseFloat(row.balance || 0);
  }

  const typeNorm = (t) => (t ? String(t).toLowerCase() : '');
  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;
  for (const entry of Object.values(byAccount)) {
    const bal = entry.balance;
    const t = typeNorm(entry.type);
    if (t === 'asset') totalAssets += bal;
    else if (t === 'liability') totalLiabilities -= bal;
    else if (t === 'equity') totalEquity -= bal;
  }

  const totalAssetsRounded = Math.round(totalAssets * 100) / 100;
  const totalLiabilitiesRounded = Math.round(totalLiabilities * 100) / 100;
  const totalEquityRounded = Math.round(totalEquity * 100) / 100;

  return {
    asAtDate: asAt.toISOString().split('T')[0],
    assets: {
      debtors: 0,
      receivables: 0,
      inventory: 0,
      total: totalAssetsRounded
    },
    liabilities: {
      total: totalLiabilitiesRounded
    },
    equity: {
      retainedEarnings: totalEquityRounded,
      total: totalEquityRounded
    },
    totalAssets: totalAssetsRounded,
    totalLiabilitiesAndEquity: Math.round((totalLiabilities + totalEquity) * 100) / 100
  };
}

/**
 * Get cash flow (operating) from accounting for a date range.
 * Same response shape as reportController.getCashFlowReport (operating section).
 */
async function getCashFlowFromAccounting(tenantId, startDate, endDate) {
  const data = await getIncomeExpenditureFromAccounting(tenantId, startDate, endDate);
  const operatingIn = data.income.total;
  const operatingOut = data.expenditure.total;
  const netCash = operatingIn - operatingOut;

  return {
    operating: {
      cashReceivedFromCustomers: operatingIn,
      cashPaidToSuppliersAndExpenses: operatingOut,
      netCashFromOperatingActivities: Math.round(netCash * 100) / 100
    },
    investing: { netCashUsedInInvestingActivities: 0 },
    financing: { netCashFromFinancingActivities: 0 },
    netChangeInCash: Math.round(netCash * 100) / 100
  };
}

/**
 * Get profit & loss (simple) from accounting for Overview / report type dropdown.
 * Same shape as getProfitLossReport.
 */
async function getProfitLossFromAccounting(tenantId, startDate, endDate) {
  const data = await getProfitLossComplianceFromAccounting(tenantId, startDate, endDate);
  return {
    revenue: data.revenue,
    expenses: data.expenses,
    grossProfit: data.grossProfit,
    profitMargin: data.profitMargin
  };
}

/**
 * Get opening and closing stock value from accounting (Inventory account balance).
 * @param {string} tenantId - Tenant UUID
 * @param {string|Date} startDate - Period start
 * @param {string|Date} endDate - Period end
 * @returns {Promise<{ openingStockValue: number, closingStockValue: number }>}
 */
async function getOpeningClosingStockFromAccounting(tenantId, startDate, endDate) {
  const codes = await getAccountCodes(tenantId);
  const inventoryAccount = await Account.findOne({
    where: applyTenantFilter(tenantId, { code: codes.inventory }),
    attributes: ['id']
  });
  if (!inventoryAccount) return { openingStockValue: 0, closingStockValue: 0 };

  const start = new Date(startDate);
  const end = new Date(endDate);
  const startYear = start.getFullYear();
  const startMonth = start.getMonth() + 1;
  const endYear = end.getFullYear();
  const endMonth = end.getMonth() + 1;

  const openingBalances = await AccountBalance.findAll({
    attributes: ['balance'],
    where: {
      ...applyTenantFilter(tenantId, { accountId: inventoryAccount.id }),
      [Op.or]: [
        { fiscalYear: { [Op.lt]: startYear } },
        { fiscalYear: startYear, period: { [Op.lt]: startMonth } }
      ]
    },
    raw: true
  });
  const closingBalances = await AccountBalance.findAll({
    attributes: ['balance'],
    where: {
      ...applyTenantFilter(tenantId, { accountId: inventoryAccount.id }),
      [Op.or]: [
        { fiscalYear: { [Op.lt]: endYear } },
        { fiscalYear: endYear, period: { [Op.lte]: endMonth } }
      ]
    },
    raw: true
  });

  const openingStockValue = openingBalances.reduce((sum, r) => sum + parseFloat(r.balance || 0), 0);
  const closingStockValue = closingBalances.reduce((sum, r) => sum + parseFloat(r.balance || 0), 0);

  return {
    openingStockValue: Math.round(openingStockValue * 100) / 100,
    closingStockValue: Math.round(closingStockValue * 100) / 100
  };
}

module.exports = {
  hasAccountingData,
  getIncomeExpenditureFromAccounting,
  getProfitLossComplianceFromAccounting,
  getFinancialPositionFromAccounting,
  getCashFlowFromAccounting,
  getProfitLossFromAccounting,
  getOpeningClosingStockFromAccounting
};
