const { Op } = require('sequelize');
const dayjs = require('dayjs');
const {
  RecurringJournal,
  RecurringJournalRun,
  Account,
  JournalEntry,
  User
} = require('../models');
const { applyTenantFilter } = require('../utils/tenantUtils');
const accountingService = require('./accountingService');

const VALID_FREQUENCIES = ['weekly', 'monthly', 'quarterly', 'yearly'];

const toDateOnly = (value) => dayjs(value).format('YYYY-MM-DD');

const computeNextRunDate = (currentDate, frequency, interval = 1) => {
  const base = dayjs(currentDate);
  const step = Math.max(parseInt(interval, 10) || 1, 1);
  if (frequency === 'weekly') return base.add(step, 'week').format('YYYY-MM-DD');
  if (frequency === 'quarterly') return base.add(step * 3, 'month').format('YYYY-MM-DD');
  if (frequency === 'yearly') return base.add(step, 'year').format('YYYY-MM-DD');
  return base.add(step, 'month').format('YYYY-MM-DD');
};

const validateAccounts = async (tenantId, debitAccountId, creditAccountId) => {
  if (!debitAccountId || !creditAccountId) {
    throw new Error('Both debitAccountId and creditAccountId are required');
  }
  if (debitAccountId === creditAccountId) {
    throw new Error('Debit and credit accounts must be different');
  }
  const accounts = await Account.findAll({
    where: applyTenantFilter(tenantId, { id: [debitAccountId, creditAccountId] }),
    attributes: ['id']
  });
  if (accounts.length !== 2) {
    throw new Error('One or more selected accounts are invalid for this tenant');
  }
};

const createRecurringJournal = async ({
  tenantId,
  userId,
  name,
  description,
  templateType = 'recurring_journal',
  frequency = 'monthly',
  interval = 1,
  amount,
  debitAccountId,
  creditAccountId,
  startDate,
  endDate = null,
  autoPost = true,
  metadata = {}
}) => {
  if (!tenantId) throw new Error('Tenant context is required');
  if (!name) throw new Error('Name is required');
  if (!VALID_FREQUENCIES.includes(frequency)) throw new Error('Invalid frequency');
  const numericAmount = Number(amount || 0);
  if (!(numericAmount > 0)) throw new Error('Amount must be greater than zero');
  if (!startDate) throw new Error('startDate is required');
  if (endDate && dayjs(endDate).isBefore(dayjs(startDate), 'day')) {
    throw new Error('endDate cannot be before startDate');
  }

  await validateAccounts(tenantId, debitAccountId, creditAccountId);

  return RecurringJournal.create({
    tenantId,
    name,
    description: description || null,
    templateType,
    frequency,
    interval: Math.max(parseInt(interval, 10) || 1, 1),
    amount: numericAmount,
    debitAccountId,
    creditAccountId,
    startDate: toDateOnly(startDate),
    endDate: endDate ? toDateOnly(endDate) : null,
    nextRunDate: toDateOnly(startDate),
    autoPost: !!autoPost,
    metadata: metadata || {},
    createdBy: userId || null
  });
};

const listRecurringJournals = async (tenantId) =>
  RecurringJournal.findAll({
    where: applyTenantFilter(tenantId, {}),
    order: [['nextRunDate', 'ASC'], ['createdAt', 'DESC']],
    include: [
      { model: Account, as: 'debitAccount', attributes: ['id', 'code', 'name', 'type'], required: false },
      { model: Account, as: 'creditAccount', attributes: ['id', 'code', 'name', 'type'], required: false },
      { model: User, as: 'creator', attributes: ['id', 'name'], required: false }
    ]
  });

const updateRecurringJournal = async (tenantId, id, payload = {}) => {
  const schedule = await RecurringJournal.findOne({ where: applyTenantFilter(tenantId, { id }) });
  if (!schedule) throw new Error('Recurring journal not found');

  const next = { ...payload };
  if (next.frequency && !VALID_FREQUENCIES.includes(next.frequency)) {
    throw new Error('Invalid frequency');
  }
  if (next.amount !== undefined && !(Number(next.amount) > 0)) {
    throw new Error('Amount must be greater than zero');
  }
  if (next.debitAccountId || next.creditAccountId) {
    await validateAccounts(
      tenantId,
      next.debitAccountId || schedule.debitAccountId,
      next.creditAccountId || schedule.creditAccountId
    );
  }
  if (next.endDate && dayjs(next.endDate).isBefore(dayjs(next.startDate || schedule.startDate), 'day')) {
    throw new Error('endDate cannot be before startDate');
  }

  await schedule.update(next);
  return schedule;
};

const deleteRecurringJournal = async (tenantId, id) => {
  const schedule = await RecurringJournal.findOne({ where: applyTenantFilter(tenantId, { id }) });
  if (!schedule) throw new Error('Recurring journal not found');
  await schedule.destroy();
};

