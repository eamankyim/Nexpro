const { Op, Sequelize } = require('sequelize');
const {
  Account,
  JournalEntry,
  JournalEntryLine,
  AccountBalance,
  User
} = require('../models');
const accountingService = require('../services/accountingService');

const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'income', 'expense', 'cogs', 'other'];

const buildAccountWhere = (query) => {
  const where = {};

  if (query.search) {
    where[Op.or] = [
      { code: { [Op.iLike]: `%${query.search}%` } },
      { name: { [Op.iLike]: `%${query.search}%` } }
    ];
  }

  if (query.type && query.type !== 'all') {
    where.type = query.type;
  }

  if (query.category) {
    where.category = query.category;
  }

  if (query.isActive !== undefined) {
    where.isActive = query.isActive === 'true';
  }

  return where;
};

exports.getAccounts = async (req, res, next) => {
  try {
    const where = buildAccountWhere(req.query);
    const accounts = await Account.findAll({
      where,
      order: [['code', 'ASC']]
    });

    res.status(200).json({ success: true, data: accounts });
  } catch (error) {
    next(error);
  }
};

exports.createAccount = async (req, res, next) => {
  try {
    const { code, name, type } = req.body;

    if (!code || !name || !type) {
      return res.status(400).json({ success: false, message: 'code, name and type are required' });
    }

    if (!ACCOUNT_TYPES.includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid account type' });
    }

    const account = await Account.create(req.body);
    res.status(201).json({ success: true, data: account });
  } catch (error) {
    next(error);
  }
};

exports.updateAccount = async (req, res, next) => {
  try {
    const account = await Account.findByPk(req.params.id);
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    if (req.body.type && !ACCOUNT_TYPES.includes(req.body.type)) {
      return res.status(400).json({ success: false, message: 'Invalid account type' });
    }

    await account.update(req.body);
    res.status(200).json({ success: true, data: account });
  } catch (error) {
    next(error);
  }
};

exports.getJournalEntries = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const where = {};

    if (req.query.status && req.query.status !== 'all') {
      where.status = req.query.status;
    }

    if (req.query.startDate) {
      where.entryDate = { ...where.entryDate, [Op.gte]: req.query.startDate };
    }
    if (req.query.endDate) {
      where.entryDate = { ...where.entryDate, [Op.lte]: req.query.endDate };
    }

    const { count, rows } = await JournalEntry.findAndCountAll({
      where,
      limit,
      offset,
      order: [['entryDate', 'DESC'], ['createdAt', 'DESC']],
      include: [
        { model: User, as: 'creator', attributes: ['id', 'name'] },
        { model: User, as: 'approver', attributes: ['id', 'name'] },
        {
          model: JournalEntryLine,
          as: 'lines',
          include: [{ model: Account, as: 'account', attributes: ['id', 'code', 'name', 'type'] }]
        }
      ]
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

exports.createJournalEntry = async (req, res, next) => {
  try {
    const journal = await accountingService.createJournalEntry({
      reference: req.body.reference,
      description: req.body.description,
      entryDate: req.body.entryDate,
      status: req.body.status || 'draft',
      lines: req.body.lines,
      source: req.body.source,
      sourceId: req.body.sourceId,
      metadata: req.body.metadata,
      userId: req.user?.id || null,
      approvedBy: req.body.approvedBy || null
    });

    res.status(201).json({ success: true, data: journal });
  } catch (error) {
    if (error.message && error.message.includes('Debits must equal credits')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.message && error.message.includes('At least two lines')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

exports.getTrialBalance = async (req, res, next) => {
  try {
    const fiscalYear = parseInt(req.query.year, 10) || new Date().getFullYear();
    const period = req.query.period ? parseInt(req.query.period, 10) : null;

    const where = { fiscalYear };
    if (period) {
      where.period = period;
    }

    const balances = await AccountBalance.findAll({
      where,
      include: [{ model: Account, as: 'account' }]
    });

    const summary = balances.reduce(
      (acc, item) => {
        acc.debit += parseFloat(item.debit || 0);
        acc.credit += parseFloat(item.credit || 0);
        return acc;
      },
      { debit: 0, credit: 0 }
    );

    res.status(200).json({
      success: true,
      data: balances,
      summary
    });
  } catch (error) {
    next(error);
  }
};

exports.getAccountSummary = async (req, res, next) => {
  try {
    const totals = await Account.findAll({
      attributes: ['type', [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']],
      group: ['type']
    });

    res.status(200).json({ success: true, data: totals });
  } catch (error) {
    next(error);
  }
};

