const { sequelize } = require('../config/database');
const { Job, Payment, Expense, Customer, Vendor } = require('../models');
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
    const { startDate, endDate } = req.query;
    logDashboardDebug('Received overview request', { startDate, endDate });
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

    // Total customers and vendors
    const totalCustomers = await Customer.count({ where: { isActive: true } });
    const totalVendors = await Vendor.count({ where: { isActive: true } });

    // Jobs statistics
    const totalJobs = await Job.count();
    const newJobs = await Job.count({ where: { status: 'new' } });
    const inProgressJobs = await Job.count({ where: { status: 'in_progress' } });
    const onHoldJobs = await Job.count({ where: { status: 'on_hold' } });
    const cancelledJobs = await Job.count({ where: { status: 'cancelled' } });
    const completedJobs = await Job.count({ where: { status: 'completed' } });

    // Filtered jobs statistics (if date filter is applied)
    let filteredJobs = null;
    let filteredNewJobs = null;
    let filteredInProgressJobs = null;
    let filteredOnHoldJobs = null;
    let filteredCancelledJobs = null;
    let filteredCompletedJobs = null;
    
    if (hasDateFilter) {
      filteredJobs = await Job.count({ where: { createdAt: dateFilter } });
      filteredNewJobs = await Job.count({ 
        where: { 
          status: 'new',
          createdAt: dateFilter 
        } 
      });
      filteredInProgressJobs = await Job.count({ 
        where: { 
          status: 'in_progress',
          createdAt: dateFilter 
        } 
      });
      filteredCompletedJobs = await Job.count({ 
        where: { 
          status: 'completed',
          createdAt: dateFilter 
        } 
      });
      filteredOnHoldJobs = await Job.count({
        where: {
          status: 'on_hold',
          createdAt: dateFilter
        }
      });
      filteredCancelledJobs = await Job.count({
        where: {
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

    // This month jobs
    const thisMonthJobs = await Job.count({
      where: {
        createdAt: {
          [Op.between]: [firstDayOfMonth, lastDayOfMonth]
        }
      }
    });

    // Revenue statistics
    const totalRevenue = await Payment.sum('amount', {
      where: {
        type: 'income',
        status: 'completed'
      }
    }) || 0;

    const thisMonthRevenue = await Payment.sum('amount', {
      where: {
        type: 'income',
        status: 'completed',
        paymentDate: {
          [Op.between]: [firstDayOfMonth, lastDayOfMonth]
        }
      }
    }) || 0;

    // Filtered revenue (if date filter is applied)
    let filteredRevenue = null;
    if (hasDateFilter) {
      filteredRevenue = await Payment.sum('amount', {
        where: {
          type: 'income',
          status: 'completed',
          paymentDate: dateFilter
        }
      }) || 0;
      logDashboardDebug('Filtered revenue total', { filteredRevenue });
    }

    // Expense statistics
    const totalExpenses = await Expense.sum('amount') || 0;

    const thisMonthExpenses = await Expense.sum('amount', {
      where: {
        expenseDate: {
          [Op.between]: [firstDayOfMonth, lastDayOfMonth]
        }
      }
    }) || 0;

    // Filtered expenses (if date filter is applied)
    let filteredExpenses = null;
    if (hasDateFilter) {
      filteredExpenses = await Expense.sum('amount', {
        where: {
          expenseDate: dateFilter
        }
      }) || 0;
      logDashboardDebug('Filtered expense total', { filteredExpenses });
    }

    // Pending payments
    const pendingPayments = await Payment.count({
      where: { status: 'pending' }
    });

    // Recent jobs (filtered if date range is provided)
    const recentJobsWhere = hasDateFilter ? { createdAt: dateFilter } : {};
    const recentJobs = await Job.findAll({
      where: {
        ...recentJobsWhere,
        status: 'in_progress'
      },
      limit: 5,
      order: [['createdAt', 'DESC']],
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'company'] }
      ]
    });
    logDashboardDebug('Recent jobs fetched', { count: recentJobs.length });

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
        completedJobs
      },
      currentMonth: currentMonthSummary,
      thisMonth: currentMonthSummary,
      allTime: allTimeSummary,
      pendingPayments,
      recentJobs
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
      logDashboardDebug('Response with filtered period', responseData.filteredPeriod);
    }

    logDashboardDebug('Returning overview response', {
      thisMonth: responseData.thisMonth,
      allTime: responseData.allTime
    });

    res.status(200).json({
      success: true,
      data: responseData
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
    const year = req.query.year || new Date().getFullYear();

    const revenueByMonth = await Payment.findAll({
      attributes: [
        [sequelize.fn('EXTRACT', sequelize.literal('MONTH FROM "paymentDate"')), 'month'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'totalRevenue']
      ],
      where: {
        type: 'income',
        status: 'completed',
        paymentDate: {
          [Op.between]: [
            new Date(`${year}-01-01`),
            new Date(`${year}-12-31`)
          ]
        }
      },
      group: [sequelize.fn('EXTRACT', sequelize.literal('MONTH FROM "paymentDate"'))],
      order: [[sequelize.fn('EXTRACT', sequelize.literal('MONTH FROM "paymentDate"')), 'ASC']]
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
    const expensesByCategory = await Expense.findAll({
      attributes: [
        'category',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'totalAmount']
      ],
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
    const limit = parseInt(req.query.limit) || 10;

    const topCustomers = await Payment.findAll({
      attributes: [
        'customerId',
        [sequelize.fn('SUM', sequelize.col('amount')), 'totalPaid'],
        [sequelize.fn('COUNT', sequelize.col('Payment.id')), 'paymentCount']
      ],
      where: {
        type: 'income',
        status: 'completed'
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
    const distribution = await Job.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
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


