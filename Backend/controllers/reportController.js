const { sequelize } = require('../config/database');
const { Job, Expense, Customer, Vendor, Invoice, JobItem, Lead } = require('../models');
const { Op } = require('sequelize');
const { applyTenantFilter } = require('../utils/tenantUtils');

// @desc    Get revenue report
// @route   GET /api/reports/revenue
// @access  Private
exports.getRevenueReport = async (req, res, next) => {
  try {
    console.log('[Revenue Report] Starting revenue report generation');
    console.log('[Revenue Report] Tenant ID:', req.tenantId);
    const { startDate, endDate, groupBy = 'day' } = req.query;
    console.log('[Revenue Report] Query params:', { startDate, endDate, groupBy });
    
    let dateFilter = {};
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter = {
        [Op.between]: [start, end]
      };
      console.log('[Revenue Report] Date filter applied:', { start, end });
    } else {
      console.log('[Revenue Report] No date filter - fetching all data');
    }

    // Revenue by time period - using Invoice.amountPaid and Invoice.paidDate (same as Dashboard)
    // Support multiple grouping: hour (2-hour intervals), day, week, month
    let revenueByPeriod = [];
    console.log('[Revenue Report] Fetching revenue by period, groupBy:', groupBy);
    
    if (groupBy === 'hour') {
      // Group by 2-hour intervals (0-2, 2-4, 4-6, ..., 22-24)
      try {
        revenueByPeriod = await sequelize.query(`
          SELECT 
            FLOOR(EXTRACT(HOUR FROM "paidDate") / 2) * 2 as "hour",
            SUM("amountPaid") as "totalRevenue",
            COUNT("id") as "count"
          FROM "invoices"
          WHERE "tenantId" = :tenantId
            AND "status" = 'paid'
            ${Object.keys(dateFilter).length > 0 ? `AND "paidDate" BETWEEN :startDate AND :endDate` : ''}
          GROUP BY FLOOR(EXTRACT(HOUR FROM "paidDate") / 2) * 2
          ORDER BY FLOOR(EXTRACT(HOUR FROM "paidDate") / 2) * 2 ASC
        `, {
          replacements: {
            tenantId: req.tenantId,
            ...(Object.keys(dateFilter).length > 0 && {
              startDate: dateFilter[Op.between][0],
              endDate: dateFilter[Op.between][1]
            })
          },
          type: sequelize.QueryTypes.SELECT
        });
        console.log('[Revenue Report] Revenue by period (hour - 2hr intervals) fetched:', revenueByPeriod.length, 'records');
      } catch (periodError) {
        console.error('[Revenue Report] Error fetching revenue by period (hour):', periodError);
        throw periodError;
      }
    } else if (groupBy === 'day') {
      try {
        revenueByPeriod = await Invoice.findAll({
        attributes: [
          [sequelize.literal(`CAST("paidDate" AS DATE)`), 'date'],
          [sequelize.fn('SUM', sequelize.literal('"Invoice"."amountPaid"')), 'totalRevenue'],
          [sequelize.fn('COUNT', sequelize.literal('"Invoice"."id"')), 'count']
        ],
          where: applyTenantFilter(req.tenantId, {
            status: 'paid',
            ...(Object.keys(dateFilter).length > 0 && { paidDate: dateFilter })
          }),
          group: [sequelize.literal(`CAST("paidDate" AS DATE)`)],
          order: [[sequelize.literal(`CAST("paidDate" AS DATE)`), 'ASC']],
          raw: true
        });
        console.log('[Revenue Report] Revenue by period (day) fetched:', revenueByPeriod.length, 'records');
      } catch (periodError) {
        console.error('[Revenue Report] Error fetching revenue by period (day):', periodError);
        throw periodError;
      }
    } else if (groupBy === 'week') {
      // Group by week number within the month
      try {
        revenueByPeriod = await sequelize.query(`
          SELECT 
            EXTRACT(WEEK FROM "paidDate") - EXTRACT(WEEK FROM DATE_TRUNC('month', "paidDate")) + 1 as "week",
            DATE_TRUNC('month', "paidDate") as "month",
            SUM("amountPaid") as "totalRevenue",
            COUNT("id") as "count"
          FROM "invoices"
          WHERE "tenantId" = :tenantId
            AND "status" = 'paid'
            ${Object.keys(dateFilter).length > 0 ? `AND "paidDate" BETWEEN :startDate AND :endDate` : ''}
          GROUP BY EXTRACT(WEEK FROM "paidDate") - EXTRACT(WEEK FROM DATE_TRUNC('month', "paidDate")) + 1, DATE_TRUNC('month', "paidDate")
          ORDER BY DATE_TRUNC('month', "paidDate") ASC, "week" ASC
        `, {
          replacements: {
            tenantId: req.tenantId,
            ...(Object.keys(dateFilter).length > 0 && {
              startDate: dateFilter[Op.between][0],
              endDate: dateFilter[Op.between][1]
            })
          },
          type: sequelize.QueryTypes.SELECT
        });
        console.log('[Revenue Report] Revenue by period (week) fetched:', revenueByPeriod.length, 'records');
      } catch (periodError) {
        console.error('[Revenue Report] Error fetching revenue by period (week):', periodError);
        throw periodError;
      }
    } else if (groupBy === 'month') {
      try {
        revenueByPeriod = await Invoice.findAll({
        attributes: [
          [sequelize.fn('EXTRACT', sequelize.literal('MONTH FROM "paidDate"')), 'month'],
          [sequelize.fn('EXTRACT', sequelize.literal('YEAR FROM "paidDate"')), 'year'],
          [sequelize.fn('SUM', sequelize.literal('"Invoice"."amountPaid"')), 'totalRevenue'],
          [sequelize.fn('COUNT', sequelize.literal('"Invoice"."id"')), 'count']
        ],
          where: applyTenantFilter(req.tenantId, {
            status: 'paid',
            ...(Object.keys(dateFilter).length > 0 && { paidDate: dateFilter })
          }),
          group: [
            sequelize.fn('EXTRACT', sequelize.literal('YEAR FROM "paidDate"')),
            sequelize.fn('EXTRACT', sequelize.literal('MONTH FROM "paidDate"'))
          ],
          order: [
            [sequelize.fn('EXTRACT', sequelize.literal('YEAR FROM "paidDate"')), 'ASC'],
            [sequelize.fn('EXTRACT', sequelize.literal('MONTH FROM "paidDate"')), 'ASC']
          ],
          raw: true
        });
        console.log('[Revenue Report] Revenue by period (month) fetched:', revenueByPeriod.length, 'records');
      } catch (periodError) {
        console.error('[Revenue Report] Error fetching revenue by period (month):', periodError);
        throw periodError;
      }
    }

    // Revenue by customer
    console.log('[Revenue Report] Fetching revenue by customer');
    let revenueByCustomer = [];
    try {
      revenueByCustomer = await Invoice.findAll({
        attributes: [
          'customerId',
          [sequelize.fn('SUM', sequelize.literal('"Invoice"."amountPaid"')), 'totalRevenue'],
          [sequelize.fn('COUNT', sequelize.literal('"Invoice"."id"')), 'paymentCount']
        ],
        where: applyTenantFilter(req.tenantId, {
          status: 'paid',
          ...(Object.keys(dateFilter).length > 0 && { paidDate: dateFilter })
        }),
        include: [{
          model: Customer,
          as: 'customer',
          attributes: ['id', 'name', 'company', 'email']
        }],
        group: ['customerId', 'customer.id'],
        order: [[sequelize.fn('SUM', sequelize.literal('"Invoice"."amountPaid"')), 'DESC']],
        limit: 20
      });
      console.log('[Revenue Report] Revenue by customer fetched:', revenueByCustomer.length, 'customers');
    } catch (customerError) {
      console.error('[Revenue Report] Error fetching revenue by customer:', customerError);
      throw customerError;
    }

    // Revenue by payment method - using Invoice.paymentMethod if available, otherwise skip
    console.log('[Revenue Report] Fetching revenue by payment method');
    let revenueByMethod = [];
    try {
      revenueByMethod = await Invoice.findAll({
        attributes: [
          'paymentMethod',
          [sequelize.fn('SUM', sequelize.literal('"Invoice"."amountPaid"')), 'totalRevenue'],
          [sequelize.fn('COUNT', sequelize.literal('"Invoice"."id"')), 'count']
        ],
        where: applyTenantFilter(req.tenantId, {
          status: 'paid',
          ...(Object.keys(dateFilter).length > 0 && { paidDate: dateFilter })
        }),
        group: ['paymentMethod'],
        order: [[sequelize.fn('SUM', sequelize.literal('"Invoice"."amountPaid"')), 'DESC']],
        raw: true
      });
      console.log('[Revenue Report] Revenue by payment method fetched:', revenueByMethod.length, 'methods');
    } catch (methodError) {
      console.error('[Revenue Report] Error fetching revenue by payment method:', methodError);
      // Don't throw - make it optional
      revenueByMethod = [];
    }

    // Total revenue - using Invoice.sum('amountPaid') where status = 'paid' (same as Dashboard)
    console.log('[Revenue Report] Calculating total revenue (same method as Dashboard)');
    const totalRevenue = await Invoice.sum('amountPaid', {
      where: applyTenantFilter(req.tenantId, {
        status: 'paid',
        ...(Object.keys(dateFilter).length > 0 && { paidDate: dateFilter })
      })
    }) || 0;
    console.log('[Revenue Report] Total revenue:', totalRevenue, '(from Invoice.amountPaid where status = paid)');

    const responseData = {
      totalRevenue: parseFloat(totalRevenue),
      byPeriod: revenueByPeriod,
      byCustomer: revenueByCustomer,
      byMethod: revenueByMethod
    };
    console.log('[Revenue Report] Response data summary:', {
      totalRevenue: responseData.totalRevenue,
      byPeriodCount: responseData.byPeriod.length,
      byCustomerCount: responseData.byCustomer.length,
      byMethodCount: responseData.byMethod.length
    });

    res.status(200).json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('[Revenue Report] ERROR:', error.message);
    console.error('[Revenue Report] Stack:', error.stack);
    console.error('[Revenue Report] Full error:', error);
    next(error);
  }
};

