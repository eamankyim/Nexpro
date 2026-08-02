const { Op } = require('sequelize');
const { sequelize } = require('../../../config/database');
const { Customer, Sale, Invoice, Job, Tenant } = require('../../../models');
const { isRetailBusinessType } = require('../profitFormulas');
const { resolveAnalysisPeriod, formatDateYmd } = require('./dates');

const INACTIVE_DAYS_DEFAULT = 30;

/**
 * @param {string} tenantId
 * @returns {Promise<{ businessType: string, isRetail: boolean }>}
 */
async function resolveTenantMeta(tenantId) {
  const tenant = await Tenant.findByPk(tenantId, {
    attributes: ['id', 'businessType'],
  });
  const businessType = tenant?.businessType || 'printing_press';
  return {
    businessType,
    isRetail: isRetailBusinessType(businessType),
  };
}

/**
 * New customers created in the analysis period.
 * @param {Object} ctx
 */
async function getNewCustomers(ctx) {
  const range = resolveAnalysisPeriod(
    { ...ctx, defaultPeriod: 'month' },
    ctx.now
  );

  const where = {
    tenantId: ctx.tenantId,
    isActive: true,
    createdAt: { [Op.between]: [range.start, range.end] },
  };

  const [count, samples] = await Promise.all([
    Customer.count({ where }),
    Customer.findAll({
      where,
      attributes: ['id', 'name', 'company', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit: 8,
    }),
  ]);

  return {
    periodLabel: range.label,
    startDate: range.startDate,
    endDate: range.endDate,
    count: Number(count || 0),
    customers: (samples || []).map((c) => ({
      id: c.id,
      name: c.company || c.name || 'Customer',
      createdAt: c.createdAt,
    })),
  };
}

/**
 * Active customers with no sale / invoice / job activity in the last N days.
 * @param {Object} ctx
 * @param {{ inactiveDays?: number }} [opts]
 */
async function getInactiveCustomers(ctx, opts = {}) {
  const inactiveDays = Number(opts.inactiveDays) > 0
    ? Number(opts.inactiveDays)
    : INACTIVE_DAYS_DEFAULT;
  const meta = await resolveTenantMeta(ctx.tenantId);
  const now = ctx.now || new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - inactiveDays);
  cutoff.setHours(0, 0, 0, 0);

  const activeCustomers = await Customer.findAll({
    where: { tenantId: ctx.tenantId, isActive: true },
    attributes: ['id', 'name', 'company', 'createdAt', 'updatedAt'],
    order: [['updatedAt', 'DESC']],
    limit: 2000,
  });

  if (!activeCustomers.length) {
    return {
      inactiveDays,
      cutoffDate: formatDateYmd(cutoff),
      count: 0,
      customers: [],
      isRetail: meta.isRetail,
    };
  }

  const ids = activeCustomers.map((c) => c.id);
  const lastActivity = new Map();

  const bump = (customerId, at) => {
    if (!customerId || !at) return;
    const prev = lastActivity.get(customerId);
    const t = new Date(at).getTime();
    if (!prev || t > prev) lastActivity.set(customerId, t);
  };

  const [saleRows, invoiceRows, jobRows] = await Promise.all([
    meta.isRetail
      ? Sale.findAll({
          where: {
            tenantId: ctx.tenantId,
            customerId: { [Op.in]: ids },
            status: 'completed',
          },
          attributes: [
            'customerId',
            [sequelize.fn('MAX', sequelize.col('createdAt')), 'lastAt'],
          ],
          group: ['customerId'],
          raw: true,
        })
      : Promise.resolve([]),
    Invoice.findAll({
      where: {
        tenantId: ctx.tenantId,
        customerId: { [Op.in]: ids },
        status: { [Op.ne]: 'cancelled' },
      },
      attributes: [
        'customerId',
        [sequelize.fn('MAX', sequelize.col('createdAt')), 'lastAt'],
      ],
      group: ['customerId'],
      raw: true,
    }),
    !meta.isRetail
      ? Job.findAll({
          where: {
            tenantId: ctx.tenantId,
            customerId: { [Op.in]: ids },
          },
          attributes: [
            'customerId',
            [sequelize.fn('MAX', sequelize.col('updatedAt')), 'lastAt'],
          ],
          group: ['customerId'],
          raw: true,
        })
      : Promise.resolve([]),
  ]);

  (saleRows || []).forEach((r) => bump(r.customerId, r.lastAt));
  (invoiceRows || []).forEach((r) => bump(r.customerId, r.lastAt));
  (jobRows || []).forEach((r) => bump(r.customerId, r.lastAt));

  const cutoffMs = cutoff.getTime();
  const inactive = [];
  for (const c of activeCustomers) {
    const last = lastActivity.get(c.id);
    const fallback = new Date(c.updatedAt || c.createdAt).getTime();
    const activityMs = last != null ? last : fallback;
    if (activityMs < cutoffMs) {
      inactive.push({
        id: c.id,
        name: c.company || c.name || 'Customer',
        lastActivityAt: last != null ? new Date(last).toISOString() : null,
      });
    }
  }

  inactive.sort((a, b) => {
    const aT = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
    const bT = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
    return aT - bT;
  });

  return {
    inactiveDays,
    cutoffDate: formatDateYmd(cutoff),
    count: inactive.length,
    customers: inactive.slice(0, 10),
    isRetail: meta.isRetail,
  };
}

module.exports = {
  INACTIVE_DAYS_DEFAULT,
  getNewCustomers,
  getInactiveCustomers,
};
