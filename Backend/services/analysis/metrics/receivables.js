const { Op } = require('sequelize');
const { sequelize } = require('../../../config/database');
const { Invoice, Customer } = require('../../../models');
const { roundMoney } = require('../profitFormulas');

/**
 * Receivables / who-owes metrics.
 * @param {Object} ctx
 */
async function getReceivables(ctx) {
  const today = new Date();
  const invoiceWhereBase = { tenantId: ctx.tenantId };
  if (ctx.studioLocationFilterId) {
    invoiceWhereBase.studioLocationId = ctx.studioLocationFilterId;
  }

  const [
    totalOutstandingRaw,
    overdueOutstandingRaw,
    outstandingInvoiceCount,
    topDebtorsRows,
  ] = await Promise.all([
    Invoice.sum('balance', {
      where: {
        ...invoiceWhereBase,
        balance: { [Op.gt]: 0 },
        status: { [Op.notIn]: ['paid', 'cancelled'] },
      },
    }) || 0,
    Invoice.sum('balance', {
      where: {
        ...invoiceWhereBase,
        balance: { [Op.gt]: 0 },
        dueDate: { [Op.lt]: today },
        status: { [Op.notIn]: ['paid', 'cancelled'] },
      },
    }) || 0,
    Invoice.count({
      where: {
        ...invoiceWhereBase,
        balance: { [Op.gt]: 0 },
        status: { [Op.notIn]: ['paid', 'cancelled'] },
      },
    }),
    Invoice.findAll({
      attributes: [
        [sequelize.col('Invoice.customerId'), 'customerId'],
        [sequelize.fn('SUM', sequelize.col('Invoice.balance')), 'outstanding'],
      ],
      where: {
        ...invoiceWhereBase,
        balance: { [Op.gt]: 0 },
        status: { [Op.notIn]: ['paid', 'cancelled'] },
      },
      include: [
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'name', 'company'],
        },
      ],
      group: ['Invoice.customerId', 'customer.id'],
      order: [[sequelize.literal('outstanding'), 'DESC']],
      limit: 8,
    }),
  ]);

  const totalOutstanding = roundMoney(totalOutstandingRaw);
  const overdueOutstanding = roundMoney(overdueOutstandingRaw);
  const topDebtors = (topDebtorsRows || []).map((row) => {
    const c = row.customer || {};
    return {
      customerId: row.customerId || null,
      customerName: c.company || c.name || 'Unknown customer',
      outstanding: roundMoney(row.get ? row.get('outstanding') : row.outstanding),
    };
  });

  return {
    totalOutstanding,
    overdueOutstanding,
    outstandingInvoiceCount: Number(outstandingInvoiceCount || 0),
    overdueRatioPercent:
      totalOutstanding > 0
        ? Number(((overdueOutstanding / totalOutstanding) * 100).toFixed(2))
        : 0,
    topDebtors,
  };
}

module.exports = {
  getReceivables,
};