// @desc    Get expense report
// @route   GET /api/reports/expenses
// @access  Private
exports.getExpenseReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    let dateFilter = {};
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter = {
        [Op.between]: [start, end]
      };
    }

    // Expenses by category
    const expensesByCategory = await Expense.findAll({
      attributes: [
        'category',
        [sequelize.fn('SUM', sequelize.col('amount')), 'totalAmount'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: applyTenantFilter(req.tenantId, {
        ...(Object.keys(dateFilter).length > 0 && { expenseDate: dateFilter })
      }),
      group: ['category'],
      order: [[sequelize.fn('SUM', sequelize.col('amount')), 'DESC']]
    });

    // Expenses by vendor
    const expensesByVendor = await Expense.findAll({
      attributes: [
        'vendorId',
        [sequelize.fn('SUM', sequelize.literal('"Expense"."amount"')), 'totalAmount'],
        [sequelize.fn('COUNT', sequelize.literal('"Expense"."id"')), 'count']
      ],
      where: applyTenantFilter(req.tenantId, {
        ...(Object.keys(dateFilter).length > 0 && { expenseDate: dateFilter })
      }),
      include: [{
        model: Vendor,
        as: 'vendor',
        attributes: ['id', 'name', 'company', 'email']
      }],
      group: ['vendorId', 'vendor.id'],
      order: [[sequelize.fn('SUM', sequelize.literal('"Expense"."amount"')), 'DESC']],
      limit: 20
    });

    // Expenses by payment method
    const expensesByMethod = await Expense.findAll({
      attributes: [
        'paymentMethod',
        [sequelize.fn('SUM', sequelize.col('amount')), 'totalAmount'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: applyTenantFilter(req.tenantId, {
        ...(Object.keys(dateFilter).length > 0 && { expenseDate: dateFilter })
      }),
      group: ['paymentMethod'],
      order: [[sequelize.fn('SUM', sequelize.col('amount')), 'DESC']]
    });

    // Expenses by date
    const expensesByDate = await Expense.findAll({
      attributes: [
        [sequelize.literal(`CAST("expenseDate" AS DATE)`), 'date'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'totalAmount'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: applyTenantFilter(req.tenantId, {
        ...(Object.keys(dateFilter).length > 0 && { expenseDate: dateFilter })
      }),
      group: [sequelize.literal(`CAST("expenseDate" AS DATE)`)],
      order: [[sequelize.literal(`CAST("expenseDate" AS DATE)`), 'ASC']],
      raw: true
    });

    // Total expenses
    const totalExpenses = await Expense.sum('amount', {
      where: applyTenantFilter(req.tenantId, {
        ...(Object.keys(dateFilter).length > 0 && { expenseDate: dateFilter })
      })
    }) || 0;

    res.status(200).json({
      success: true,
      data: {
        totalExpenses: parseFloat(totalExpenses),
        byCategory: expensesByCategory,
        byVendor: expensesByVendor,
        byMethod: expensesByMethod,
        byDate: expensesByDate
      }
    });
  } catch (error) {
    console.error('Error in getRevenueReport:', error);
    next(error);
  }
};

// @desc    Get outstanding payments report
// @route   GET /api/reports/outstanding-payments
// @access  Private
exports.getOutstandingPaymentsReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    let dateFilter = {};
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter = {
        [Op.between]: [start, end]
      };
    }

    // Outstanding invoices
    const outstandingInvoices = await Invoice.findAll({
      where: applyTenantFilter(req.tenantId, {
        status: { [Op.in]: ['sent', 'partial', 'overdue'] },
        balance: { [Op.gt]: 0 },
        ...(Object.keys(dateFilter).length > 0 && { invoiceDate: dateFilter })
      }),
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'company', 'email', 'phone'] },
        { model: Job, as: 'job', attributes: ['id', 'jobNumber', 'title'] }
      ],
      order: [['dueDate', 'ASC']]
    });

    // Outstanding by customer
    const outstandingByCustomer = await Invoice.findAll({
      attributes: [
        'customerId',
        [sequelize.fn('SUM', sequelize.literal('"Invoice"."balance"')), 'totalOutstanding'],
        [sequelize.fn('COUNT', sequelize.literal('"Invoice"."id"')), 'invoiceCount']
      ],
      where: applyTenantFilter(req.tenantId, {
        status: { [Op.in]: ['sent', 'partial', 'overdue'] },
        balance: { [Op.gt]: 0 },
        ...(Object.keys(dateFilter).length > 0 && { invoiceDate: dateFilter })
      }),
      include: [{
        model: Customer,
        as: 'customer',
        attributes: ['id', 'name', 'company', 'email']
      }],
      group: ['customerId', 'customer.id'],
      order: [[sequelize.fn('SUM', sequelize.literal('"Invoice"."balance"')), 'DESC']]
    });

    // Aging analysis
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const sixtyDaysAgo = new Date(today);
    sixtyDaysAgo.setDate(today.getDate() - 60);
    const ninetyDaysAgo = new Date(today);
    ninetyDaysAgo.setDate(today.getDate() - 90);

    const agingAnalysis = {
      current: await Invoice.sum('balance', {
        where: applyTenantFilter(req.tenantId, {
          status: { [Op.in]: ['sent', 'partial', 'overdue'] },
          dueDate: { [Op.gte]: today }
        })
      }) || 0,
      thirtyDays: await Invoice.sum('balance', {
        where: applyTenantFilter(req.tenantId, {
          status: { [Op.in]: ['sent', 'partial', 'overdue'] },
          dueDate: { [Op.between]: [thirtyDaysAgo, today] }
        })
      }) || 0,
      sixtyDays: await Invoice.sum('balance', {
        where: applyTenantFilter(req.tenantId, {
          status: { [Op.in]: ['sent', 'partial', 'overdue'] },
          dueDate: { [Op.between]: [sixtyDaysAgo, thirtyDaysAgo] }
        })
      }) || 0,
      ninetyPlusDays: await Invoice.sum('balance', {
        where: applyTenantFilter(req.tenantId, {
          status: { [Op.in]: ['sent', 'partial', 'overdue'] },
          dueDate: { [Op.lt]: sixtyDaysAgo }
        })
      }) || 0
    };

    // Total outstanding
    const totalOutstanding = await Invoice.sum('balance', {
      where: applyTenantFilter(req.tenantId, {
        status: { [Op.in]: ['sent', 'partial', 'overdue'] },
        balance: { [Op.gt]: 0 },
        ...(Object.keys(dateFilter).length > 0 && { invoiceDate: dateFilter })
      })
    }) || 0;

    res.status(200).json({
      success: true,
      data: {
        totalOutstanding: parseFloat(totalOutstanding),
        invoices: outstandingInvoices,
        byCustomer: outstandingByCustomer,
        agingAnalysis: {
          current: parseFloat(agingAnalysis.current),
          thirtyDays: parseFloat(agingAnalysis.thirtyDays),
          sixtyDays: parseFloat(agingAnalysis.sixtyDays),
          ninetyPlusDays: parseFloat(agingAnalysis.ninetyPlusDays)
        }
      }
    });
  } catch (error) {
    console.error('Error in getRevenueReport:', error);
    next(error);
  }
};

