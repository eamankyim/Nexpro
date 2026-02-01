const { sequelize } = require('../config/database');
const { Job, Expense, Customer, Vendor, Invoice, JobItem, Lead, Sale, SaleItem, Product, Prescription, PrescriptionItem, Drug, InventoryMovement, InventoryItem, Payment } = require('../models');
const { Op } = require('sequelize');
const { applyTenantFilter } = require('../utils/tenantUtils');
const config = require('../config/config');

// Debug logging: no-op in production to avoid hot-path I/O
const logReport = (...args) => {
  if (config.nodeEnv === 'development') {
    console.log(...args);
  }
};
const logReportError = (...args) => {
  if (config.nodeEnv === 'development') {
    console.error(...args);
  }
};

// Helper function to check if dateFilter has content (Op.between is a Symbol, so Object.keys() won't include it)
const hasDateFilter = (dateFilter) => {
  return dateFilter && (Object.keys(dateFilter).length > 0 || dateFilter[Op.between] !== undefined);
};

// @desc    Get revenue report
// @route   GET /api/reports/revenue
// @access  Private
exports.getRevenueReport = async (req, res, next) => {
  try {
    logReport('[Revenue Report] Starting revenue report generation');
    logReport('[Revenue Report] Tenant ID:', req.tenantId);
    const { startDate, endDate, groupBy = 'day' } = req.query;
    logReport('[Revenue Report] Query params:', { startDate, endDate, groupBy });
    
    let dateFilter = {};
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter = {
        [Op.between]: [start, end]
      };
      logReport('[Revenue Report] Date filter applied:', { start, end });
    } else {
      logReport('[Revenue Report] No date filter - fetching all data');
    }

    const hasDateFilterValue = hasDateFilter(dateFilter);
    const revWhere = applyTenantFilter(req.tenantId, {
      status: 'paid',
      ...(hasDateFilterValue && { paidDate: dateFilter })
    });

    const getRevenueByPeriod = () => {
      if (groupBy === 'hour') {
        return sequelize.query(
          `SELECT FLOOR(EXTRACT(HOUR FROM "paidDate")/2)*2 as "hour", SUM("amountPaid") as "totalRevenue", COUNT("id") as "count" FROM "invoices" WHERE "tenantId"=:tenantId AND status='paid' ${hasDateFilterValue ? 'AND "paidDate" BETWEEN :startDate AND :endDate' : ''} GROUP BY 1 ORDER BY 1`,
          { replacements: { tenantId: req.tenantId, ...(hasDateFilterValue && { startDate: dateFilter[Op.between][0], endDate: dateFilter[Op.between][1] }) }, type: sequelize.QueryTypes.SELECT }
        );
      }
      if (groupBy === 'week') {
        return sequelize.query(
          `SELECT EXTRACT(WEEK FROM "paidDate")-EXTRACT(WEEK FROM DATE_TRUNC('month',"paidDate"))+1 as "week", DATE_TRUNC('month',"paidDate") as "month", SUM("amountPaid") as "totalRevenue", COUNT("id") as "count" FROM "invoices" WHERE "tenantId"=:tenantId AND status='paid' ${hasDateFilterValue ? 'AND "paidDate" BETWEEN :startDate AND :endDate' : ''} GROUP BY 1,2 ORDER BY 2,1`,
          { replacements: { tenantId: req.tenantId, ...(hasDateFilterValue && { startDate: dateFilter[Op.between][0], endDate: dateFilter[Op.between][1] }) }, type: sequelize.QueryTypes.SELECT }
        );
      }
      return Invoice.findAll({
        attributes: groupBy === 'month'
          ? [[sequelize.fn('EXTRACT', sequelize.literal('MONTH FROM "paidDate"')), 'month'], [sequelize.fn('EXTRACT', sequelize.literal('YEAR FROM "paidDate"')), 'year'], [sequelize.fn('SUM', sequelize.literal('"Invoice"."amountPaid"')), 'totalRevenue'], [sequelize.fn('COUNT', sequelize.literal('"Invoice"."id"')), 'count']]
          : [[sequelize.literal(`CAST("paidDate" AS DATE)`), 'date'], [sequelize.fn('SUM', sequelize.literal('"Invoice"."amountPaid"')), 'totalRevenue'], [sequelize.fn('COUNT', sequelize.literal('"Invoice"."id"')), 'count']],
        where: revWhere,
        group: groupBy === 'month' ? [sequelize.fn('EXTRACT', sequelize.literal('YEAR FROM "paidDate"')), sequelize.fn('EXTRACT', sequelize.literal('MONTH FROM "paidDate"'))] : [sequelize.literal(`CAST("paidDate" AS DATE)`)],
        order: groupBy === 'month' ? [[sequelize.fn('EXTRACT', sequelize.literal('YEAR FROM "paidDate"')), 'ASC'], [sequelize.fn('EXTRACT', sequelize.literal('MONTH FROM "paidDate"')), 'ASC']] : [[sequelize.literal(`CAST("paidDate" AS DATE)`), 'ASC']],
        raw: true
      });
    };

    let revenueByMethod = [];
    // try {
    //   revenueByMethod = await Invoice.findAll({
    //     attributes: [
    //       'paymentMethod',
    //       [sequelize.fn('SUM', sequelize.literal('"Invoice"."amountPaid"')), 'totalRevenue'],
    //       [sequelize.fn('COUNT', sequelize.literal('"Invoice"."id"')), 'count']
    //     ],
    //     where: applyTenantFilter(req.tenantId, {
    //       status: 'paid',
    //       ...(Object.keys(dateFilter).length > 0 && { paidDate: dateFilter })
    //     }),
    //     group: ['paymentMethod'],
    //     order: [[sequelize.fn('SUM', sequelize.literal('"Invoice"."amountPaid"')), 'DESC']],
    //     raw: true
    //   });
    //   console.log('[Revenue Report] Revenue by payment method fetched:', revenueByMethod.length, 'methods');
    // } catch (methodError) {
    //   console.error('[Revenue Report] Error fetching revenue by payment method:', methodError);
    //   revenueByMethod = [];
    // }

    const [revenueByPeriod, revenueByCustomer, totalRevenue] = await Promise.all([
      getRevenueByPeriod(),
      Invoice.findAll({
        attributes: ['customerId', [sequelize.fn('SUM', sequelize.literal('"Invoice"."amountPaid"')), 'totalRevenue'], [sequelize.fn('COUNT', sequelize.literal('"Invoice"."id"')), 'paymentCount']],
        where: revWhere,
        include: [{ model: Customer, as: 'customer', attributes: ['id', 'name', 'company'] }],
        group: ['customerId', 'customer.id'],
        order: [[sequelize.fn('SUM', sequelize.literal('"Invoice"."amountPaid"')), 'DESC']],
        limit: 20
      }),
      Invoice.sum('amountPaid', { where: revWhere })
    ]);
    logReport('[Revenue Report] Total revenue:', totalRevenue, '(from Invoice.amountPaid where status = paid)');

    const responseData = {
      totalRevenue: parseFloat(totalRevenue),
      byPeriod: revenueByPeriod,
      byCustomer: revenueByCustomer,
      byMethod: revenueByMethod
    };
    logReport('[Revenue Report] Response data summary:', {
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
    logReportError('[Revenue Report] ERROR:', error.message);
    logReportError('[Revenue Report] Stack:', error.stack);
    logReportError('[Revenue Report] Full error:', error);
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

    const expenseWhere = applyTenantFilter(req.tenantId, {
      ...(hasDateFilter(dateFilter) && { expenseDate: dateFilter })
    });

    const [expensesByCategory, expensesByVendor, expensesByMethod, expensesByDate, totalExpenses] = await Promise.all([
      Expense.findAll({
        attributes: [
          'category',
          [sequelize.fn('SUM', sequelize.col('amount')), 'totalAmount'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        where: expenseWhere,
        group: ['category'],
        order: [[sequelize.fn('SUM', sequelize.col('amount')), 'DESC']]
      }),
      Expense.findAll({
        attributes: [
          'vendorId',
          [sequelize.fn('SUM', sequelize.literal('"Expense"."amount"')), 'totalAmount'],
          [sequelize.fn('COUNT', sequelize.literal('"Expense"."id"')), 'count']
        ],
        where: expenseWhere,
        include: [{ model: Vendor, as: 'vendor', attributes: ['id', 'name', 'company'] }],
        group: ['vendorId', 'vendor.id'],
        order: [[sequelize.fn('SUM', sequelize.literal('"Expense"."amount"')), 'DESC']],
        limit: 20
      }),
      Expense.findAll({
        attributes: [
          'paymentMethod',
          [sequelize.fn('SUM', sequelize.col('amount')), 'totalAmount'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        where: expenseWhere,
        group: ['paymentMethod'],
        order: [[sequelize.fn('SUM', sequelize.col('amount')), 'DESC']]
      }),
      Expense.findAll({
        attributes: [
          [sequelize.literal(`CAST("expenseDate" AS DATE)`), 'date'],
          [sequelize.fn('SUM', sequelize.col('amount')), 'totalAmount'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        where: expenseWhere,
        group: [sequelize.literal(`CAST("expenseDate" AS DATE)`)],
        order: [[sequelize.literal(`CAST("expenseDate" AS DATE)`), 'ASC']],
        raw: true
      }),
      Expense.sum('amount', { where: expenseWhere })
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalExpenses: parseFloat(totalExpenses || 0),
        byCategory: expensesByCategory,
        byVendor: expensesByVendor,
        byMethod: expensesByMethod,
        byDate: expensesByDate
      }
    });
  } catch (error) {
    logReportError('Error in getRevenueReport:', error);
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
        ...(hasDateFilter(dateFilter) && { invoiceDate: dateFilter })
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
        ...(hasDateFilter(dateFilter) && { invoiceDate: dateFilter })
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
        ...(hasDateFilter(dateFilter) && { invoiceDate: dateFilter })
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
    logReportError('Error in getRevenueReport:', error);
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
    if (hasDateFilter(dateFilter)) {
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
        ...(hasDateFilter(dateFilter) && { createdAt: dateFilter })
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

    // Sales by date - using createdAt for date grouping
    const salesByDate = await Job.findAll({
      attributes: [
        [sequelize.literal(`CAST("createdAt" AS DATE)`), 'date'],
        [sequelize.fn('SUM', sequelize.col('finalPrice')), 'totalSales'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'jobCount']
      ],
      where: applyTenantFilter(req.tenantId, {
        ...(hasDateFilter(dateFilter) && { createdAt: dateFilter })
      }),
      group: [sequelize.literal(`CAST("createdAt" AS DATE)`)],
      order: [[sequelize.literal(`CAST("createdAt" AS DATE)`), 'ASC']],
      raw: true
    });

    // Jobs trend by date - incoming (createdAt) and completed (completionDate)
    let jobsTrendByDate = [];
    if (hasDateFilter(dateFilter)) {
      // Get incoming jobs grouped by createdAt date
      const incomingJobsByDate = await Job.findAll({
        attributes: [
          [sequelize.literal(`CAST("createdAt" AS DATE)`), 'date'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'incoming']
        ],
        where: applyTenantFilter(req.tenantId, {
          createdAt: dateFilter
        }),
        group: [sequelize.literal(`CAST("createdAt" AS DATE)`)],
        order: [[sequelize.literal(`CAST("createdAt" AS DATE)`), 'ASC']],
        raw: true
      });

      // Get completed jobs grouped by completionDate (only jobs with completionDate set)
      const completedJobsByDate = await Job.findAll({
        attributes: [
          [sequelize.literal(`CAST("completionDate" AS DATE)`), 'date'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'completed']
        ],
        where: applyTenantFilter(req.tenantId, {
          status: 'completed',
          completionDate: {
            [Op.and]: [
              { [Op.not]: null },
              dateFilter
            ]
          }
        }),
        group: [sequelize.literal(`CAST("completionDate" AS DATE)`)],
        order: [[sequelize.literal(`CAST("completionDate" AS DATE)`), 'ASC']],
        raw: true
      });

      // Merge the two datasets by date
      const dateMap = new Map();
      
      // Helper function to convert date to ISO string
      const getDateKey = (date) => {
        if (!date) return null;
        if (date instanceof Date) {
          return date.toISOString().split('T')[0];
        }
        // Handle string dates from Sequelize raw queries
        const dateObj = new Date(date);
        return dateObj.toISOString().split('T')[0];
      };
      
      // Add incoming jobs
      incomingJobsByDate.forEach(item => {
        const dateKey = getDateKey(item.date);
        if (dateKey) {
          dateMap.set(dateKey, {
            date: dateKey,
            incoming: parseInt(item.incoming) || 0,
            completed: 0
          });
        }
      });

      // Add completed jobs
      completedJobsByDate.forEach(item => {
        const dateKey = getDateKey(item.date);
        if (dateKey) {
          if (dateMap.has(dateKey)) {
            dateMap.get(dateKey).completed = parseInt(item.completed) || 0;
          } else {
            dateMap.set(dateKey, {
              date: dateKey,
              incoming: 0,
              completed: parseInt(item.completed) || 0
            });
          }
        }
      });

      // Convert map to array and sort by date
      jobsTrendByDate = Array.from(dateMap.values()).sort((a, b) => {
        return new Date(a.date) - new Date(b.date);
      });
    } else {
      // Get all incoming jobs grouped by createdAt date
      const incomingJobsByDate = await Job.findAll({
        attributes: [
          [sequelize.literal(`CAST("createdAt" AS DATE)`), 'date'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'incoming']
        ],
        where: applyTenantFilter(req.tenantId, {}),
        group: [sequelize.literal(`CAST("createdAt" AS DATE)`)],
        order: [[sequelize.literal(`CAST("createdAt" AS DATE)`), 'ASC']],
        raw: true
      });

      // Get all completed jobs grouped by completionDate (only jobs with completionDate set)
      const completedJobsByDate = await Job.findAll({
        attributes: [
          [sequelize.literal(`CAST("completionDate" AS DATE)`), 'date'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'completed']
        ],
        where: applyTenantFilter(req.tenantId, {
          status: 'completed',
          completionDate: {
            [Op.not]: null
          }
        }),
        group: [sequelize.literal(`CAST("completionDate" AS DATE)`)],
        order: [[sequelize.literal(`CAST("completionDate" AS DATE)`), 'ASC']],
        raw: true
      });

      // Merge the two datasets by date
      const dateMap = new Map();
      
      // Helper function to convert date to ISO string
      const getDateKey = (date) => {
        if (!date) return null;
        if (date instanceof Date) {
          return date.toISOString().split('T')[0];
        }
        // Handle string dates from Sequelize raw queries
        const dateObj = new Date(date);
        return dateObj.toISOString().split('T')[0];
      };
      
      // Add incoming jobs
      incomingJobsByDate.forEach(item => {
        const dateKey = getDateKey(item.date);
        if (dateKey) {
          dateMap.set(dateKey, {
            date: dateKey,
            incoming: parseInt(item.incoming) || 0,
            completed: 0
          });
        }
      });

      // Add completed jobs
      completedJobsByDate.forEach(item => {
        const dateKey = getDateKey(item.date);
        if (dateKey) {
          if (dateMap.has(dateKey)) {
            dateMap.get(dateKey).completed = parseInt(item.completed) || 0;
          } else {
            dateMap.set(dateKey, {
              date: dateKey,
              incoming: 0,
              completed: parseInt(item.completed) || 0
            });
          }
        }
      });

      // Convert map to array and sort by date
      jobsTrendByDate = Array.from(dateMap.values()).sort((a, b) => {
        return new Date(a.date) - new Date(b.date);
      });
    }

    // Sales by status
    const salesByStatus = await Job.findAll({
      attributes: [
        'status',
        [sequelize.fn('SUM', sequelize.col('finalPrice')), 'totalSales'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'jobCount']
      ],
      where: applyTenantFilter(req.tenantId, {
        ...(hasDateFilter(dateFilter) && { createdAt: dateFilter })
      }),
      group: ['status'],
      order: [[sequelize.fn('SUM', sequelize.col('finalPrice')), 'DESC']]
    });

    // Total sales
    const totalSales = await Job.sum('finalPrice', {
      where: applyTenantFilter(req.tenantId, {
        ...(hasDateFilter(dateFilter) && { createdAt: dateFilter })
      })
    }) || 0;

    // Total jobs count
    const totalJobs = await Job.count({
      where: applyTenantFilter(req.tenantId, {
        ...(hasDateFilter(dateFilter) && { createdAt: dateFilter })
      })
    }) || 0;

    // Sales by payment method (from Sale model – shop/pharmacy; used for Revenue by Channel fallback)
    let salesByPaymentMethod = [];
    try {
      const saleWhere = applyTenantFilter(req.tenantId, {
        status: 'completed',
        ...(hasDateFilter(dateFilter) && { createdAt: dateFilter })
      });
      salesByPaymentMethod = await Sale.findAll({
        attributes: [
          'paymentMethod',
          [sequelize.fn('SUM', sequelize.col('total')), 'totalAmount'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        where: saleWhere,
        group: ['paymentMethod'],
        order: [[sequelize.fn('SUM', sequelize.col('total')), 'DESC']],
        raw: true
      });
      salesByPaymentMethod = (salesByPaymentMethod || []).map((row) => ({
        paymentMethod: row.paymentMethod || 'other',
        totalAmount: parseFloat(row.totalAmount || 0),
        count: parseInt(row.count || 0, 10)
      }));
    } catch (e) {
      logReportError('Sales by payment method (Sale model):', e);
    }

    res.status(200).json({
      success: true,
      data: {
        totalSales: parseFloat(totalSales),
        totalJobs: totalJobs,
        byJobType: salesByJobType,
        byCustomer: salesByCustomer,
        byDate: salesByDate,
        byStatus: salesByStatus,
        byPaymentMethod: salesByPaymentMethod,
        byPeriod: salesByDate, // Add byPeriod alias for frontend compatibility
        jobsTrendByDate: jobsTrendByDate // Jobs trend with incoming and completed by date
      }
    });
  } catch (error) {
    logReportError('Error in getRevenueReport:', error);
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
        ...(hasDateFilter(dateFilter) && { paidDate: dateFilter })
      })
    }) || 0;

    // Expenses
    const expenses = await Expense.sum('amount', {
      where: applyTenantFilter(req.tenantId, {
        ...(hasDateFilter(dateFilter) && { expenseDate: dateFilter })
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
    logReportError('Error in getRevenueReport:', error);
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
        ...(hasDateFilter(dateFilter) && { paidDate: dateFilter })
      })
    }) || 0;

    const totalExpenses = await Expense.sum('amount', {
      where: applyTenantFilter(req.tenantId, {
        ...(hasDateFilter(dateFilter) && { expenseDate: dateFilter })
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
        ...(hasDateFilter(dateFilter) && { invoiceDate: dateFilter })
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
    logReportError('Error in getRevenueReport:', error);
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
        ...(hasDateFilter(dateFilter) && { paidDate: dateFilter })
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
    logReportError('Error in getRevenueReport:', error);
    next(error);
  }
};

exports.getPipelineSummary = async (req, res, next) => {
  try {
    let activeJobs = 0;
    let openLeads = 0;
    let pendingInvoices = 0;

    try {
      activeJobs = await Job.count({
        where: applyTenantFilter(req.tenantId, {
          status: { [Op.notIn]: ['completed', 'cancelled'] },
        })
      });
    } catch (e) {
      logReportError('getPipelineSummary activeJobs:', e);
    }

    try {
      // Lead model uses status: new, contacted, qualified, lost, converted (not closed_won/closed_lost)
      openLeads = await Lead.count({
        where: applyTenantFilter(req.tenantId, {
          status: { [Op.notIn]: ['lost', 'converted'] },
          isActive: true
        })
      });
    } catch (e) {
      logReportError('getPipelineSummary openLeads:', e);
    }

    try {
      pendingInvoices = await Invoice.count({
        where: applyTenantFilter(req.tenantId, {
          status: { [Op.in]: ['sent', 'partial'] },
          balance: { [Op.gt]: 0 }
        })
      });
    } catch (e) {
      logReportError('getPipelineSummary pendingInvoices:', e);
    }

    res.status(200).json({
      success: true,
      data: {
        activeJobs,
        openLeads,
        pendingInvoices
      }
    });
  } catch (error) {
    logReportError('Error in getPipelineSummary:', error);
    next(error);
  }
};

// @desc    Get service analytics report (by category from JobItems)
// @route   GET /api/reports/service-analytics
// @access  Private
exports.getServiceAnalyticsReport = async (req, res, next) => {
  try {
    logReport('[Service Analytics] Starting service analytics report generation');
    logReport('[Service Analytics] Tenant ID:', req.tenantId);
    const { startDate, endDate } = req.query;
    logReport('[Service Analytics] Query params:', { startDate, endDate });
    
    let dateFilter = {};
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter = {
        [Op.between]: [start, end]
      };
      logReport('[Service Analytics] Date filter applied:', { start, end });
    } else {
      logReport('[Service Analytics] No date filter - fetching all data');
    }

    // Service analytics by category from JobItems
    logReport('[Service Analytics] Fetching service analytics by category');
    let serviceAnalytics = [];
    try {
      if (hasDateFilter(dateFilter)) {
        logReport('[Service Analytics] Using date filter for category query');
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
        logReport('[Service Analytics] No date filter for category query');
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
      logReport('[Service Analytics] Service analytics by category fetched:', serviceAnalytics.length, 'categories');
      } catch (categoryError) {
      logReportError('[Service Analytics] Error fetching service analytics by category:', categoryError);
      throw categoryError;
    }

    // Service analytics by date - using raw SQL for better performance
    logReport('[Service Analytics] Fetching service analytics by date');
    let serviceByDate = [];
    try {
      if (hasDateFilter(dateFilter)) {
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
      logReport('[Service Analytics] Service analytics by date fetched:', serviceByDate.length, 'dates');
      } catch (dateError) {
      logReportError('[Service Analytics] Error fetching service analytics by date:', dateError);
      // Don't throw - make it optional
      serviceByDate = [];
    }

    // Service analytics by customer - using raw SQL for better performance
    logReport('[Service Analytics] Fetching service analytics by customer');
    let serviceByCustomer = [];
    try {
      if (hasDateFilter(dateFilter)) {
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
      logReport('[Service Analytics] Service analytics by customer fetched:', serviceByCustomer.length, 'customers');
      } catch (customerError) {
      logReportError('[Service Analytics] Error fetching service analytics by customer:', customerError);
      // Don't throw - make it optional
      serviceByCustomer = [];
    }

    // Total revenue from services
    logReport('[Service Analytics] Calculating total revenue and quantity');
    let totalRevenue = 0;
    let totalQuantity = 0;
    try {
      if (hasDateFilter(dateFilter)) {
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
      logReport('[Service Analytics] Total revenue:', totalRevenue, 'Total quantity:', totalQuantity);
      } catch (totalError) {
      logReportError('[Service Analytics] Error calculating totals:', totalError);
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
    
    logReport('[Service Analytics] Response data summary:', {
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
    logReportError('[Service Analytics] ERROR:', error.message);
    logReportError('[Service Analytics] Stack:', error.stack);
    logReportError('[Service Analytics] Full error:', error);
    next(error);
  }
};

// @desc    Generate AI-powered report analysis
// @route   POST /api/reports/ai-analysis
// @access  Private
exports.generateAIAnalysis = async (req, res, next) => {
  try {
    const openaiService = require('../services/openaiService');
    const { reportData, options } = req.body;

    if (!reportData) {
      return res.status(400).json({
        success: false,
        error: 'Report data is required'
      });
    }

    const analysis = await openaiService.analyzeReportData(reportData, {
      businessType: req.tenant?.businessType || 'printing_press',
      ...options
    });

    res.status(200).json({
      success: true,
      data: analysis.analysis
    });
  } catch (error) {
    if (error.code === 'OPENAI_NOT_CONFIGURED') {
      return res.status(503).json({
        success: false,
        error: 'AI analysis is not configured. Set OPENAI_API_KEY in the backend .env to enable.',
        code: 'OPENAI_NOT_CONFIGURED'
      });
    }
    if (error.code === 'invalid_api_key' || error.status === 401) {
      return res.status(503).json({
        success: false,
        error: 'Invalid OpenAI API key. Check OPENAI_API_KEY in Backend/.env, ensure no extra spaces or line breaks, and create a new key at https://platform.openai.com/api-keys if needed.',
        code: 'OPENAI_INVALID_KEY'
      });
    }
    logReportError('Error generating AI analysis:', error);
    // Return a fallback response if OpenAI fails for other reasons
    res.status(200).json({
      success: true,
      data: {
        keyFindings: [
          'Revenue and expense data has been analyzed.',
          'Profit margins indicate business health.',
          'Continue monitoring key performance indicators.'
        ],
        performanceAnalysis: 'The report data shows business performance metrics. Review the detailed sections for specific insights.',
        recommendations: [],
        riskAssessment: [],
        growthOpportunities: [],
        strategicSuggestions: [
          'Continue tracking revenue and expense trends.',
          'Monitor profit margins for optimization opportunities.'
        ],
        aiError: error.message
      }
    });
  }
};

// @desc    Get product sales report (for shop/pharmacy)
// @route   GET /api/reports/product-sales
// @access  Private
exports.getProductSalesReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    let saleDateFilter = {};
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      saleDateFilter = { [Op.between]: [start, end] };
    }

    const saleWhere = applyTenantFilter(req.tenantId, {
      status: 'completed',
      ...(saleDateFilter[Op.between] && { createdAt: saleDateFilter })
    });

    // Aggregate sales by product: quantity sold and revenue per product
    const salesByProduct = await SaleItem.findAll({
      attributes: [
        'productId',
        [sequelize.fn('SUM', sequelize.col('SaleItem.quantity')), 'quantitySold'],
        [sequelize.fn('SUM', sequelize.col('SaleItem.total')), 'revenue']
      ],
      include: [{
        model: Sale,
        as: 'sale',
        attributes: [],
        required: true,
        where: saleWhere
      }],
      group: ['SaleItem.productId'],
      raw: true
    });

    if (!salesByProduct || salesByProduct.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          products: [],
          totalProducts: 0,
          totalRevenue: 0,
          totalQuantitySold: 0
        }
      });
    }

    const productIds = [...new Set(salesByProduct.map((r) => r.productId || r.productid).filter(Boolean))];
    const products = await Product.findAll({
      where: applyTenantFilter(req.tenantId, { id: { [Op.in]: productIds } }),
      attributes: ['id', 'name', 'sku', 'unit', 'quantityOnHand', 'reorderLevel'],
      raw: true
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    let totalRevenue = 0;
    let totalQuantitySold = 0;
    const productsList = salesByProduct.map((row) => {
      const pid = row.productId || row.productid;
      const product = productMap.get(pid);
      const quantitySold = Number(parseFloat(row.quantitySold || 0)) || 0;
      const revenue = Number(parseFloat(row.revenue || 0)) || 0;
      totalRevenue += revenue;
      totalQuantitySold += quantitySold;

      const currentStock = Number(parseFloat(product?.quantityOnHand || 0)) || 0;
      const safetyStock = Number(parseFloat(product?.reorderLevel || 0)) || 0;
      const stockPercentage = safetyStock > 0 ? Math.min(100, (currentStock / safetyStock) * 100) : 100;
      const isLowStock = safetyStock > 0 && currentStock <= safetyStock;
      const isHighRisk = safetyStock > 0 && currentStock > safetyStock * 3;

      return {
        productName: product?.name || 'Unknown',
        quantitySold,
        revenue,
        currentStock,
        safetyStock,
        unit: product?.unit || 'pcs',
        sku: product?.sku || null,
        isLowStock: Boolean(isLowStock),
        isHighRisk: Boolean(isHighRisk),
        stockPercentage: Math.round(stockPercentage * 10) / 10
      };
    });

    // Sort by revenue descending
    productsList.sort((a, b) => b.revenue - a.revenue);

    res.status(200).json({
      success: true,
      data: {
        products: productsList,
        totalProducts: productsList.length,
        totalRevenue,
        totalQuantitySold
      }
    });
  } catch (error) {
    logReportError('Error getting product sales report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get product sales report'
    });
  }
};

// @desc    Get prescription report (pharmacy)
// @route   GET /api/reports/prescription-report
// @access  Private
exports.getPrescriptionReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    let dateFilter = {};
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter = { [Op.between]: [start, end] };
    }

    const prescWhere = applyTenantFilter(req.tenantId, {
      ...(hasDateFilter(dateFilter) && { prescriptionDate: dateFilter })
    });

    // Count by status
    const byStatus = await Prescription.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: prescWhere,
      group: ['status'],
      raw: true
    });

    const statusCounts = { pending: 0, filled: 0, partially_filled: 0, cancelled: 0, expired: 0 };
    byStatus.forEach((row) => {
      const status = (row.status || '').replace(/-/g, '_');
      if (statusCounts.hasOwnProperty(status)) {
        statusCounts[status] = parseInt(row.count, 10) || 0;
      }
    });

    const totalPrescriptions = Object.values(statusCounts).reduce((sum, n) => sum + n, 0);

    // Revenue from prescription invoices (paid invoices with sourceType prescription)
    const prescriptionRevenue = await Invoice.sum('amountPaid', {
      where: applyTenantFilter(req.tenantId, {
        sourceType: 'prescription',
        status: 'paid',
        ...(hasDateFilter(dateFilter) && { paidDate: dateFilter })
      })
    }) || 0;

    // Fulfillment rate: filled / (filled + partially_filled + pending)
    const filled = statusCounts.filled;
    const partial = statusCounts.partially_filled;
    const pending = statusCounts.pending;
    const fulfillDenom = filled + partial + pending;
    const fulfillmentRate = fulfillDenom > 0 ? ((filled + partial * 0.5) / fulfillDenom) * 100 : 0;

    // Top drugs by quantity filled (PrescriptionItem.quantityFilled)
    let topDrugs = [];
    if (hasDateFilter(dateFilter)) {
      const items = await PrescriptionItem.findAll({
        attributes: [
          'drugId',
          [sequelize.fn('SUM', sequelize.col('quantityFilled')), 'quantityFilled'],
          [sequelize.fn('COUNT', sequelize.col('prescriptionId')), 'prescriptionCount']
        ],
        include: [{
          model: Prescription,
          as: 'prescription',
          attributes: [],
          required: true,
          where: prescWhere
        }],
        group: ['drugId'],
        order: [[sequelize.fn('SUM', sequelize.col('quantityFilled')), 'DESC']],
        limit: 10,
        raw: true
      });

      const drugIds = [...new Set(items.map((i) => i.drugId).filter(Boolean))];
      const drugs = await Drug.findAll({
        where: applyTenantFilter(req.tenantId, { id: { [Op.in]: drugIds } }),
        attributes: ['id', 'name', 'genericName'],
        raw: true
      });
      const drugMap = new Map(drugs.map((d) => [d.id, d]));

      topDrugs = items.map((row) => ({
        drugId: row.drugId,
        drugName: drugMap.get(row.drugId)?.name || 'Unknown',
        quantityFilled: parseFloat(row.quantityFilled || 0),
        prescriptionCount: parseInt(row.prescriptionCount, 10) || 0
      }));
    }

    res.status(200).json({
      success: true,
      data: {
        byStatus: statusCounts,
        totalPrescriptions,
        prescriptionRevenue: parseFloat(prescriptionRevenue),
        fulfillmentRate: Math.round(fulfillmentRate * 10) / 10,
        topDrugs
      }
    });
  } catch (error) {
    logReportError('Error getting prescription report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get prescription report'
    });
  }
};

// @desc    Get inventory summary
// @route   GET /api/reports/inventory-summary
// @access  Private
exports.getInventorySummary = async (req, res, next) => {
  try {
    const productWhere = applyTenantFilter(req.tenantId, {});
    const totalProducts = await Product.count({ where: productWhere });
    const inStockCount = await Product.count({
      where: { ...productWhere, quantityOnHand: { [Op.gt]: 0 } }
    });
    const stockValueResult = await Product.findAll({
      attributes: [
        [sequelize.literal('COALESCE(SUM("Product"."quantityOnHand" * "Product"."costPrice"), 0)'), 'totalStockValue']
      ],
      where: productWhere,
      raw: true
    });
    const totalStockValue = parseFloat(stockValueResult[0]?.totalStockValue || 0);
    const stockAvailabilityRate = totalProducts > 0 ? Math.round((inStockCount / totalProducts) * 1000) / 10 : 0;

    res.status(200).json({
      success: true,
      data: {
        totalStocks: totalProducts,
        totalStockValue,
        stockAvailabilityRate,
        inStockCount
      }
    });
  } catch (error) {
    logReportError('Error getting inventory summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get inventory summary'
    });
  }
};

// @desc    Get inventory movements
// @route   GET /api/reports/inventory-movements
// @access  Private
exports.getInventoryMovements = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    let dateFilter = {};
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter = { [Op.between]: [start, end] };
    }

    const movementWhere = applyTenantFilter(req.tenantId, {
      ...(hasDateFilter(dateFilter) && { occurredAt: dateFilter })
    });

    const movements = await InventoryMovement.findAll({
      where: movementWhere,
      include: [{
        model: InventoryItem,
        as: 'item',
        attributes: ['id', 'name', 'sku', 'unit']
      }],
      order: [['occurredAt', 'DESC']],
      limit: 100,
      raw: false
    });

    const data = movements.map((m) => ({
      id: m.id,
      type: m.type,
      quantityDelta: parseFloat(m.quantityDelta),
      previousQuantity: parseFloat(m.previousQuantity),
      newQuantity: parseFloat(m.newQuantity),
      occurredAt: m.occurredAt,
      itemName: m.item?.name || 'Unknown',
      itemSku: m.item?.sku,
      unit: m.item?.unit || 'pcs'
    }));

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    logReportError('Error getting inventory movements:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get inventory movements'
    });
  }
};

