const { sequelize } = require('../config/database');
const { Job, Expense, Customer, Vendor, Invoice, Tenant, Sale, SaleItem, InventoryItem } = require('../models');
const { Op } = require('sequelize');
const config = require('../config/config');

const logDashboardDebug = (...args) => {
  if (config.nodeEnv === 'development') {
    console.log('[DashboardController]', ...args);
  }
};

// @desc    Get dashboard overview
// @route   GET /api/dashboard/overview
// @access  Private
exports.getDashboardOverview = async (req, res, next) => {
  try {
    // Ensure tenantId is available (set by tenantContext middleware)
    if (!req.tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant context is required'
      });
    }

    const { startDate, endDate } = req.query;
    const tenantId = req.tenantId;
    logDashboardDebug('Received overview request', { startDate, endDate, tenantId });

    // Get tenant business type
    const tenant = await Tenant.findByPk(tenantId, {
      attributes: ['id', 'businessType', 'name']
    });
    const businessType = tenant?.businessType || 'printing_press';
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    firstDayOfMonth.setHours(0, 0, 0, 0);
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    lastDayOfMonth.setHours(23, 59, 59, 999);

    // Set date range for filtering
    let dateFilter = null;
    let filterStart = null;
    let filterEnd = null;
    const hasDateFilter = Boolean(startDate && endDate);
    
    if (hasDateFilter) {
      filterStart = new Date(startDate);
      filterStart.setHours(0, 0, 0, 0);
      filterEnd = new Date(endDate);
      filterEnd.setHours(23, 59, 59, 999); // Include the entire end date
      dateFilter = {
        [Op.between]: [filterStart, filterEnd]
      };
      logDashboardDebug('Applied date filter', {
        start: filterStart.toISOString(),
        end: filterEnd.toISOString()
      });
    }

    // Total customers and vendors - FILTER BY TENANT
    const totalCustomers = await Customer.count({ where: { tenantId, isActive: true } });
    const totalVendors = await Vendor.count({ where: { tenantId, isActive: true } });

    // Jobs statistics - FILTER BY TENANT
    const totalJobs = await Job.count({ where: { tenantId } });
    const newJobs = await Job.count({ where: { tenantId, status: 'new' } });
    const inProgressJobs = await Job.count({ where: { tenantId, status: 'in_progress' } });
    const onHoldJobs = await Job.count({ where: { tenantId, status: 'on_hold' } });
    const cancelledJobs = await Job.count({ where: { tenantId, status: 'cancelled' } });
    const completedJobs = await Job.count({ where: { tenantId, status: 'completed' } });

    // Filtered jobs statistics (if date filter is applied)
    let filteredJobs = null;
    let filteredNewJobs = null;
    let filteredInProgressJobs = null;
    let filteredOnHoldJobs = null;
    let filteredCancelledJobs = null;
    let filteredCompletedJobs = null;
    
    if (hasDateFilter) {
      filteredJobs = await Job.count({ where: { tenantId, createdAt: dateFilter } });
      filteredNewJobs = await Job.count({ 
        where: { 
          tenantId,
          status: 'new',
          createdAt: dateFilter 
        } 
      });
      filteredInProgressJobs = await Job.count({ 
        where: { 
          tenantId,
          status: 'in_progress',
          createdAt: dateFilter 
        } 
      });
      filteredCompletedJobs = await Job.count({ 
        where: { 
          tenantId,
          status: 'completed',
          createdAt: dateFilter 
        } 
      });
      filteredOnHoldJobs = await Job.count({
        where: {
          tenantId,
          status: 'on_hold',
          createdAt: dateFilter
        }
      });
      filteredCancelledJobs = await Job.count({
        where: {
          tenantId,
          status: 'cancelled',
          createdAt: dateFilter
        }
      });
      
      logDashboardDebug('Filtered job counts', {
        filteredJobs,
        filteredNewJobs,
        filteredInProgressJobs,
        filteredOnHoldJobs,
        filteredCancelledJobs,
        filteredCompletedJobs
      });
    }

    // This month jobs - FILTER BY TENANT
    const thisMonthJobs = await Job.count({
      where: {
        tenantId,
        createdAt: {
          [Op.between]: [firstDayOfMonth, lastDayOfMonth]
        }
      }
    });

    // Revenue statistics (from paid invoices) - FILTER BY TENANT
    const totalRevenue = await Invoice.sum('amountPaid', {
      where: {
        tenantId,
        status: 'paid'
      }
    }) || 0;

    const thisMonthRevenue = await Invoice.sum('amountPaid', {
      where: {
        tenantId,
        status: 'paid',
        paidDate: {
          [Op.between]: [firstDayOfMonth, lastDayOfMonth]
        }
      }
    }) || 0;

    // Filtered revenue (if date filter is applied) - FILTER BY TENANT
    let filteredRevenue = null;
    if (hasDateFilter) {
      filteredRevenue = await Invoice.sum('amountPaid', {
        where: {
          tenantId,
          status: 'paid',
          paidDate: dateFilter
        }
      }) || 0;
      logDashboardDebug('Filtered revenue total', { filteredRevenue });
    }

    // Expense statistics - FILTER BY TENANT
    const totalExpenses = await Expense.sum('amount', { where: { tenantId } }) || 0;

    const thisMonthExpenses = await Expense.sum('amount', {
      where: {
        tenantId,
        expenseDate: {
          [Op.between]: [firstDayOfMonth, lastDayOfMonth]
        }
      }
    }) || 0;

    // Filtered expenses (if date filter is applied) - FILTER BY TENANT
    let filteredExpenses = null;
    if (hasDateFilter) {
      filteredExpenses = await Expense.sum('amount', {
        where: {
          tenantId,
          expenseDate: dateFilter
        }
      }) || 0;
      logDashboardDebug('Filtered expense total', { filteredExpenses });
    }

    // Outstanding invoices balance - FILTER BY TENANT
    const outstandingBalance = await Invoice.sum('balance', {
      where: {
        tenantId,
        status: { [Op.ne]: 'paid' }
      }
    }) || 0;

    // In-progress jobs - FILTER BY TENANT (ALWAYS show all in-progress jobs for this tenant, ignore date filter)
    const recentJobs = await Job.findAll({
      where: {
        tenantId,
        status: 'in_progress'
      },
      order: [['dueDate', 'ASC'], ['createdAt', 'DESC']],
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'company'] }
      ]
    });
    logDashboardDebug('In-progress jobs fetched', { count: recentJobs.length });

    // Prepare response data
    const currentMonthSummary = {
      jobs: thisMonthJobs,
      revenue: Number(parseFloat(thisMonthRevenue).toFixed(2)),
      expenses: Number(parseFloat(thisMonthExpenses).toFixed(2)),
      profit: Number(parseFloat(thisMonthRevenue - thisMonthExpenses).toFixed(2)),
      range: {
        start: firstDayOfMonth.toISOString(),
        end: lastDayOfMonth.toISOString()
      }
    };

    const allTimeSummary = {
      revenue: Number(parseFloat(totalRevenue).toFixed(2)),
      expenses: Number(parseFloat(totalExpenses).toFixed(2)),
      profit: Number(parseFloat(totalRevenue - totalExpenses).toFixed(2))
    };

    // Shop-specific data
    let shopData = null;
    if (businessType === 'shop') {
      try {
        // Today's sales
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      
      const todaySales = await Sale.sum('total', {
        where: {
          tenantId,
          status: 'completed',
          createdAt: {
            [Op.between]: [todayStart, todayEnd]
          }
        }
      }) || 0;

      // This week's sales
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date();
      weekEnd.setHours(23, 59, 59, 999);
      
      const weekSales = await Sale.sum('total', {
        where: {
          tenantId,
          status: 'completed',
          createdAt: {
            [Op.between]: [weekStart, weekEnd]
          }
        }
      }) || 0;

      // This month's sales
      const monthSales = await Sale.sum('total', {
        where: {
          tenantId,
          status: 'completed',
          createdAt: {
            [Op.between]: [firstDayOfMonth, lastDayOfMonth]
          }
        }
      }) || 0;

      // Total sales count
      const totalSales = await Sale.count({
        where: { tenantId, status: 'completed' }
      });

      // Today's sales count
      const todaySalesCount = await Sale.count({
        where: {
          tenantId,
          status: 'completed',
          createdAt: {
            [Op.between]: [todayStart, todayEnd]
          }
        }
      });

      // Low stock items
      const lowStockItems = await InventoryItem.count({
        where: {
          tenantId,
          isActive: true,
          quantityOnHand: {
            [Op.lte]: sequelize.col('reorderLevel')
          }
        }
      });

      // Total inventory items
      const totalInventoryItems = await InventoryItem.count({
        where: { tenantId, isActive: true }
      });

      // Recent sales (last 5)
      const recentSales = await Sale.findAll({
        where: { tenantId },
        limit: 5,
        order: [['createdAt', 'DESC']],
        include: [
          { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'], required: false }
        ]
      });

      // Top selling products (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const topProducts = await sequelize.query(`
        SELECT 
          "SaleItem"."productId",
          "SaleItem"."name" as "productName",
          SUM("SaleItem"."quantity") as "totalQuantity",
          SUM("SaleItem"."total") as "totalRevenue",
          COUNT(DISTINCT "SaleItem"."saleId") as "saleCount"
        FROM "sale_items" AS "SaleItem"
        INNER JOIN "sales" AS "Sale" ON "SaleItem"."saleId" = "Sale"."id"
        WHERE "Sale"."tenantId" = :tenantId
          AND "Sale"."status" = 'completed'
          AND "Sale"."createdAt" >= :thirtyDaysAgo
        GROUP BY "SaleItem"."productId", "SaleItem"."name"
        ORDER BY SUM("SaleItem"."total") DESC
        LIMIT 5
      `, {
        replacements: {
          tenantId,
          thirtyDaysAgo: thirtyDaysAgo.toISOString()
        },
        type: sequelize.QueryTypes.SELECT
      });

      shopData = {
        todaySales: Number(parseFloat(todaySales).toFixed(2)),
        weekSales: Number(parseFloat(weekSales).toFixed(2)),
        monthSales: Number(parseFloat(monthSales).toFixed(2)),
        totalSales,
        todaySalesCount,
        lowStockItems,
        totalInventoryItems,
        recentSales: recentSales.map(sale => ({
          id: sale.id,
          saleNumber: sale.saleNumber,
          total: Number(parseFloat(sale.total).toFixed(2)),
          customer: sale.customer ? { name: sale.customer.name, phone: sale.customer.phone } : null,
          createdAt: sale.createdAt,
          paymentMethod: sale.paymentMethod
        })),
        topProducts: topProducts.map(product => ({
          productId: product.productId,
          productName: product.productName,
          totalQuantity: Number(parseFloat(product.totalQuantity).toFixed(2)),
          totalRevenue: Number(parseFloat(product.totalRevenue).toFixed(2)),
          saleCount: parseInt(product.saleCount)
        }))
      };
      } catch (error) {
        const isMissingTable = error?.name === 'SequelizeDatabaseError' && /relation ["']?\w+["']? does not exist/i.test(String(error?.parent?.message || ''));
        if (isMissingTable) {
          logDashboardDebug('Shop/sales tables not present, using empty shop data. Run migrations/create-shop-pharmacy-tables.js if you need shop features.');
        } else {
          logDashboardDebug('Error fetching shop data', error);
          console.error('[DashboardController] Error fetching shop data:', error);
        }
        shopData = {
          todaySales: 0,
          weekSales: 0,
          monthSales: 0,
          totalSales: 0,
          todaySalesCount: 0,
          lowStockItems: 0,
          totalInventoryItems: 0,
          recentSales: [],
          topProducts: []
        };
      }
    }

    const responseData = {
      summary: {
        totalCustomers,
        totalVendors,
        totalJobs,
        newJobs,
        pendingJobs: newJobs,
        inProgressJobs,
        onHoldJobs,
        cancelledJobs,
        completedJobs,
        outstandingBalance: Number(parseFloat(outstandingBalance).toFixed(2))
      },
      currentMonth: currentMonthSummary,
      thisMonth: currentMonthSummary,
      allTime: allTimeSummary,
      recentJobs,
      shopData
    };

    // Add filtered period data if date filter is applied
    if (hasDateFilter) {
      const filteredRevenueValue = Number(parseFloat(filteredRevenue || 0).toFixed(2));
      const filteredExpensesValue = Number(parseFloat(filteredExpenses || 0).toFixed(2));
      const filteredProfitValue = Number(parseFloat(filteredRevenueValue - filteredExpensesValue).toFixed(2));

      responseData.filteredPeriod = {
        jobs: filteredJobs ?? 0,
        revenue: filteredRevenueValue,
        expenses: filteredExpensesValue,
        profit: filteredProfitValue,
        range: {
          start: filterStart.toISOString(),
          end: filterEnd.toISOString()
        }
      };
      responseData.thisMonth = responseData.filteredPeriod;
      
      // Override summary with filtered job status counts
      responseData.summary = {
        ...responseData.summary,
        totalJobs: filteredJobs ?? 0,
        newJobs: filteredNewJobs ?? 0,
        pendingJobs: filteredNewJobs ?? 0,
        inProgressJobs: filteredInProgressJobs ?? 0,
        onHoldJobs: filteredOnHoldJobs ?? 0,
        cancelledJobs: filteredCancelledJobs ?? 0,
        completedJobs: filteredCompletedJobs ?? 0
      };
      
      logDashboardDebug('Response with filtered period', responseData.filteredPeriod);
    }

    logDashboardDebug('Returning overview response', {
      thisMonth: responseData.thisMonth,
      allTime: responseData.allTime
    });

    res.status(200).json({
      success: true,
      data: {
        ...responseData,
        businessType // Include business type in response
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get revenue by month
// @route   GET /api/dashboard/revenue-by-month
// @access  Private
exports.getRevenueByMonth = async (req, res, next) => {
  try {
    // Ensure tenantId is available
    if (!req.tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant context is required'
      });
    }

    const year = req.query.year || new Date().getFullYear();
    const tenantId = req.tenantId;

    const revenueByMonth = await Invoice.findAll({
      attributes: [
        [sequelize.fn('EXTRACT', sequelize.literal('MONTH FROM "paidDate"')), 'month'],
        [sequelize.fn('SUM', sequelize.col('amountPaid')), 'totalRevenue']
      ],
      where: {
        tenantId,
        status: 'paid',
        paidDate: {
          [Op.between]: [
            new Date(`${year}-01-01`),
            new Date(`${year}-12-31`)
          ]
        }
      },
      group: [sequelize.fn('EXTRACT', sequelize.literal('MONTH FROM "paidDate"'))],
      order: [[sequelize.fn('EXTRACT', sequelize.literal('MONTH FROM "paidDate"')), 'ASC']]
    });

    res.status(200).json({
      success: true,
      data: revenueByMonth
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get expenses by category
// @route   GET /api/dashboard/expenses-by-category
// @access  Private
exports.getExpensesByCategory = async (req, res, next) => {
  try {
    // Ensure tenantId is available
    if (!req.tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant context is required'
      });
    }

    const tenantId = req.tenantId;

    const expensesByCategory = await Expense.findAll({
      attributes: [
        'category',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'totalAmount']
      ],
      where: { tenantId },
      group: ['category'],
      order: [[sequelize.fn('SUM', sequelize.col('amount')), 'DESC']]
    });

    res.status(200).json({
      success: true,
      data: expensesByCategory
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get top customers
// @route   GET /api/dashboard/top-customers
// @access  Private
exports.getTopCustomers = async (req, res, next) => {
  try {
    // Ensure tenantId is available
    if (!req.tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant context is required'
      });
    }

    const limit = parseInt(req.query.limit) || 10;
    const tenantId = req.tenantId;

    const topCustomers = await Invoice.findAll({
      attributes: [
        'customerId',
        [sequelize.fn('SUM', sequelize.col('amountPaid')), 'totalPaid'],
        [sequelize.fn('COUNT', sequelize.col('Invoice.id')), 'invoiceCount']
      ],
      where: {
        tenantId,
        status: 'paid'
      },
      include: [{
        model: Customer,
        as: 'customer',
        attributes: ['id', 'name', 'company', 'email']
      }],
      group: ['customerId', 'customer.id'],
      order: [[sequelize.fn('SUM', sequelize.col('amount')), 'DESC']],
      limit
    });

    res.status(200).json({
      success: true,
      data: topCustomers
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get job status distribution
// @route   GET /api/dashboard/job-status-distribution
// @access  Private
exports.getJobStatusDistribution = async (req, res, next) => {
  try {
    // Ensure tenantId is available
    if (!req.tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant context is required'
      });
    }

    const tenantId = req.tenantId;

    const distribution = await Job.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: { tenantId },
      group: ['status']
    });

    res.status(200).json({
      success: true,
      data: distribution
    });
  } catch (error) {
    next(error);
  }
};