// @desc    Get sales report
// @route   GET /api/reports/sales
// @access  Private
exports.getSalesReport = async (req, res, next) => {
  try {
    const { startDate, endDate, groupBy = 'category' } = req.query;
    
    let dateFilter = {};
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter = {
        [Op.between]: [start, end]
      };
    }

    // Sales by category - using JobItem.category (more accurate than jobType)
    let salesByCategory;
    if (Object.keys(dateFilter).length > 0) {
      salesByCategory = await sequelize.query(`
        SELECT 
          "JobItem"."category",
          SUM("JobItem"."totalPrice") as "totalSales",
          SUM("JobItem"."quantity") as "totalQuantity",
          COUNT("JobItem"."id") as "itemCount",
          AVG("JobItem"."unitPrice") as "averagePrice"
        FROM "job_items" AS "JobItem"
        INNER JOIN "jobs" AS "job" ON "JobItem"."jobId" = "job"."id"
        WHERE "JobItem"."tenantId" = :tenantId
          AND "job"."createdAt" BETWEEN :startDate AND :endDate
        GROUP BY "JobItem"."category"
        ORDER BY SUM("JobItem"."totalPrice") DESC
      `, {
        replacements: {
          tenantId: req.tenantId,
          startDate: dateFilter[Op.between][0],
          endDate: dateFilter[Op.between][1]
        },
        type: sequelize.QueryTypes.SELECT
      });
    } else {
      salesByCategory = await sequelize.query(`
        SELECT 
          "JobItem"."category",
          SUM("JobItem"."totalPrice") as "totalSales",
          SUM("JobItem"."quantity") as "totalQuantity",
          COUNT("JobItem"."id") as "itemCount",
          AVG("JobItem"."unitPrice") as "averagePrice"
        FROM "job_items" AS "JobItem"
        INNER JOIN "jobs" AS "job" ON "JobItem"."jobId" = "job"."id"
        WHERE "JobItem"."tenantId" = :tenantId
        GROUP BY "JobItem"."category"
        ORDER BY SUM("JobItem"."totalPrice") DESC
      `, {
        replacements: {
          tenantId: req.tenantId
        },
        type: sequelize.QueryTypes.SELECT
      });
    }

    // Map to match frontend expectations (byJobType -> byCategory)
    const salesByJobType = salesByCategory.map(item => ({
      jobType: item.category,
      category: item.category,
      totalSales: parseFloat(item.totalSales || 0),
      jobCount: parseInt(item.itemCount || 0),
      totalQuantity: parseFloat(item.totalQuantity || 0),
      averagePrice: parseFloat(item.averagePrice || 0)
    }));

    // Sales by customer
    const salesByCustomer = await Job.findAll({
      attributes: [
        'customerId',
        [sequelize.fn('SUM', sequelize.literal('"Job"."finalPrice"')), 'totalSales'],
        [sequelize.fn('COUNT', sequelize.literal('"Job"."id"')), 'jobCount']
      ],
      where: applyTenantFilter(req.tenantId, {
        ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
      }),
      include: [{
        model: Customer,
        as: 'customer',
        attributes: ['id', 'name', 'company', 'email']
      }],
      group: ['customerId', 'customer.id'],
      order: [[sequelize.fn('SUM', sequelize.literal('"Job"."finalPrice"')), 'DESC']],
      limit: 20
    });

    // Sales by date
    const salesByDate = await Job.findAll({
      attributes: [
        [sequelize.literal(`CAST("createdAt" AS DATE)`), 'date'],
        [sequelize.fn('SUM', sequelize.col('finalPrice')), 'totalSales'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'jobCount']
      ],
      where: applyTenantFilter(req.tenantId, {
        ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
      }),
      group: [sequelize.literal(`CAST("createdAt" AS DATE)`)],
      order: [[sequelize.literal(`CAST("createdAt" AS DATE)`), 'ASC']],
      raw: true
    });

    // Sales by status
    const salesByStatus = await Job.findAll({
      attributes: [
        'status',
        [sequelize.fn('SUM', sequelize.col('finalPrice')), 'totalSales'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'jobCount']
      ],
      where: applyTenantFilter(req.tenantId, {
        ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
      }),
      group: ['status'],
      order: [[sequelize.fn('SUM', sequelize.col('finalPrice')), 'DESC']]
    });

    // Total sales
    const totalSales = await Job.sum('finalPrice', {
      where: applyTenantFilter(req.tenantId, {
        ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
      })
    }) || 0;

    // Total jobs count
    const totalJobs = await Job.count({
      where: applyTenantFilter(req.tenantId, {
        ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
      })
    }) || 0;

    res.status(200).json({
      success: true,
      data: {
        totalSales: parseFloat(totalSales),
        totalJobs: totalJobs,
        byJobType: salesByJobType,
        byCustomer: salesByCustomer,
        byDate: salesByDate,
        byStatus: salesByStatus,
        byPeriod: salesByDate // Add byPeriod alias for frontend compatibility
      }
    });
  } catch (error) {
    console.error('Error in getRevenueReport:', error);
    next(error);
  }
};