// @desc    Get fastest moving items (by quantity sold in date range)
// @route   GET /api/reports/fastest-moving-items
// @access  Private
exports.getFastestMovingItems = async (req, res, next) => {
  try {
    const { startDate, endDate, limit = 5 } = req.query;

    let saleDateFilter = {};
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      saleDateFilter = { [Op.between]: [start, end] };
    }

    const saleWhere = applyTenantFilter(req.tenantId, {
      status: 'completed',
      ...(saleDateFilter[Op.between] && { createdAt: saleDateFilter })
    });

    const items = await SaleItem.findAll({
      attributes: [
        'productId',
        [sequelize.fn('SUM', sequelize.col('SaleItem.quantity')), 'quantitySold']
      ],
      include: [{
        model: Sale,
        as: 'sale',
        attributes: [],
        required: true,
        where: saleWhere
      }],
      group: ['SaleItem.productId'],
      order: [[sequelize.literal('SUM("SaleItem"."quantity")'), 'DESC']],
      limit: Math.min(Number(limit) || 5, 50),
      raw: true
    });

    if (!items || items.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    const productIds = [...new Set(items.map((r) => r.productId || r.productid).filter(Boolean))];
    const products = await Product.findAll({
      where: applyTenantFilter(req.tenantId, { id: { [Op.in]: productIds } }),
      attributes: ['id', 'name', 'sku', 'unit'],
      raw: true
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const data = items.map((row) => {
      const pid = row.productId || row.productid;
      const product = productMap.get(pid);
      return {
        productId: pid,
        productName: product?.name || 'Unknown',
        quantitySold: parseFloat(row.quantitySold || 0),
        unit: product?.unit || 'pcs'
      };
    });

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    logReportError('Error getting fastest moving items:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get fastest moving items'
    });
  }
};

// @desc    Get revenue by channel (payment method)
// @route   GET /api/reports/revenue-by-channel
// @access  Private
exports.getRevenueByChannel = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    let dateFilter = {};
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter = { [Op.between]: [start, end] };
    }

    const channelMap = new Map();

    // Income payments (invoice/job payments) by payment method
    const paymentWhere = applyTenantFilter(req.tenantId, {
      type: 'income',
      status: 'completed',
      ...(hasDateFilter(dateFilter) && { paymentDate: dateFilter })
    });
    const byPayment = await Payment.findAll({
      attributes: [
        'paymentMethod',
        [sequelize.fn('SUM', sequelize.col('amount')), 'total']
      ],
      where: paymentWhere,
      group: ['paymentMethod'],
      raw: true
    });
    byPayment.forEach((row) => {
      const method = (row.paymentMethod || 'other').toString();
      const rev = parseFloat(row.total || 0);
      channelMap.set(method, (channelMap.get(method) || 0) + rev);
    });

    // Completed sales by payment method (shop/pharmacy)
    const saleWhere = applyTenantFilter(req.tenantId, {
      status: 'completed',
      ...(hasDateFilter(dateFilter) && { createdAt: dateFilter })
    });
    const bySale = await Sale.findAll({
      attributes: [
        'paymentMethod',
        [sequelize.fn('SUM', sequelize.col('total')), 'total']
      ],
      where: saleWhere,
      group: ['paymentMethod'],
      raw: true
    });
    bySale.forEach((row) => {
      const method = (row.paymentMethod || 'other').toString();
      const rev = parseFloat(row.total || 0);
      channelMap.set(method, (channelMap.get(method) || 0) + rev);
    });

    const labels = { cash: 'Cash', mobile_money: 'MoMo', card: 'Card', credit_card: 'Card', check: 'Check', bank_transfer: 'Bank Transfer', credit: 'Credit', other: 'Other' };
    const data = [...channelMap.entries()]
      .map(([channel, revenue]) => ({ channel: labels[channel] || channel, revenue }))
      .filter((d) => d.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    logReportError('Error getting revenue by channel:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get revenue by channel'
    });
  }
};

