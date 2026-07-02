jest.mock('../../../models', () => ({
  AccountBalance: {
    count: jest.fn(),
    findAll: jest.fn()
  },
  Account: {
    findAll: jest.fn()
  },
  JournalEntry: {},
  JournalEntryLine: {
    findAll: jest.fn()
  }
}));

jest.mock('../../../utils/tenantUtils', () => ({
  applyTenantFilter: jest.fn((_tenantId, where) => where)
}));

jest.mock('../../../config/accountingAccountCodes', () => ({
  getAccountCodes: jest.fn()
}));

const { Account, JournalEntryLine } = require('../../../models');
const { getAccountCodes } = require('../../../config/accountingAccountCodes');
const accountingReportService = require('../../../services/accountingReportService');

describe('accountingReportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getAccountCodes.mockResolvedValue({
      cash: '1000',
      undeposited: '1200'
    });
  });

  it('separates COGS, operating expenses, gross profit, and net profit', async () => {
    const { AccountBalance } = require('../../../models');
    AccountBalance.findAll.mockResolvedValue([
      { debit: 0, credit: 1000, account: { type: 'revenue', category: 'Sales' } },
      { debit: 400, credit: 0, account: { type: 'cogs', category: 'Inventory COGS' } },
      { debit: 150, credit: 0, account: { type: 'expense', category: 'Rent' } }
    ]);

    const result = await accountingReportService.getProfitLossFromAccounting(
      'tenant-1',
      '2026-01-01',
      '2026-01-31'
    );

    expect(result).toMatchObject({
      revenue: 1000,
      cogs: 400,
      operatingExpenses: 150,
      expenses: 550,
      grossProfit: 600,
      netProfit: 450,
      grossProfitMargin: 60,
      netProfitMargin: 45,
      profitMargin: 45
    });
  });

  it('derives cash flow from cash account journal debits and credits', async () => {
    Account.findAll.mockResolvedValue([{ id: 'cash-account-id' }]);
    JournalEntryLine.findAll.mockResolvedValue([
      { debit: 8458, credit: 0 },
      { debit: 0, credit: 3999 }
    ]);

    const result = await accountingReportService.getCashFlowFromAccounting(
      'tenant-1',
      '2026-06-01',
      '2026-06-30'
    );

    expect(result).toMatchObject({
      operating: {
        cashReceivedFromCustomers: 8458,
        cashPaidToSuppliersAndExpenses: 3999,
        netCashFromOperatingActivities: 4459
      },
      netChangeInCash: 4459
    });
  });
});
