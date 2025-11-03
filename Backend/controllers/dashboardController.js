const { sequelize } = require('../config/database');
const { Job, Payment, Expense, Customer, Vendor } = require('../models');
const { Op } = require('sequelize');

// @desc    Get dashboard overview
// @route   GET /api/dashboard/overview
// @access  Private
exports.getDashboardOverview = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    // Set date range for filtering
    let dateFilter = {};
    let filteredPeriodData = null;
    
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // Include the entire end date
      dateFilter = {
        [Op.between]: [start, end]
      };
    }

    // Total customers and vendors
    const totalCustomers = await Customer.count({ where: { isActive: true } });
    const totalVendors = await Vendor.count({ where: { isActive: true } });

    // Jobs statistics
    const totalJobs = await Job.count();
    const pendingJobs = await Job.count({ where: { status: 'pending' } });
    const inProgressJobs = await Job.count({ where: { status: 'in_progress' } });
    const completedJobs = await Job.count({ where: { status: 'completed' } });

    // Filtered jobs statistics (if date filter is applied)
    let filteredJobs = null;
    let filteredPendingJobs = null;
    let filteredInProgressJobs = null;
    let filteredCompletedJobs = null;
    
    if (Object.keys(dateFilter).length > 0) {
      filteredJobs = await Job.count({ where: { createdAt: dateFilter } });
      filteredPendingJobs = await Job.count({ 
        where: { 
          status: 'pending',
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
    if (Object.keys(dateFilter).length > 0) {
      filteredRevenue = await Payment.sum('amount', {
        where: {
          type: 'income',
          status: 'completed',
          paymentDate: dateFilter
        }
      }) || 0;
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
    if (Object.keys(dateFilter).length > 0) {
      filteredExpenses = await Expense.sum('amount', {
        where: {
          expenseDate: dateFilter
        }
      }) || 0;
    }

    // Pending payments
    const pendingPayments = await Payment.count({
      where: { status: 'pending' }
    });

    // Recent jobs (filtered if date range is provided)
    const recentJobsWhere = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};
    const recentJobs = await Job.findAll({
      where: recentJobsWhere,
      limit: 5,
      order: [['createdAt', 'DESC']],
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'company'] }
      ]
    });

    // Prepare response data
    const responseData = {
      summary: {
        totalCustomers,
        totalVendors,
        totalJobs,
        pendingJobs,
        inProgressJobs,
        completedJobs
      },
      thisMonth: {
        jobs: thisMonthJobs,
        revenue: parseFloat(thisMonthRevenue).toFixed(2),
        expenses: parseFloat(thisMonthExpenses).toFixed(2),
        profit: parseFloat(thisMonthRevenue - thisMonthExpenses).toFixed(2)
      },
      allTime: {
        revenue: parseFloat(totalRevenue).toFixed(2),
        expenses: parseFloat(totalExpenses).toFixed(2),
        profit: parseFloat(totalRevenue - totalExpenses).toFixed(2)
      },
      pendingPayments,
      recentJobs
    };

    // Add filtered period data if date filter is applied
    if (Object.keys(dateFilter).length > 0) {
      responseData.filteredPeriod = {
        jobs: filteredJobs,
        revenue: parseFloat(filteredRevenue).toFixed(2),
        expenses: parseFloat(filteredExpenses).toFixed(2),
        profit: parseFloat(filteredRevenue - filteredExpenses).toFixed(2)
      };
      
      // Update summary with filtered data
      responseData.summary = {
        totalCustomers,
        totalVendors,
        totalJobs: filteredJobs,
        pendingJobs: filteredPendingJobs,
        inProgressJobs: filteredInProgressJobs,
        completedJobs: filteredCompletedJobs
      };
    }

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