// --- Batched overview endpoints (fewer round trips for Reports page) ---

/**
 * Run a report handler with a mock res that captures the JSON body.
 * @param {Function} handler - getRevenueReport, getExpenseReport, etc.
 * @param {object} req - Express req (tenantId, query)
 * @returns {Promise<{ success: boolean, data?: any }>} Resolves with the body the handler passed to res.json()
 */
function runReportHandler(handler, req) {
  return new Promise((resolve, reject) => {
    const noop = () => {};
    const res = {
      status(code) {
        return { json: (body) => { resolve(body); return res; } };
      },
      json(body) {
        resolve(body);
      }
    };
    const next = (err) => { if (err) reject(err); };
    Promise.resolve(handler(req, res, next)).catch(reject);
  });
}

/**
 * @desc    Batched overview phase 1 (revenue, expenses, outstanding, sales, serviceAnalytics, productSales)
 * @route   GET /api/reports/overview/phase1
 * @access  Private
 */
exports.getOverviewPhase1 = async (req, res, next) => {
  try {
    const includeProductSales = req.query.includeProductSales === 'true';
    const handlers = [
      exports.getRevenueReport,
      exports.getExpenseReport,
      exports.getOutstandingPaymentsReport,
      exports.getSalesReport,
      exports.getServiceAnalyticsReport
    ];
    if (includeProductSales) {
      handlers.push(exports.getProductSalesReport);
    }
    const results = await Promise.all(
      handlers.map((handler) =>
        runReportHandler(handler, req).catch((err) => {
          logReportError('[Overview Phase1] Handler error:', err?.message || err);
          return { success: false, data: null };
        })
      )
    );
    const [revenue, expenses, outstanding, sales, serviceAnalytics, productSalesData] = results;
    const data = {
      revenue: revenue?.success ? revenue.data : { totalRevenue: 0, byPeriod: [], byCustomer: [] },
      expenses: expenses?.success ? expenses.data : { totalExpenses: 0, byCategory: [] },
      outstanding: outstanding?.success ? outstanding.data : { totalOutstanding: 0 },
      sales: sales?.success ? sales.data : { totalJobs: 0, totalSales: 0, byCustomer: [], byStatus: [], byDate: [], byJobType: [] },
      serviceAnalytics: serviceAnalytics?.success ? serviceAnalytics.data : { totalRevenue: 0, byCategory: [], byDate: [], byCustomer: [] },
      productSales: productSalesData?.success ? productSalesData.data : { products: [], totalRevenue: 0, totalQuantitySold: 0 }
    };
    res.status(200).json({ success: true, data });
  } catch (error) {
    logReportError('Error in getOverviewPhase1:', error);
    next(error);
  }
};

