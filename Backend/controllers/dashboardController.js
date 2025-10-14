const { sequelize } = require('../config/database');
const { Job, Payment, Expense, Customer, Vendor } = require('../models');
const { Op } = require('sequelize');

// @desc    Get dashboard overview
// @route   GET /api/dashboard/overview
// @access  Private
exports.getDashboardOverview = async (req, res, next) => {
  try {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    // Total customers and vendors
    const totalCustomers = await Customer.count({ where: { isActive: true } });
    const totalVendors = await Vendor.count({ where: { isActive: true } });

    // Jobs statistics
    const totalJobs = await Job.count();
    const pendingJobs = await Job.count({ where: { status: 'pending' } });
    const inProgressJobs = await Job.count({ where: { status: 'in_progress' } });
    const completedJobs = await Job.count({ where: { status: 'completed' } });

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

    // Expense statistics
    const totalExpenses = await Expense.sum('amount') || 0;

    const thisMonthExpenses = await Expense.sum('amount', {
      where: {
        expenseDate: {
          [Op.between]: [firstDayOfMonth, lastDayOfMonth]
        }
      }
    }) || 0;

    // Pending payments
    const pendingPayments = await Payment.count({
      where: { status: 'pending' }
    });

    // Recent jobs
    const recentJobs = await Job.findAll({
      limit: 5,
      order: [['createdAt', 'DESC']],
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'company'] }
      ]
    });

    res.status(200).json({
      success: true,
      data: {
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


