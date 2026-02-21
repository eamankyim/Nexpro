const accountingService = require('./accountingService');
const { getAccountByCode } = accountingService;
const { getAccountCodes } = require('../config/accountingAccountCodes');
const { JournalEntry } = require('../models');

const resolvePaymentAccountCode = (codes, paymentMethod) => {
  if (!paymentMethod) return codes.cash;
  const normalized = String(paymentMethod).toLowerCase();
  switch (normalized) {
    case 'cash':
    case 'mobile_money':
    case 'momo':
      return codes.cash;
    case 'bank_transfer':
    case 'wire':
    case 'credit_card':
    case 'check':
    case 'cheque':
      return codes.undeposited;
    default:
      return codes.cash;
  }
};

/**
 * Create a posted journal entry when an expense is approved: Dr Expense Cr Cash/Bank.
 * Idempotent: skips if journal already exists for this expense.
 * @param {Object} expense - Expense instance with id, tenantId, amount, expenseNumber, category, expenseDate, paymentMethod
 * @param {string} [userId] - User who approved (optional)
 * @returns {Promise<Object|null>} Created journal entry or null if skipped/failed
 */
const createExpenseJournal = async (expense, userId = null) => {
  if (!expense || !expense.id) return null;
  const tenantId = expense.tenantId;
  const amount = parseFloat(expense.amount || 0);
  if (!amount || Number.isNaN(amount) || amount <= 0) return null;

  const existing = await JournalEntry.findOne({
    where: { tenantId, source: 'expense_approval', sourceId: expense.id }
  });
  if (existing) return null;

  const codes = await getAccountCodes(tenantId);
  const paymentAccountCode = resolvePaymentAccountCode(codes, expense.paymentMethod);
  const expenseAccount = await getAccountByCode(tenantId, codes.expense);
  const paymentAccount = await getAccountByCode(tenantId, paymentAccountCode);
  if (!expenseAccount || !paymentAccount) return null;

  const entryDate = expense.expenseDate ? new Date(expense.expenseDate) : new Date();
  const description = `Expense ${expense.expenseNumber || expense.id} - ${expense.category || 'Expense'}`;

  return accountingService.createJournalEntry({
    tenantId,
    reference: expense.expenseNumber || expense.id,
    description,
    entryDate,
    status: 'posted',
    source: 'expense_approval',
    sourceId: expense.id,
    metadata: {
      expenseId: expense.id,
      vendorId: expense.vendorId || null,
      jobId: expense.jobId || null,
      category: expense.category || null
    },
    userId,
    lines: [
      {
        accountId: expenseAccount.id,
        debit: amount,
        credit: 0,
        description
      },
      {
        accountId: paymentAccount.id,
        debit: 0,
        credit: amount,
        description: `Payment - ${expense.expenseNumber || expense.id}`
      }
    ]
  });
};

module.exports = {
  createExpenseJournal
};
