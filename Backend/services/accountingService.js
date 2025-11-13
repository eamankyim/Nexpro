const { Op } = require('sequelize');
const {
  JournalEntry,
  JournalEntryLine,
  Account,
  AccountBalance,
  User
} = require('../models');
const { applyTenantFilter } = require('../utils/tenantUtils');

const sumLines = (lines = []) =>
  lines.reduce(
    (acc, line) => {
      acc.debit += parseFloat(line.debit || 0);
      acc.credit += parseFloat(line.credit || 0);
      return acc;
    },
    { debit: 0, credit: 0 }
  );

const updateAccountBalances = async (tenantId, journalEntryId, transaction) => {
  const lines = await JournalEntryLine.findAll({
    where: applyTenantFilter(tenantId, { journalEntryId }),
    include: [
      {
        model: JournalEntry,
        as: 'journalEntry',
        attributes: ['entryDate'],
        where: applyTenantFilter(tenantId, {})
      }
    ],
    transaction
  });

  for (const line of lines) {
    const entryDate = line.journalEntry.entryDate ? new Date(line.journalEntry.entryDate) : new Date();
    const fiscalYear = entryDate.getFullYear();
    const period = entryDate.getMonth() + 1;

    const [balance] = await AccountBalance.findOrCreate({
      where: {
        ...applyTenantFilter(tenantId, {
          accountId: line.accountId,
          fiscalYear,
          period
        })
      },
      defaults: {
        tenantId,
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
  tenantId,
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
  if (!tenantId) {
    throw new Error('Tenant context is required to create a journal entry');
  }

  const transaction = await JournalEntry.sequelize.transaction();

  try {
    if (!Array.isArray(lines) || lines.length < 2) {
      throw new Error('At least two lines are required');
    }

    const totals = sumLines(lines);
    if (parseFloat(totals.debit.toFixed(2)) !== parseFloat(totals.credit.toFixed(2))) {
      throw new Error('Debits must equal credits');
    }

    // Ensure every account belongs to current tenant
    const accountIds = [...new Set(lines.map((line) => line.accountId))];
    const accounts = await Account.findAll({
      where: applyTenantFilter(tenantId, { id: accountIds })
    });
    const validAccountIds = new Set(accounts.map((account) => account.id));

    for (const line of lines) {
      if (!validAccountIds.has(line.accountId)) {
        throw new Error('One or more accounts are invalid for this tenant');
      }
    }

    const journal = await JournalEntry.create(
      {
        tenantId,
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
      tenantId,
      accountId: line.accountId,
      description: line.description || null,
      debit: parseFloat(line.debit || 0),
      credit: parseFloat(line.credit || 0),
      metadata: line.metadata || {}
    }));

    await JournalEntryLine.bulkCreate(linesPayload, { transaction });

    if (status === 'posted') {
      await updateAccountBalances(tenantId, journal.id, transaction);
    }

    await transaction.commit();

    return JournalEntry.findOne({
      where: applyTenantFilter(tenantId, { id: journal.id }),
      include: [
        {
          model: JournalEntryLine,
          as: 'lines',
          where: applyTenantFilter(tenantId, {}),
          required: false,
          include: [
            {
              model: Account,
              as: 'account',
              attributes: ['id', 'code', 'name', 'type'],
              where: applyTenantFilter(tenantId, {}),
              required: false
            }
          ]
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

const getAccountByCode = async (tenantId, code) => {
  if (!code) {
    return null;
  }
  return Account.findOne({ where: applyTenantFilter(tenantId, { code }) });
};

module.exports = {
  createJournalEntry,
  getAccountByCode,
  sumLines,
  updateAccountBalances
};