// @desc    Get profit & loss report
// @route   GET /api/reports/profit-loss
// @access  Private
exports.getProfitLossReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    let dateFilter = {};
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter = {
        [Op.between]: [start, end]
      };
    }

    // Revenue
    const revenue = await Invoice.sum('amountPaid', {
      where: applyTenantFilter(req.tenantId, {
        status: 'paid',
        ...(Object.keys(dateFilter).length > 0 && { paidDate: dateFilter })
      })
    }) || 0;

    // Expenses
    const expenses = await Expense.sum('amount', {
      where: applyTenantFilter(req.tenantId, {
        ...(Object.keys(dateFilter).length > 0 && { expenseDate: dateFilter })
      })
    }) || 0;

    // Gross profit
    const grossProfit = revenue - expenses;

    // Profit margin
    const profitMargin = revenue > 0 ? ((grossProfit / revenue) * 100) : 0;

    res.status(200).json({
      success: true,
      data: {
        revenue: parseFloat(revenue),
        expenses: parseFloat(expenses),
        grossProfit: parseFloat(grossProfit),
        profitMargin: parseFloat(profitMargin.toFixed(2))
      }
    });
  } catch (error) {
    console.error('Error in getRevenueReport:', error);
    next(error);
  }
};

exports.getKpiSummary = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    let dateFilter = {};
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter = {
        [Op.between]: [start, end]
      };
    }

    const totalRevenue = await Invoice.sum('amountPaid', {
      where: applyTenantFilter(req.tenantId, {
        status: 'paid',
        ...(Object.keys(dateFilter).length > 0 && { paidDate: dateFilter })
      })
    }) || 0;

    const totalExpenses = await Expense.sum('amount', {
      where: applyTenantFilter(req.tenantId, {
        ...(Object.keys(dateFilter).length > 0 && { expenseDate: dateFilter })
      })
    }) || 0;

    const activeCustomers = await Customer.count({
      where: applyTenantFilter(req.tenantId, {
        isActive: true
      })
    });

    const pendingInvoices = await Invoice.sum('balance', {
      where: applyTenantFilter(req.tenantId, {
        status: { [Op.in]: ['sent', 'partial', 'overdue'] },
        balance: { [Op.gt]: 0 },
        ...(Object.keys(dateFilter).length > 0 && { invoiceDate: dateFilter })
      })
    }) || 0;

    res.status(200).json({
      success: true,
      data: {
        totalRevenue: parseFloat(totalRevenue),
        totalExpenses: parseFloat(totalExpenses),
        grossProfit: parseFloat(totalRevenue - totalExpenses),
        activeCustomers,
        pendingInvoices: parseFloat(pendingInvoices)
      }
    });
  } catch (error) {
    console.error('Error in getRevenueReport:', error);
    next(error);
  }
};

