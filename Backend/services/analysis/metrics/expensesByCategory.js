const { Op } = require('sequelize');
const { sequelize } = require('../../../config/database');
const { Expense } = require('../../../models');
const { roundMoney } = require('../profitFormulas');
const { resolveAnalysisPeriod } = require('./dates');

/**
 * Expenses grouped by category for the analysis period.
 * Prefers approved, non-archived expenses (same as dashboard expenses-by-category).
 *
 * @param {Object} ctx
 * @returns {Promise<{
 *   periodLabel: string,
 *   totalAmount: number,
 *   categories: Array<{ category: string, count: number, totalAmount: number }>,
 * }>}
 */
async function getExpensesByCategory(ctx) {
  const range = resolveAnalysisPeriod(
    { ...ctx, defaultPeriod: 'month' },
    ctx.now
  );

  const where = {
    tenantId: ctx.tenantId,
    expenseDate: { [Op.between]: [range.start, range.end] },
    approvalStatus: 'approved',
    isArchived: false,
  };
  if (ctx.shopFilterId) where.shopId = ctx.shopFilterId;
  if (ctx.studioLocationFilterId) where.studioLocationId = ctx.studioLocationFilterId;

  const rows = await Expense.findAll({
    attributes: [
      'category',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      [sequelize.fn('SUM', sequelize.col('amount')), 'totalAmount'],
    ],
    where,
    group: ['category'],
    order: [[sequelize.fn('SUM', sequelize.col('amount')), 'DESC']],
    raw: true,
  });

  const categories = (rows || []).slice(0, 12).map((row) => ({
    category: row.category || 'Uncategorized',
    count: Number(row.count || 0),
    totalAmount: roundMoney(row.totalAmount),
  }));

  const totalAmount = roundMoney(
    categories.reduce((sum, c) => sum + (c.totalAmount || 0), 0)
  );

  return {
    periodLabel: range.label,
    totalAmount,
    categories,
  };
}

module.exports = {
  getExpensesByCategory,
};
