jest.mock('../../../models', () => ({
  AccountBalance: {
    count: jest.fn(),
    findAll: jest.fn()
  },
  Account: {}
}));

jest.mock('../../../utils/tenantUtils', () => ({
  applyTenantFilter: jest.fn((_tenantId, where) => where)
}));

jest.mock('../../../config/accountingAccountCodes', () => ({
  getAccountCodes: jest.fn()
}));

const { AccountBalance } = require('../../../models');
const accountingReportService = require('../../../services/accountingReportService');

describe('accountingReportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('separates COGS, operating expenses, gross profit, and net profit', async () => {
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
});
