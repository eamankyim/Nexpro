const accountingService = require('./accountingService');
const { getAccountByCode } = accountingService;

const DEFAULT_ACCOUNT_CODES = {
  cash: process.env.ACCOUNTING_CASH_ACCOUNT_CODE || '1000',
  undeposited: process.env.ACCOUNTING_UNDEPOSITED_ACCOUNT_CODE || '1200',
  accountsReceivable: process.env.ACCOUNTING_AR_ACCOUNT_CODE || '1100'
};

const resolveDepositAccountCode = (paymentMethod) => {
  if (!paymentMethod) {
    return DEFAULT_ACCOUNT_CODES.cash;
  }

  const normalized = paymentMethod.toLowerCase();

  switch (normalized) {
    case 'cash':
    case 'mobile_money':
    case 'momo':
      return DEFAULT_ACCOUNT_CODES.cash;
    case 'bank_transfer':
    case 'wire':
    case 'card':
    case 'cheque':
    case 'check':
      return DEFAULT_ACCOUNT_CODES.undeposited;
    default:
      return DEFAULT_ACCOUNT_CODES.cash;
  }
};

const createInvoicePaymentJournal = async ({
  invoice,
  amount,
  paymentDate = new Date(),
  paymentMethod = 'cash',
  referenceNumber = null,
  paymentRecordNumber = null,
  metadata = {},
  userId = null
}) => {
  if (!invoice || !invoice.id) {
    throw new Error('Invoice is required to create payment journal entry');
  }

  const paymentAmount = parseFloat(amount || 0);
  if (!paymentAmount || Number.isNaN(paymentAmount) || paymentAmount <= 0) {
    return null;
  }

  const accountsReceivableAccount = await getAccountByCode(DEFAULT_ACCOUNT_CODES.accountsReceivable);
  const depositAccount = await getAccountByCode(resolveDepositAccountCode(paymentMethod));

  if (!accountsReceivableAccount || !depositAccount) {
    const missing = [];
    if (!accountsReceivableAccount) missing.push(`Accounts Receivable (${DEFAULT_ACCOUNT_CODES.accountsReceivable})`);
    if (!depositAccount) missing.push(`Deposit (${resolveDepositAccountCode(paymentMethod)})`);
    throw new Error(`Missing required account(s): ${missing.join(', ')}`);
  }

  const description = `Payment received for invoice ${invoice.invoiceNumber || invoice.id}`;

  return accountingService.createJournalEntry({
    reference: invoice.invoiceNumber || invoice.id,
    description,
    entryDate: paymentDate,
    status: 'posted',
    source: 'invoice_payment',
    sourceId: invoice.id,
    metadata: {
      ...metadata,
      invoiceId: invoice.id,
      customerId: invoice.customerId || null,
      jobId: invoice.jobId || null,
      paymentMethod,
      referenceNumber,
      paymentRecordNumber
    },
    userId,
    lines: [
      {
        accountId: depositAccount.id,
        debit: paymentAmount,
        credit: 0,
        description
      },
      {
        accountId: accountsReceivableAccount.id,
        debit: 0,
        credit: paymentAmount,
        description: `Invoice ${invoice.invoiceNumber || invoice.id} settlement`
      }
    ]
  });
};

module.exports = {
  createInvoicePaymentJournal
};



