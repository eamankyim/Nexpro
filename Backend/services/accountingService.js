const { Op } = require('sequelize');
const {
  JournalEntry,
  JournalEntryLine,
  Account,
  AccountBalance,
  User
} = require('../models');

const sumLines = (lines = []) =>
  lines.reduce(
    (acc, line) => {
      acc.debit += parseFloat(line.debit || 0);
      acc.credit += parseFloat(line.credit || 0);
      return acc;
    },
    { debit: 0, credit: 0 }
  );

const updateAccountBalances = async (journalEntryId, transaction) => {
  const lines = await JournalEntryLine.findAll({
    where: { journalEntryId },
    include: [{ model: JournalEntry, as: 'journalEntry', attributes: ['entryDate'] }],
    transaction
  });

  for (const line of lines) {
    const entryDate = line.journalEntry.entryDate ? new Date(line.journalEntry.entryDate) : new Date();
    const fiscalYear = entryDate.getFullYear();
    const period = entryDate.getMonth() + 1;

    const [balance] = await AccountBalance.findOrCreate({
      where: {
        accountId: line.accountId,
        fiscalYear,
        period
      },
      defaults: {
        accountId: line.accountId,
        fiscalYear,
        period,
        debit: 0,
        credit: 0,
        balance: 0
      },
      transaction
    });

    balance.debit = parseFloat(balance.debit) + parseFloat(line.debit || 0);
    balance.credit = parseFloat(balance.credit) + parseFloat(line.credit || 0);
    balance.balance = parseFloat(balance.debit) - parseFloat(balance.credit);

    await balance.save({ transaction });
  }
};

const createJournalEntry = async ({
  reference,
  description,
  entryDate,
  status = 'draft',
  lines = [],
  source = null,
  sourceId = null,
  metadata = {},
  userId = null,
  approvedBy = null
}) => {
  const transaction = await JournalEntry.sequelize.transaction();

  try {
    if (!Array.isArray(lines) || lines.length < 2) {
      throw new Error('At least two lines are required');
    }

    const totals = sumLines(lines);
    if (parseFloat(totals.debit.toFixed(2)) !== parseFloat(totals.credit.toFixed(2))) {
      throw new Error('Debits must equal credits');
    }

    const journal = await JournalEntry.create(
      {
        reference,
        description,
        entryDate: entryDate || new Date(),
        status,
        source,
        sourceId,
        metadata: metadata || {},
        createdBy: userId,
        approvedBy: approvedBy || null
      },
      { transaction }
    );

    const linesPayload = lines.map((line) => ({
      journalEntryId: journal.id,
      accountId: line.accountId,
      description: line.description || null,
      debit: parseFloat(line.debit || 0),
      credit: parseFloat(line.credit || 0),
      metadata: line.metadata || {}
    }));

    await JournalEntryLine.bulkCreate(linesPayload, { transaction });

    if (status === 'posted') {
      await updateAccountBalances(journal.id, transaction);
    }

    await transaction.commit();

    return JournalEntry.findByPk(journal.id, {
      include: [
        {
          model: JournalEntryLine,
          as: 'lines',
          include: [{ model: Account, as: 'account', attributes: ['id', 'code', 'name', 'type'] }]
        },
        { model: User, as: 'creator', attributes: ['id', 'name'] },
        { model: User, as: 'approver', attributes: ['id', 'name'] }
      ]
    });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const getAccountByCode = async (code) => {
  if (!code) {
    return null;
  }
  return Account.findOne({ where: { code } });
};

module.exports = {
  createJournalEntry,
  getAccountByCode,
  sumLines,
  updateAccountBalances
};


