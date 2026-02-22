/**
 * Admin Report Controller
 * Platform operations data (subscription revenue, tenant metrics, growth)
 * NOT tenant customer data (invoices, expenses from tenant businesses)
 */
const { sequelize } = require('../config/database');
const { Tenant } = require('../models');
const { Op } = require('sequelize');

// Plan pricing (GHS/month) - from Paystack (config/paystackPlans.js)
const PLAN_PRICING = {
  trial: 0,
  starter: 129,
  professional: 250,
  enterprise: 0, // contact sales
  launch: 129, scale: 250 // legacy aliases for existing DB data
};

const hasDateFilter = (dateFilter) => {
  return dateFilter && (Object.keys(dateFilter).length > 0 || dateFilter[Op.between] !== undefined);
};

/**
 * Platform operations KPI summary
 * Revenue = estimated MRR from subscriptions
 * @route   GET /api/admin/reports/kpi-summary
 */
exports.getAdminKpiSummary = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    let dateFilter = {};
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter = { [Op.between]: [start, end] };
    }

    const planBreakdownRaw = await Tenant.findAll({
      where: {
        plan: { [Op.ne]: 'trial' },
        status: 'active'
      },
      attributes: [
        'plan',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['plan'],
      raw: true
    });

    const trialingCount = await Tenant.count({
      where: { plan: 'trial', status: 'active' }
    });

    const planBreakdown = planBreakdownRaw.map((row) => ({
      plan: row.plan,
      count: Number(row.count) || 0,
      price: PLAN_PRICING[row.plan] ?? 0,
      mrr: (PLAN_PRICING[row.plan] ?? 0) * (Number(row.count) || 0)
    }));

    const estimatedMRR = planBreakdown.reduce((acc, item) => acc + item.mrr, 0);
    const payingTenants = planBreakdown.reduce((acc, item) => acc + item.count, 0);

    const newTenantsInPeriod = hasDateFilter(dateFilter)
      ? await Tenant.count({
          where: { createdAt: dateFilter }
        })
      : 0;

    res.status(200).json({
      success: true,
      data: {
        totalRevenue: parseFloat(estimatedMRR),
        totalExpenses: 0,
        grossProfit: parseFloat(estimatedMRR),
        payingTenants,
        trialingTenants: trialingCount,
        newTenants: newTenantsInPeriod,
        pendingInvoices: 0
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Platform revenue trend: new tenant signups by date
 * @route   GET /api/admin/reports/revenue
 */
exports.getAdminRevenueReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    let dateFilter = {};
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter = { [Op.between]: [start, end] };
    }

    const hasDateFilterValue = hasDateFilter(dateFilter);
    const signupWhere = hasDateFilterValue ? { createdAt: dateFilter } : {};

    const signupsByDate = await Tenant.findAll({
      attributes: [
        [sequelize.literal(`CAST("createdAt" AS DATE)`), 'date'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalRevenue'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: signupWhere,
      group: [sequelize.literal(`CAST("createdAt" AS DATE)`)],
      order: [[sequelize.literal(`CAST("createdAt" AS DATE)`), 'ASC']],
      raw: true
    });

    const totalSignups = await Tenant.count({ where: signupWhere });

    res.status(200).json({
      success: true,
      data: {
        totalRevenue: totalSignups,
        byPeriod: signupsByDate.map((row) => ({
          date: row.date,
          totalRevenue: Number(row.totalRevenue) || 0,
          count: Number(row.count) || 0
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Platform expense trend (placeholder - no platform expenses tracked yet)
 * @route   GET /api/admin/reports/expenses
 */
exports.getAdminExpenseReport = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        totalExpenses: 0,
        byDate: []
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Platform pipeline: tenant signups, trials, paying
 * @route   GET /api/admin/reports/pipeline-summary
 */
exports.getAdminPipelineSummary = async (req, res, next) => {
  try {
    const [activeJobs, openLeads, payingTenants, trialingTenants, newTenantsThisMonth] = await Promise.all([
      Tenant.count({
        where: {
          plan: { [Op.ne]: 'trial' },
          status: 'active'
        }
      }),
      Tenant.count({
        where: {
          plan: 'trial',
          status: 'active'
        }
      }),
      Tenant.count({
        where: {
          plan: { [Op.ne]: 'trial' },
          status: 'active'
        }
      }),
      Tenant.count({
        where: {
          plan: 'trial',
          status: 'active'
        }
      }),
      Tenant.count({
        where: {
          createdAt: {
            [Op.gte]: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      })
    ]);

    res.status(200).json({
      success: true,
      data: {
        activeJobs: payingTenants,
        openLeads: trialingTenants,
        pendingInvoices: newTenantsThisMonth,
        payingTenants,
        trialingTenants,
        newTenantsThisMonth
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Top paying tenants by plan value
 * @route   GET /api/admin/reports/top-customers
 */
exports.getAdminTopCustomers = async (req, res, next) => {
  try {
    const { limit = 5 } = req.query;

    const payingTenants = await Tenant.findAll({
      where: {
        plan: { [Op.ne]: 'trial' },
        status: 'active'
      },
      attributes: ['id', 'name', 'slug', 'plan', 'createdAt'],
      raw: true
    });

    const data = payingTenants
      .map((t) => ({
        tenantId: t.id,
        tenant: {
          id: t.id,
          name: t.name,
          company: t.slug,
          plan: t.plan
        },
        totalRevenue: PLAN_PRICING[t.plan] ?? 0,
        paymentCount: 1
      }))
      .sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0))
      .slice(0, Number(limit) || 5);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};