exports.getTopCustomers = async (req, res, next) => {
  try {
    const { startDate, endDate, limit = 5 } = req.query;

    let dateFilter = {};
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter = {
        [Op.between]: [start, end]
      };
    }

    const customers = await Invoice.findAll({
      attributes: [
        'customerId',
        [sequelize.fn('SUM', sequelize.literal('"Invoice"."amountPaid"')), 'totalRevenue'],
        [sequelize.fn('COUNT', sequelize.literal('"Invoice"."id"')), 'paymentCount']
      ],
      where: applyTenantFilter(req.tenantId, {
        status: 'paid',
        ...(Object.keys(dateFilter).length > 0 && { paidDate: dateFilter })
      }),
      include: [
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'name', 'company', 'email']
        }
      ],
      group: ['customerId', 'customer.id'],
      order: [[sequelize.fn('SUM', sequelize.literal('"Invoice"."amountPaid"')), 'DESC']],
      limit: Number(limit)
    });

    res.status(200).json({
      success: true,
      data: customers
    });
  } catch (error) {
    console.error('Error in getRevenueReport:', error);
    next(error);
  }
};

exports.getPipelineSummary = async (req, res, next) => {
  try {
    const activeJobs = await Job.count({
      where: applyTenantFilter(req.tenantId, {
        status: { [Op.notIn]: ['completed', 'cancelled'] },
      })
    });

    const openLeads = await Lead.count({
      where: applyTenantFilter(req.tenantId, {
        status: { [Op.notIn]: ['closed_won', 'closed_lost'] },
        isActive: true
      })
    });

    const pendingInvoices = await Invoice.count({
      where: applyTenantFilter(req.tenantId, {
        status: { [Op.in]: ['sent', 'partial'] },
        balance: { [Op.gt]: 0 }
      })
    });

    res.status(200).json({
      success: true,
      data: {
        activeJobs,
        openLeads,
        pendingInvoices
      }
    });
  } catch (error) {
    console.error('Error in getRevenueReport:', error);
    next(error);
  }
};

