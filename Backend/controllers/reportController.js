const { sequelize } = require('../config/database');
const { Job, Payment, Expense, Customer, Vendor, Invoice } = require('../models');
const { Op } = require('sequelize');

// @desc    Get revenue report
// @route   GET /api/reports/revenue
// @access  Private
exports.getRevenueReport = async (req, res, next) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;
    
    let dateFilter = {};
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter = {
        [Op.between]: [start, end]
      };
    }

    // Revenue by time period
    let revenueByPeriod = [];
    if (groupBy === 'day') {
      revenueByPeriod = await Payment.findAll({
        attributes: [
          [sequelize.fn('DATE', sequelize.col('paymentDate')), 'date'],
          [sequelize.fn('SUM', sequelize.col('amount')), 'totalRevenue'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        where: {
          type: 'income',
          status: 'completed',
          ...(Object.keys(dateFilter).length > 0 && { paymentDate: dateFilter })
        },
        group: [sequelize.fn('DATE', sequelize.col('paymentDate'))],
        order: [[sequelize.fn('DATE', sequelize.col('paymentDate')), 'ASC']]
      });
    } else if (groupBy === 'month') {
      revenueByPeriod = await Payment.findAll({
        attributes: [
          [sequelize.fn('EXTRACT', sequelize.literal('MONTH FROM "paymentDate"')), 'month'],
          [sequelize.fn('EXTRACT', sequelize.literal('YEAR FROM "paymentDate"')), 'year'],
          [sequelize.fn('SUM', sequelize.col('amount')), 'totalRevenue'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        where: {
          type: 'income',
          status: 'completed',
          ...(Object.keys(dateFilter).length > 0 && { paymentDate: dateFilter })
        },
        group: [
          sequelize.fn('EXTRACT', sequelize.literal('YEAR FROM "paymentDate"')),
          sequelize.fn('EXTRACT', sequelize.literal('MONTH FROM "paymentDate"'))
        ],
        order: [
          [sequelize.fn('EXTRACT', sequelize.literal('YEAR FROM "paymentDate"')), 'ASC'],
          [sequelize.fn('EXTRACT', sequelize.literal('MONTH FROM "paymentDate"')), 'ASC']
        ]
      });
    }

    // Revenue by customer
    const revenueByCustomer = await Payment.findAll({
      attributes: [
        'customerId',
        [sequelize.fn('SUM', sequelize.col('amount')), 'totalRevenue'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'paymentCount']
      ],
      where: {
        type: 'income',
        status: 'completed',
        ...(Object.keys(dateFilter).length > 0 && { paymentDate: dateFilter })
      },
      include: [{
        model: Customer,
        as: 'customer',
        attributes: ['id', 'name', 'company', 'email']
      }],
      group: ['customerId', 'customer.id'],
      order: [[sequelize.fn('SUM', sequelize.col('amount')), 'DESC']],
      limit: 20
    });

    // Revenue by payment method
    const revenueByMethod = await Payment.findAll({
      attributes: [
        'paymentMethod',
        [sequelize.fn('SUM', sequelize.col('amount')), 'totalRevenue'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: {
        type: 'income',
        status: 'completed',
        ...(Object.keys(dateFilter).length > 0 && { paymentDate: dateFilter })
      },
      group: ['paymentMethod'],
      order: [[sequelize.fn('SUM', sequelize.col('amount')), 'DESC']]
    });

    // Total revenue
    const totalRevenue = await Payment.sum('amount', {
      where: {
        type: 'income',
        status: 'completed',
        ...(Object.keys(dateFilter).length > 0 && { paymentDate: dateFilter })
      }
    }) || 0;

    res.status(200).json({
      success: true,
      data: {
        totalRevenue: parseFloat(totalRevenue),
        byPeriod: revenueByPeriod,
        byCustomer: revenueByCustomer,
        byMethod: revenueByMethod
      }
    });
  } catch (error) {
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
      where: {
        ...(Object.keys(dateFilter).length > 0 && { expenseDate: dateFilter })
      },
      group: ['category'],
      order: [[sequelize.fn('SUM', sequelize.col('amount')), 'DESC']]
    });

    // Expenses by vendor
    const expensesByVendor = await Expense.findAll({
      attributes: [
        'vendorId',
        [sequelize.fn('SUM', sequelize.col('amount')), 'totalAmount'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: {
        ...(Object.keys(dateFilter).length > 0 && { expenseDate: dateFilter })
      },
      include: [{
        model: Vendor,
        as: 'vendor',
        attributes: ['id', 'name', 'company', 'email']
      }],
      group: ['vendorId', 'vendor.id'],
      order: [[sequelize.fn('SUM', sequelize.col('amount')), 'DESC']],
      limit: 20
    });

    // Expenses by payment method
    const expensesByMethod = await Expense.findAll({
      attributes: [
        'paymentMethod',
        [sequelize.fn('SUM', sequelize.col('amount')), 'totalAmount'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: {
        ...(Object.keys(dateFilter).length > 0 && { expenseDate: dateFilter })
      },
      group: ['paymentMethod'],
      order: [[sequelize.fn('SUM', sequelize.col('amount')), 'DESC']]
    });

    // Expenses by date
    const expensesByDate = await Expense.findAll({
      attributes: [
        [sequelize.fn('DATE', sequelize.col('expenseDate')), 'date'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'totalAmount'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: {
        ...(Object.keys(dateFilter).length > 0 && { expenseDate: dateFilter })
      },
      group: [sequelize.fn('DATE', sequelize.col('expenseDate'))],
      order: [[sequelize.fn('DATE', sequelize.col('expenseDate')), 'ASC']]
    });

    // Total expenses
    const totalExpenses = await Expense.sum('amount', {
      where: {
        ...(Object.keys(dateFilter).length > 0 && { expenseDate: dateFilter })
      }
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
      where: {
        status: { [Op.in]: ['sent', 'partial', 'overdue'] },
        balance: { [Op.gt]: 0 },
        ...(Object.keys(dateFilter).length > 0 && { invoiceDate: dateFilter })
      },
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
        [sequelize.fn('SUM', sequelize.col('balance')), 'totalOutstanding'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'invoiceCount']
      ],
      where: {
        status: { [Op.in]: ['sent', 'partial', 'overdue'] },
        balance: { [Op.gt]: 0 },
        ...(Object.keys(dateFilter).length > 0 && { invoiceDate: dateFilter })
      },
      include: [{
        model: Customer,
        as: 'customer',
        attributes: ['id', 'name', 'company', 'email']
      }],
      group: ['customerId', 'customer.id'],
      order: [[sequelize.fn('SUM', sequelize.col('balance')), 'DESC']]
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
        where: {
          status: { [Op.in]: ['sent', 'partial', 'overdue'] },
          dueDate: { [Op.gte]: today }
        }
      }) || 0,
      thirtyDays: await Invoice.sum('balance', {
        where: {
          status: { [Op.in]: ['sent', 'partial', 'overdue'] },
          dueDate: { [Op.between]: [thirtyDaysAgo, today] }
        }
      }) || 0,
      sixtyDays: await Invoice.sum('balance', {
        where: {
          status: { [Op.in]: ['sent', 'partial', 'overdue'] },
          dueDate: { [Op.between]: [sixtyDaysAgo, thirtyDaysAgo] }
        }
      }) || 0,
      ninetyPlusDays: await Invoice.sum('balance', {
        where: {
          status: { [Op.in]: ['sent', 'partial', 'overdue'] },
          dueDate: { [Op.lt]: sixtyDaysAgo }
        }
      }) || 0
    };

    // Total outstanding
    const totalOutstanding = await Invoice.sum('balance', {
      where: {
        status: { [Op.in]: ['sent', 'partial', 'overdue'] },
        balance: { [Op.gt]: 0 },
        ...(Object.keys(dateFilter).length > 0 && { invoiceDate: dateFilter })
      }
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
    next(error);
  }
};

// @desc    Get sales report
// @route   GET /api/reports/sales
// @access  Private
exports.getSalesReport = async (req, res, next) => {
  try {
    const { startDate, endDate, groupBy = 'jobType' } = req.query;
    
    let dateFilter = {};
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter = {
        [Op.between]: [start, end]
      };
    }

    // Sales by job type
    const salesByJobType = await Job.findAll({
      attributes: [
        'jobType',
        [sequelize.fn('SUM', sequelize.col('finalPrice')), 'totalSales'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'jobCount'],
        [sequelize.fn('AVG', sequelize.col('finalPrice')), 'averagePrice']
      ],
      where: {
        ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
      },
      group: ['jobType'],
      order: [[sequelize.fn('SUM', sequelize.col('finalPrice')), 'DESC']]
    });

    // Sales by customer
    const salesByCustomer = await Job.findAll({
      attributes: [
        'customerId',
        [sequelize.fn('SUM', sequelize.col('finalPrice')), 'totalSales'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'jobCount']
      ],
      where: {
        ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
      },
      include: [{
        model: Customer,
        as: 'customer',
        attributes: ['id', 'name', 'company', 'email']
      }],
      group: ['customerId', 'customer.id'],
      order: [[sequelize.fn('SUM', sequelize.col('finalPrice')), 'DESC']],
      limit: 20
    });

    // Sales by date
    const salesByDate = await Job.findAll({
      attributes: [
        [sequelize.fn('DATE', sequelize.col('createdAt')), 'date'],
        [sequelize.fn('SUM', sequelize.col('finalPrice')), 'totalSales'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'jobCount']
      ],
      where: {
        ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
      },
      group: [sequelize.fn('DATE', sequelize.col('createdAt'))],
      order: [[sequelize.fn('DATE', sequelize.col('createdAt')), 'ASC']]
    });

    // Sales by status
    const salesByStatus = await Job.findAll({
      attributes: [
        'status',
        [sequelize.fn('SUM', sequelize.col('finalPrice')), 'totalSales'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'jobCount']
      ],
      where: {
        ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
      },
      group: ['status'],
      order: [[sequelize.fn('SUM', sequelize.col('finalPrice')), 'DESC']]
    });

    // Total sales
    const totalSales = await Job.sum('finalPrice', {
      where: {
        ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
      }
    }) || 0;

    res.status(200).json({
      success: true,
      data: {
        totalSales: parseFloat(totalSales),
        byJobType: salesByJobType,
        byCustomer: salesByCustomer,
        byDate: salesByDate,
        byStatus: salesByStatus
      }
    });
  } catch (error) {
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
    const revenue = await Payment.sum('amount', {
      where: {
        type: 'income',
        status: 'completed',
        ...(Object.keys(dateFilter).length > 0 && { paymentDate: dateFilter })
      }
    }) || 0;

    // Expenses
    const expenses = await Expense.sum('amount', {
      where: {
        ...(Object.keys(dateFilter).length > 0 && { expenseDate: dateFilter })
      }
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
    next(error);
  }
};

