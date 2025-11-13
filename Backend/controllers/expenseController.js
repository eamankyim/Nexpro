const { Expense, Vendor, Job } = require('../models');
const { Op } = require('sequelize');
const config = require('../config/config');
const { applyTenantFilter, sanitizePayload } = require('../utils/tenantUtils');

// Generate unique expense number
const generateExpenseNumber = async (tenantId) => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  
  const lastExpense = await Expense.findOne({
    where: {
      tenantId,
      expenseNumber: {
        [Op.like]: `EXP-${year}${month}%`
      }
    },
    order: [['createdAt', 'DESC']]
  });

  let sequence = 1;
  if (lastExpense) {
    const lastSequence = parseInt(lastExpense.expenseNumber.split('-')[2]);
    sequence = lastSequence + 1;
  }

  return `EXP-${year}${month}-${String(sequence).padStart(4, '0')}`;
};

// @desc    Get all expenses
// @route   GET /api/expenses
// @access  Private
exports.getExpenses = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || config.pagination.defaultPageSize;
    const offset = (page - 1) * limit;
    const category = req.query.category;
    const status = req.query.status;
    const jobId = req.query.jobId;

    const where = applyTenantFilter(req.tenantId, {});
    if (category && category !== 'null') where.category = category;
    if (status && status !== 'null') where.status = status;
    if (jobId && jobId !== 'null') where.jobId = jobId;

    const { count, rows } = await Expense.findAndCountAll({
      where,
      limit,
      offset,
      include: [
        { model: Vendor, as: 'vendor', attributes: ['id', 'name', 'company'] },
        { model: Job, as: 'job', attributes: ['id', 'jobNumber', 'title'] }
      ],
      order: [['expenseDate', 'DESC']]
    });

    res.status(200).json({
      success: true,
      count,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(count / limit)
      },
      data: rows
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single expense
// @route   GET /api/expenses/:id
// @access  Private
exports.getExpense = async (req, res, next) => {
  try {
    const expense = await Expense.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id }),
      include: [
        { model: Vendor, as: 'vendor' },
        { model: Job, as: 'job' }
      ]
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    res.status(200).json({
      success: true,
      data: expense
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new expense
// @route   POST /api/expenses
// @access  Private
exports.createExpense = async (req, res, next) => {
  try {
    const payload = sanitizePayload(req.body);
    const expenseNumber = await generateExpenseNumber(req.tenantId);

    if (payload.vendorId) {
      const vendor = await Vendor.findOne({
        where: applyTenantFilter(req.tenantId, { id: payload.vendorId })
      });
      if (!vendor) {
        return res.status(400).json({
          success: false,
          message: 'Vendor not found for this tenant'
        });
      }
    }

    if (payload.jobId) {
      const job = await Job.findOne({
        where: applyTenantFilter(req.tenantId, { id: payload.jobId })
      });
      if (!job) {
        return res.status(400).json({
          success: false,
          message: 'Job not found for this tenant'
        });
      }
    }
    const expense = await Expense.create({
      ...payload,
      tenantId: req.tenantId,
      expenseNumber
    });

    const expenseWithDetails = await Expense.findOne({
      where: applyTenantFilter(req.tenantId, { id: expense.id }),
      include: [
        { model: Vendor, as: 'vendor' },
        { model: Job, as: 'job' }
      ]
    });

    res.status(201).json({
      success: true,
      data: expenseWithDetails
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update expense
// @route   PUT /api/expenses/:id
// @access  Private
exports.updateExpense = async (req, res, next) => {
  try {
    const expense = await Expense.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    const updatePayload = sanitizePayload(req.body);

    if (updatePayload.vendorId) {
      const vendor = await Vendor.findOne({
        where: applyTenantFilter(req.tenantId, { id: updatePayload.vendorId })
      });
      if (!vendor) {
        return res.status(400).json({
          success: false,
          message: 'Vendor not found for this tenant'
        });
      }
    }

    if (updatePayload.jobId) {
      const job = await Job.findOne({
        where: applyTenantFilter(req.tenantId, { id: updatePayload.jobId })
      });
      if (!job) {
        return res.status(400).json({
          success: false,
          message: 'Job not found for this tenant'
        });
      }
    }

    await expense.update(updatePayload);

    const updatedExpense = await Expense.findOne({
      where: applyTenantFilter(req.tenantId, { id: expense.id }),
      include: [
        { model: Vendor, as: 'vendor' },
        { model: Job, as: 'job' }
      ]
    });

    res.status(200).json({
      success: true,
      data: updatedExpense
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete expense
// @route   DELETE /api/expenses/:id
// @access  Private
exports.deleteExpense = async (req, res, next) => {
  try {
    const expense = await Expense.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    await expense.destroy();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get expense statistics
// @route   GET /api/expenses/stats/overview
// @access  Private
exports.getExpenseStats = async (req, res, next) => {
  try {
    const { sequelize } = require('../config/database');
    const { jobId, startDate, endDate } = req.query;

    const baseFilters = applyTenantFilter(req.tenantId, {});

    if (jobId) {
      baseFilters.jobId = jobId;
    }

    const dateFilters = {};
    if (startDate && endDate) {
      dateFilters.expenseDate = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }

    const combinedFilters = { ...baseFilters, ...dateFilters };

    const stats = await Expense.findAll({
      where: combinedFilters,
      attributes: [
        'category',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'totalAmount']
      ],
      group: ['category']
    });

    // Get total expenses for the period
    const totalExpensesRaw = await Expense.sum('amount', { where: combinedFilters }) || 0;
    const totalExpenses = Number(parseFloat(totalExpensesRaw).toFixed(2));

    // Get current month expenses
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const endOfMonth = new Date(startOfMonth);
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);
    endOfMonth.setDate(0);
    endOfMonth.setHours(23, 59, 59, 999);

    const monthlyWhereClause = {
      ...baseFilters,
      expenseDate: {
        [Op.between]: [startOfMonth, endOfMonth]
      }
    };

    const thisMonthExpensesRaw = await Expense.sum('amount', { where: monthlyWhereClause }) || 0;
    const thisMonthExpenses = Number(parseFloat(thisMonthExpensesRaw).toFixed(2));
    
    // Get job-specific expenses if jobId is provided
    let jobExpenses = null;
    if (jobId) {
      jobExpenses = await Expense.findAll({
        where: applyTenantFilter(req.tenantId, { jobId }),
        include: [
          { model: Job, as: 'job', attributes: ['id', 'jobNumber', 'title'] }
        ],
        order: [['expenseDate', 'DESC']]
      });
    }

    res.status(200).json({
      success: true,
      data: {
        categoryStats: stats,
        totalExpenses,
        thisMonthExpenses,
        jobExpenses
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get expenses by job
// @route   GET /api/expenses/by-job/:jobId
// @access  Private
exports.getExpensesByJob = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const job = await Job.findOne({
      where: applyTenantFilter(req.tenantId, { id: jobId })
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found for this tenant'
      });
    }

    const { count, rows } = await Expense.findAndCountAll({
      where: applyTenantFilter(req.tenantId, { jobId }),
      limit,
      offset,
      include: [
        { model: Vendor, as: 'vendor', attributes: ['id', 'name', 'company'] },
        { model: Job, as: 'job', attributes: ['id', 'jobNumber', 'title'] }
      ],
      order: [['expenseDate', 'DESC']]
    });

    // Get total amount for this job
    const totalAmount =
      (await Expense.sum('amount', { where: applyTenantFilter(req.tenantId, { jobId }) })) || 0;

    res.status(200).json({
      success: true,
      count,
      totalAmount: parseFloat(totalAmount).toFixed(2),
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(count / limit)
      },
      data: rows
    });
  } catch (error) {
    next(error);
  }
};