// @desc    Get service analytics report (by category from JobItems)
// @route   GET /api/reports/service-analytics
// @access  Private
exports.getServiceAnalyticsReport = async (req, res, next) => {
  try {
    console.log('[Service Analytics] Starting service analytics report generation');
    console.log('[Service Analytics] Tenant ID:', req.tenantId);
    const { startDate, endDate } = req.query;
    console.log('[Service Analytics] Query params:', { startDate, endDate });
    
    let dateFilter = {};
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter = {
        [Op.between]: [start, end]
      };
      console.log('[Service Analytics] Date filter applied:', { start, end });
    } else {
      console.log('[Service Analytics] No date filter - fetching all data');
    }

    // Service analytics by category from JobItems
    console.log('[Service Analytics] Fetching service analytics by category');
    let serviceAnalytics = [];
    try {
      if (Object.keys(dateFilter).length > 0) {
        console.log('[Service Analytics] Using date filter for category query');
        serviceAnalytics = await sequelize.query(`
          SELECT 
            "JobItem"."category",
            SUM("JobItem"."totalPrice") as "totalRevenue",
            SUM("JobItem"."quantity") as "totalQuantity",
            COUNT("JobItem"."id") as "itemCount",
            AVG("JobItem"."unitPrice") as "averagePrice",
            MIN("JobItem"."unitPrice") as "minPrice",
            MAX("JobItem"."unitPrice") as "maxPrice"
          FROM "job_items" AS "JobItem"
          INNER JOIN "jobs" AS "job" ON "JobItem"."jobId" = "job"."id"
          WHERE "JobItem"."tenantId" = :tenantId
            AND "job"."createdAt" BETWEEN :startDate AND :endDate
          GROUP BY "JobItem"."category"
          ORDER BY SUM("JobItem"."totalPrice") DESC
        `, {
          replacements: {
            tenantId: req.tenantId,
            startDate: dateFilter[Op.between][0],
            endDate: dateFilter[Op.between][1]
          },
          type: sequelize.QueryTypes.SELECT
        });
      } else {
        console.log('[Service Analytics] No date filter for category query');
        serviceAnalytics = await sequelize.query(`
          SELECT 
            "JobItem"."category",
            SUM("JobItem"."totalPrice") as "totalRevenue",
            SUM("JobItem"."quantity") as "totalQuantity",
            COUNT("JobItem"."id") as "itemCount",
            AVG("JobItem"."unitPrice") as "averagePrice",
            MIN("JobItem"."unitPrice") as "minPrice",
            MAX("JobItem"."unitPrice") as "maxPrice"
          FROM "job_items" AS "JobItem"
          INNER JOIN "jobs" AS "job" ON "JobItem"."jobId" = "job"."id"
          WHERE "JobItem"."tenantId" = :tenantId
          GROUP BY "JobItem"."category"
          ORDER BY SUM("JobItem"."totalPrice") DESC
        `, {
          replacements: {
            tenantId: req.tenantId
          },
          type: sequelize.QueryTypes.SELECT
        });
      }
      console.log('[Service Analytics] Service analytics by category fetched:', serviceAnalytics.length, 'categories');
    } catch (categoryError) {
      console.error('[Service Analytics] Error fetching service analytics by category:', categoryError);
      throw categoryError;
    }

    // Service analytics by date - using raw SQL for better performance
    console.log('[Service Analytics] Fetching service analytics by date');
    let serviceByDate = [];
    try {
      if (Object.keys(dateFilter).length > 0) {
        serviceByDate = await sequelize.query(`
          SELECT 
            CAST("job"."createdAt" AS DATE) as "date",
            SUM("JobItem"."totalPrice") as "totalRevenue",
            SUM("JobItem"."quantity") as "totalQuantity",
            COUNT("JobItem"."id") as "itemCount"
          FROM "job_items" AS "JobItem"
          INNER JOIN "jobs" AS "job" ON "JobItem"."jobId" = "job"."id"
          WHERE "JobItem"."tenantId" = :tenantId
            AND "job"."createdAt" BETWEEN :startDate AND :endDate
          GROUP BY CAST("job"."createdAt" AS DATE)
          ORDER BY CAST("job"."createdAt" AS DATE) ASC
        `, {
          replacements: {
            tenantId: req.tenantId,
            startDate: dateFilter[Op.between][0],
            endDate: dateFilter[Op.between][1]
          },
          type: sequelize.QueryTypes.SELECT
        });
      } else {
        serviceByDate = await sequelize.query(`
          SELECT 
            CAST("job"."createdAt" AS DATE) as "date",
            SUM("JobItem"."totalPrice") as "totalRevenue",
            SUM("JobItem"."quantity") as "totalQuantity",
            COUNT("JobItem"."id") as "itemCount"
          FROM "job_items" AS "JobItem"
          INNER JOIN "jobs" AS "job" ON "JobItem"."jobId" = "job"."id"
          WHERE "JobItem"."tenantId" = :tenantId
          GROUP BY CAST("job"."createdAt" AS DATE)
          ORDER BY CAST("job"."createdAt" AS DATE) ASC
        `, {
          replacements: {
            tenantId: req.tenantId
          },
          type: sequelize.QueryTypes.SELECT
        });
      }
      console.log('[Service Analytics] Service analytics by date fetched:', serviceByDate.length, 'dates');
    } catch (dateError) {
      console.error('[Service Analytics] Error fetching service analytics by date:', dateError);
      // Don't throw - make it optional
      serviceByDate = [];
    }

    // Service analytics by customer - using raw SQL for better performance
    console.log('[Service Analytics] Fetching service analytics by customer');
    let serviceByCustomer = [];
    try {
      if (Object.keys(dateFilter).length > 0) {
        serviceByCustomer = await sequelize.query(`
          SELECT 
            "job"."customerId",
            SUM("JobItem"."totalPrice") as "totalRevenue",
            SUM("JobItem"."quantity") as "totalQuantity",
            COUNT("JobItem"."id") as "itemCount",
            "customer"."id" as "customer.id",
            "customer"."name" as "customer.name",
            "customer"."company" as "customer.company",
            "customer"."email" as "customer.email"
          FROM "job_items" AS "JobItem"
          INNER JOIN "jobs" AS "job" ON "JobItem"."jobId" = "job"."id"
          LEFT JOIN "customers" AS "customer" ON "job"."customerId" = "customer"."id"
          WHERE "JobItem"."tenantId" = :tenantId
            AND "job"."createdAt" BETWEEN :startDate AND :endDate
          GROUP BY "job"."customerId", "customer"."id", "customer"."name", "customer"."company", "customer"."email"
          ORDER BY SUM("JobItem"."totalPrice") DESC
          LIMIT 20
        `, {
          replacements: {
            tenantId: req.tenantId,
            startDate: dateFilter[Op.between][0],
            endDate: dateFilter[Op.between][1]
          },
          type: sequelize.QueryTypes.SELECT
        });
      } else {
        serviceByCustomer = await sequelize.query(`
          SELECT 
            "job"."customerId",
            SUM("JobItem"."totalPrice") as "totalRevenue",
            SUM("JobItem"."quantity") as "totalQuantity",
            COUNT("JobItem"."id") as "itemCount",
            "customer"."id" as "customer.id",
            "customer"."name" as "customer.name",
            "customer"."company" as "customer.company",
            "customer"."email" as "customer.email"
          FROM "job_items" AS "JobItem"
          INNER JOIN "jobs" AS "job" ON "JobItem"."jobId" = "job"."id"
          LEFT JOIN "customers" AS "customer" ON "job"."customerId" = "customer"."id"
          WHERE "JobItem"."tenantId" = :tenantId
          GROUP BY "job"."customerId", "customer"."id", "customer"."name", "customer"."company", "customer"."email"
          ORDER BY SUM("JobItem"."totalPrice") DESC
          LIMIT 20
        `, {
          replacements: {
            tenantId: req.tenantId
          },
          type: sequelize.QueryTypes.SELECT
        });
      }
      // Map the raw SQL results to match expected format
      serviceByCustomer = serviceByCustomer.map(item => ({
        totalRevenue: parseFloat(item.totalRevenue || 0),
        totalQuantity: parseFloat(item.totalQuantity || 0),
        itemCount: parseInt(item.itemCount || 0),
        job: {
          customerId: item.customerId,
          customer: item['customer.id'] ? {
            id: item['customer.id'],
            name: item['customer.name'],
            company: item['customer.company'],
            email: item['customer.email']
          } : null
        }
      }));
      console.log('[Service Analytics] Service analytics by customer fetched:', serviceByCustomer.length, 'customers');
    } catch (customerError) {
      console.error('[Service Analytics] Error fetching service analytics by customer:', customerError);
      // Don't throw - make it optional
      serviceByCustomer = [];
    }

    // Total revenue from services
    console.log('[Service Analytics] Calculating total revenue and quantity');
    let totalRevenue = 0;
    let totalQuantity = 0;
    try {
      if (Object.keys(dateFilter).length > 0) {
        const totalResult = await sequelize.query(`
          SELECT 
            SUM("JobItem"."totalPrice") as "totalRevenue",
            SUM("JobItem"."quantity") as "totalQuantity"
          FROM "job_items" AS "JobItem"
          INNER JOIN "jobs" AS "job" ON "JobItem"."jobId" = "job"."id"
          WHERE "JobItem"."tenantId" = :tenantId
            AND "job"."createdAt" BETWEEN :startDate AND :endDate
        `, {
          replacements: {
            tenantId: req.tenantId,
            startDate: dateFilter[Op.between][0],
            endDate: dateFilter[Op.between][1]
          },
          type: sequelize.QueryTypes.SELECT
        });
        totalRevenue = parseFloat(totalResult[0]?.totalRevenue || 0);
        totalQuantity = parseFloat(totalResult[0]?.totalQuantity || 0);
      } else {
        const totalResult = await sequelize.query(`
          SELECT 
            SUM("JobItem"."totalPrice") as "totalRevenue",
            SUM("JobItem"."quantity") as "totalQuantity"
          FROM "job_items" AS "JobItem"
          INNER JOIN "jobs" AS "job" ON "JobItem"."jobId" = "job"."id"
          WHERE "JobItem"."tenantId" = :tenantId
        `, {
          replacements: {
            tenantId: req.tenantId
          },
          type: sequelize.QueryTypes.SELECT
        });
        totalRevenue = parseFloat(totalResult[0]?.totalRevenue || 0);
        totalQuantity = parseFloat(totalResult[0]?.totalQuantity || 0);
      }
      console.log('[Service Analytics] Total revenue:', totalRevenue, 'Total quantity:', totalQuantity);
    } catch (totalError) {
      console.error('[Service Analytics] Error calculating totals:', totalError);
      // Use defaults (0)
    }

    const responseData = {
      totalRevenue: totalRevenue,
      totalQuantity: totalQuantity,
      byCategory: serviceAnalytics.map(item => ({
        category: item.category,
        totalRevenue: parseFloat(item.totalRevenue || 0),
        totalQuantity: parseFloat(item.totalQuantity || 0),
        itemCount: parseInt(item.itemCount || 0),
        averagePrice: parseFloat(item.averagePrice || 0),
        minPrice: parseFloat(item.minPrice || 0),
        maxPrice: parseFloat(item.maxPrice || 0)
      })),
      byDate: serviceByDate || [],
      byCustomer: serviceByCustomer || []
    };
    
    console.log('[Service Analytics] Response data summary:', {
      totalRevenue: responseData.totalRevenue,
      totalQuantity: responseData.totalQuantity,
      byCategoryCount: responseData.byCategory.length,
      byDateCount: responseData.byDate.length,
      byCustomerCount: responseData.byCustomer.length
    });

    res.status(200).json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('[Service Analytics] ERROR:', error.message);
    console.error('[Service Analytics] Stack:', error.stack);
    console.error('[Service Analytics] Full error:', error);
    next(error);
  }
};

