const { Expense, Vendor, Job } = require('../models');
const { Op } = require('sequelize');
const config = require('../config/config');

// Generate unique expense number
const generateExpenseNumber = async () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  
  const lastExpense = await Expense.findOne({
    where: {
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

    const where = {};
    if (category) where.category = category;
    if (status) where.status = status;

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
    const expense = await Expense.findByPk(req.params.id, {
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
    const expenseNumber = await generateExpenseNumber();
    const expense = await Expense.create({
      ...req.body,
      expenseNumber
    });

    const expenseWithDetails = await Expense.findByPk(expense.id, {
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
    const expense = await Expense.findByPk(req.params.id);

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    await expense.update(req.body);

    const updatedExpense = await Expense.findByPk(expense.id, {
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
    const expense = await Expense.findByPk(req.params.id);

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

    const stats = await Expense.findAll({
      attributes: [
        'category',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'totalAmount']
      ],
      group: ['category']
    });

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};