const createRunLog = async (tenantId, recurringJournalId, runDate, data = {}) =>
  RecurringJournalRun.create({
    tenantId,
    recurringJournalId,
    runDate,
    status: data.status || 'success',
    journalEntryId: data.journalEntryId || null,
    errorMessage: data.errorMessage || null,
    metadata: data.metadata || {}
  });

const runSchedule = async (tenantId, schedule, runDate, userId = null) => {
  const existingRun = await RecurringJournalRun.findOne({
    where: applyTenantFilter(tenantId, { recurringJournalId: schedule.id, runDate })
  });
  if (existingRun) {
    return { skipped: true, reason: 'already_run', scheduleId: schedule.id };
  }

  try {
    const journal = await accountingService.createJournalEntry({
      tenantId,
      reference: schedule.templateType === 'prepaid_expense' ? 'PREPAID-AUTO' : 'RECURRING-AUTO',
      description: schedule.description || schedule.name,
      entryDate: runDate,
      status: schedule.autoPost ? 'posted' : 'draft',
      source: 'recurring_journal',
      sourceId: schedule.id,
      metadata: {
        recurringJournalId: schedule.id,
        templateType: schedule.templateType,
        scheduleName: schedule.name
      },
      userId,
      lines: [
        {
          accountId: schedule.debitAccountId,
          debit: Number(schedule.amount),
          credit: 0,
          description: schedule.name
        },
        {
          accountId: schedule.creditAccountId,
          debit: 0,
          credit: Number(schedule.amount),
          description: schedule.name
        }
      ]
    });

    const nextRunDate = computeNextRunDate(runDate, schedule.frequency, schedule.interval);
    const isCompleted = schedule.endDate && dayjs(nextRunDate).isAfter(dayjs(schedule.endDate), 'day');

    await schedule.update({
      lastRunDate: runDate,
      nextRunDate,
      status: isCompleted ? 'completed' : schedule.status
    });

    await createRunLog(tenantId, schedule.id, runDate, {
      status: 'success',
      journalEntryId: journal.id
    });

    return { success: true, scheduleId: schedule.id, journalEntryId: journal.id };
  } catch (error) {
    await createRunLog(tenantId, schedule.id, runDate, {
      status: 'failed',
      errorMessage: error.message
    });
    return { success: false, scheduleId: schedule.id, error: error.message };
  }
};

const runDueSchedules = async ({ tenantId = null, userId = null, runDate = null } = {}) => {
  const targetDate = toDateOnly(runDate || new Date());
  const where = tenantId
    ? applyTenantFilter(tenantId, {
        status: 'active',
        nextRunDate: { [Op.lte]: targetDate },
        [Op.or]: [{ endDate: null }, { endDate: { [Op.gte]: targetDate } }]
      })
    : {
        status: 'active',
        nextRunDate: { [Op.lte]: targetDate },
        [Op.or]: [{ endDate: null }, { endDate: { [Op.gte]: targetDate } }]
      };

  const dueSchedules = await RecurringJournal.findAll({ where });
  const results = [];
  for (const schedule of dueSchedules) {
    // Catch up all missed periods until target date.
    let currentRunDate = toDateOnly(schedule.nextRunDate);
    while (!dayjs(currentRunDate).isAfter(dayjs(targetDate), 'day')) {
      const result = await runSchedule(schedule.tenantId, schedule, currentRunDate, userId);
      results.push(result);
      if (!result.success && !result.skipped) break;
      currentRunDate = schedule.nextRunDate;
      if (schedule.status === 'completed') break;
    }
  }
  return {
    runDate: targetDate,
    processed: dueSchedules.length,
    results
  };
};

const runSingleScheduleNow = async (tenantId, scheduleId, userId = null) => {
  const schedule = await RecurringJournal.findOne({ where: applyTenantFilter(tenantId, { id: scheduleId }) });
  if (!schedule) throw new Error('Recurring journal not found');
  if (schedule.status !== 'active') throw new Error('Only active recurring journals can run');
  const runDate = toDateOnly(new Date());
  return runSchedule(tenantId, schedule, runDate, userId);
};

const getRecurringRuns = async (tenantId, recurringJournalId = null) => {
  const where = recurringJournalId
    ? applyTenantFilter(tenantId, { recurringJournalId })
    : applyTenantFilter(tenantId, {});
  return RecurringJournalRun.findAll({
    where,
    include: [{ model: JournalEntry, as: 'journalEntry', required: false }],
    order: [['runDate', 'DESC'], ['createdAt', 'DESC']],
    limit: 200
  });
};

module.exports = {
  createRecurringJournal,
  listRecurringJournals,
  updateRecurringJournal,
  deleteRecurringJournal,
  runDueSchedules,
  runSingleScheduleNow,
  getRecurringRuns
};