/**
 * @desc    Batched overview phase 2 (inventory, KPI, top customers, pipeline, revenue by channel)
 * @route   GET /api/reports/overview/phase2
 * @access  Private
 */
exports.getOverviewPhase2 = async (req, res, next) => {
  try {
    const handlers = [
      exports.getInventorySummary,
      exports.getInventoryMovements,
      exports.getFastestMovingItems,
      exports.getRevenueByChannel,
      exports.getKpiSummary,
      exports.getTopCustomers,
      exports.getPipelineSummary
    ];
    const results = await Promise.all(
      handlers.map((handler) =>
        runReportHandler(handler, req).catch((err) => {
          logReportError('[Overview Phase2] Handler error:', err?.message || err);
          return { success: false, data: null };
        })
      )
    );
    const [
      inventorySummary,
      inventoryMovements,
      fastestMovingItems,
      revenueByChannel,
      kpiSummary,
      topCustomers,
      pipelineSummary
    ] = results;
    const data = {
      inventorySummary: inventorySummary?.success ? inventorySummary.data : { totalStocks: 0, totalStockValue: 0, stockAvailabilityRate: 0 },
      inventoryMovements: inventoryMovements?.success ? inventoryMovements.data : [],
      fastestMovingItems: fastestMovingItems?.success ? fastestMovingItems.data : [],
      revenueByChannel: revenueByChannel?.success ? revenueByChannel.data : [],
      kpiSummary: kpiSummary?.success ? kpiSummary.data : { totalRevenue: 0, totalExpenses: 0, grossProfit: 0, activeCustomers: 0, pendingInvoices: 0 },
      topCustomers: topCustomers?.success ? topCustomers.data : [],
      pipelineSummary: pipelineSummary?.success ? pipelineSummary.data : { activeJobs: 0, openLeads: 0, pendingInvoices: 0 }
    };
    res.status(200).json({ success: true, data });
  } catch (error) {
    logReportError('Error in getOverviewPhase2:', error);
    next(error);
  }
};