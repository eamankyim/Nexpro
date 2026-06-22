jest.mock('../../../models', () => ({
  Dealer: {
    findOne: jest.fn(),
    findAll: jest.fn(),
  },
  DealerLedgerEntry: {
    findAll: jest.fn(),
  },
  Shop: {},
  User: {},
}));

const { Dealer, DealerLedgerEntry } = require('../../../models');
const {
  getDealerStatement,
  getOutstandingDealersReport,
  netBalanceFromEntries,
  summarizePeriodActivity,
} = require('../../../services/dealerStatementService');

describe('dealerStatementService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('netBalanceFromEntries', () => {
    it('nets debits and credits', () => {
      expect(netBalanceFromEntries([
        { direction: 'debit', amount: 100 },
        { direction: 'credit', amount: 25 },
      ])).toBe(75);
    });
  });

  describe('summarizePeriodActivity', () => {
    it('treats opening balance entries as opening balance, not charges', () => {
      const summary = summarizePeriodActivity([
        { entryType: 'opening_balance', direction: 'debit', amount: 40000 },
      ]);

      expect(summary).toEqual({
        periodOpeningBalance: 40000,
        totalCharges: 0,
        totalPayments: 0,
      });
    });

    it('separates sale charges and payments from opening balance', () => {
      const summary = summarizePeriodActivity([
        { entryType: 'opening_balance', direction: 'debit', amount: 40000 },
        { entryType: 'sale_charge', direction: 'debit', amount: 5000 },
        { entryType: 'payment', direction: 'credit', amount: 2000 },
      ]);

      expect(summary).toEqual({
        periodOpeningBalance: 40000,
        totalCharges: 5000,
        totalPayments: 2000,
      });
    });
  });

  describe('getDealerStatement', () => {
    it('reports opening balance only dealer with correct summary totals', async () => {
      Dealer.findOne.mockResolvedValue({
        id: 'dealer-1',
        businessName: 'Danito Enterprisee',
        contactName: 'Danito',
        phone: '0200000000',
        email: 'danito@example.com',
        creditTerms: 'Net 30',
        creditLimit: 80000,
        balance: 40000,
      });

      DealerLedgerEntry.findAll
        .mockResolvedValueOnce([]) // prior entries before period start
        .mockResolvedValueOnce([
          {
            id: 'entry-1',
            entryType: 'opening_balance',
            direction: 'debit',
            amount: 40000,
            description: 'Opening balance',
            entryDate: new Date('2026-06-21T00:00:00.000Z'),
            saleId: null,
            paymentId: null,
            shop: null,
            createdByUser: null,
          },
        ]);

      const statement = await getDealerStatement({
        dealerId: 'dealer-1',
        tenantId: 'tenant-1',
        startDate: '2026-06-01',
        endDate: '2026-06-22',
      });

      expect(statement.openingBalance).toBe(40000);
      expect(statement.closingBalance).toBe(40000);
      expect(statement.totals.debits).toBe(0);
      expect(statement.totals.credits).toBe(0);
      expect(statement.totals.charges).toBe(0);
      expect(statement.totals.payments).toBe(0);
      expect(statement.entries).toHaveLength(1);
      expect(statement.entries[0].entryType).toBe('opening_balance');
      expect(statement.entries[0].balanceAfter).toBe(40000);
    });

    it('uses prior balance as opening when opening balance predates the period', async () => {
      Dealer.findOne.mockResolvedValue({
        id: 'dealer-1',
        businessName: 'Prior Balance Dealer',
        creditLimit: 0,
        balance: 40000,
      });

      DealerLedgerEntry.findAll
        .mockResolvedValueOnce([
          { direction: 'debit', amount: 40000 },
        ])
        .mockResolvedValueOnce([]);

      const statement = await getDealerStatement({
        dealerId: 'dealer-1',
        tenantId: 'tenant-1',
        startDate: '2026-06-01',
        endDate: '2026-06-22',
      });

      expect(statement.openingBalance).toBe(40000);
      expect(statement.closingBalance).toBe(40000);
      expect(statement.totals.debits).toBe(0);
      expect(statement.totals.credits).toBe(0);
      expect(statement.entries).toHaveLength(0);
    });
  });

  describe('getOutstandingDealersReport', () => {
    it('filters dealers by shopId when provided', async () => {
      Dealer.findAll.mockResolvedValue([
        {
          id: 'dealer-1',
          businessName: 'Branch A Dealer',
          contactName: null,
          phone: null,
          balance: 500,
          creditLimit: 1000,
          creditTerms: null,
        },
      ]);

      const report = await getOutstandingDealersReport('tenant-1', 'shop-a');

      expect(Dealer.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-1', isActive: true, shopId: 'shop-a' }),
      }));
      expect(report.dealerCount).toBe(1);
      expect(report.totalOutstanding).toBe(500);
    });
  });
});
