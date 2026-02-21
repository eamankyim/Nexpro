const { Op } = require('sequelize');
const { Expense, User } = require('../models');
const ExpenseActivity = require('../models/ExpenseActivity');
const { sequelize } = require('../config/database');
const { getPagination } = require('../utils/paginationUtils');
const { sanitizePayload } = require('../utils/tenantUtils');
const { generateAdminExpenseNumber } = require('./expenseController');
const { getAdminExpenseCategories } = require('../config/adminExpenseCategories');

/**
 * Get expense categories for platform admin (internal) expenses.
 * These are admin-specific and not tenant or business-type dependent.
 * @route   GET /api/admin/expenses/categories
 */
exports.getAdminExpenseCategories = async (req, res, next) => {
  try {
    const categories = getAdminExpenseCategories();
    res.status(200).json({
      success: true,
      data: categories
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all internal (platform) expenses for Control Panel
 * Only expenses with tenantId IS NULL - not tenant expenses
 */
exports.getAdminExpenses = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const search = req.query.search || '';
    const category = req.query.category;
    const status = req.query.status;
    const approvalStatus = req.query.approvalStatus;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const includeArchived = req.query.includeArchived === 'true';

    const where = { tenantId: null };
    
    // Search across expense number, description, category
    if (search) {
      where[Op.or] = [
        { expenseNumber: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
        { category: { [Op.iLike]: `%${search}%` } }
      ];
    }
    
    if (category && category !== 'all') {
      where.category = category;
    }
    
    if (status && status !== 'all') {
      where.status = status;
    }
    
    if (approvalStatus && approvalStatus !== 'all') {
      where.approvalStatus = approvalStatus;
    }
    
    // Date range filter
    if (startDate || endDate) {
      where.expenseDate = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        where.expenseDate[Op.gte] = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.expenseDate[Op.lte] = end;
      }
    }
    
    // Exclude archived expenses by default
    if (!includeArchived) {
      where.isArchived = false;
    }

    const { count, rows } = await Expense.findAndCountAll({
      where,
      limit,
      offset,
      include: [
        {
          model: User,
          as: 'submitter',
          attributes: ['id', 'name', 'email']
        },
        {
          model: User,
          as: 'approver',
          attributes: ['id', 'name', 'email']
        }
      ],
      order: [['expenseDate', 'DESC'], ['createdAt', 'DESC']]
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

/**
 * Get single internal expense by ID
 */
exports.getAdminExpense = async (req, res, next) => {
  try {
    const expense = await Expense.findOne({
      where: { id: req.params.id, tenantId: null },
      include: [
        {
          model: User,
          as: 'submitter',
          attributes: ['id', 'name', 'email']
        },
        {
          model: User,
          as: 'approver',
          attributes: ['id', 'name', 'email']
        },
        {
          model: ExpenseActivity,
          as: 'activities',
          include: [
            {
              model: User,
              as: 'createdByUser',
              attributes: ['id', 'name', 'email']
            }
          ],
          order: [['createdAt', 'DESC']],
          limit: 50
        }
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

/**
 * Get expense statistics for internal (platform) expenses only
 */
exports.getAdminExpenseStats = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const where = { isArchived: false, tenantId: null };
    
    if (startDate || endDate) {
      where.expenseDate = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        where.expenseDate[Op.gte] = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.expenseDate[Op.lte] = end;
      }
    }

    // Total expenses
    const totalExpensesRaw = await Expense.sum('amount', { where }) || 0;
    const totalExpenses = Number(parseFloat(totalExpensesRaw).toFixed(2));

    // Current month expenses
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const endOfMonth = new Date(startOfMonth);
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);
    endOfMonth.setDate(0);
    endOfMonth.setHours(23, 59, 59, 999);

    const monthlyWhere = {
      ...where,
      expenseDate: {
        [Op.between]: [startOfMonth, endOfMonth]
      }
    };
    const thisMonthExpensesRaw = await Expense.sum('amount', { where: monthlyWhere }) || 0;
    const thisMonthExpenses = Number(parseFloat(thisMonthExpensesRaw).toFixed(2));

    // Category breakdown
    const categoryStats = await Expense.findAll({
      where,
      attributes: [
        'category',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'totalAmount']
      ],
      group: ['category'],
      order: [[sequelize.fn('SUM', sequelize.col('amount')), 'DESC']]
    });

    // Status breakdown
    const statusStats = await Expense.findAll({
      where,
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'totalAmount']
      ],
      group: ['status']
    });

    // Approval status breakdown
    const approvalStatusStats = await Expense.findAll({
      where,
      attributes: [
        'approvalStatus',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'totalAmount']
      ],
      group: ['approvalStatus']
    });

    // Pending requests count
    const pendingRequests = await Expense.count({
      where: {
        ...where,
        approvalStatus: 'pending_approval'
      }
    });

    // Total count
    const totalCount = await Expense.count({ where });

    res.status(200).json({
      success: true,
      data: {
        totals: {
          totalExpenses,
          thisMonth: thisMonthExpenses,
          totalCount,
          pendingRequests
        },
        categoryStats,
        statusStats,
        approvalStatusStats
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create internal (platform) expense (Control Panel only)
 * No tenant - these are platform/internal operating expenses
 */
exports.createAdminExpense = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const payload = sanitizePayload(req.body);
    delete payload.tenantId;
    delete payload.vendorId;
    delete payload.jobId;

    const expenseNumber = await generateAdminExpenseNumber(transaction);

    const expense = await Expense.create({
      ...payload,
      tenantId: null,
      vendorId: null,
      jobId: null,
      expenseNumber,
      submittedBy: req.user?.id || req.userId,
      approvalStatus: 'approved',
      approvedBy: req.user?.id || req.userId,
      approvedAt: new Date()
    }, { transaction });

    const expenseWithDetails = await Expense.findOne({
      where: { id: expense.id },
      include: [
        { model: User, as: 'submitter', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'approver', attributes: ['id', 'name', 'email'] }
      ],
      transaction
    });

    try {
      await ExpenseActivity.create({
        expenseId: expense.id,
        tenantId: null,
        type: 'creation',
        subject: 'Expense Created',
        notes: `Expense ${expense.expenseNumber} was created and auto-approved by platform admin`,
        createdBy: req.user?.id || req.userId,
        metadata: {
          amount: expense.amount,
          category: expense.category,
          autoApproved: true,
          createdByPlatformAdmin: true
        }
      }, { transaction });
    } catch (activityErr) {
      console.error('Failed to create expense activity:', activityErr);
    }

    await transaction.commit();

    res.status(201).json({
      success: true,
      data: expenseWithDetails
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};
