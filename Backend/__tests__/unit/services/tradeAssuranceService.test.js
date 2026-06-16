jest.mock('../../../models', () => ({
  Customer: {},
  MarketplaceDispute: {},
  MarketplaceLedgerEntry: { findAll: jest.fn() },
  MarketplaceOrderPayment: { findAll: jest.fn(), sum: jest.fn(), findOne: jest.fn() },
  MarketplacePayout: { sum: jest.fn(), count: jest.fn(), findOne: jest.fn() },
  Sale: { findAll: jest.fn() },
  SaleActivity: {},
  Shop: {},
}));

const {
  MarketplaceDispute,
  MarketplaceLedgerEntry,
  MarketplaceOrderPayment,
  MarketplacePayout,
  Sale,
} = require('../../../models');
const {
  calculateMarketplaceFee,
  getReleaseEligibleAt,
  getTradeAssuranceSummary,
} = require('../../../services/tradeAssuranceService');

describe('tradeAssuranceService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    MarketplaceDispute.count = jest.fn().mockResolvedValue(0);
    MarketplaceLedgerEntry.findAll.mockResolvedValue([]);
    MarketplaceOrderPayment.findAll.mockResolvedValue([]);
    MarketplaceOrderPayment.sum.mockResolvedValue(0);
    MarketplaceOrderPayment.findOne.mockResolvedValue(null);
    MarketplacePayout.sum.mockResolvedValue(0);
    MarketplacePayout.count.mockResolvedValue(0);
    MarketplacePayout.findOne.mockResolvedValue(null);
    Sale.findAll.mockResolvedValue([]);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('calculates Sabito commission and seller net amount', () => {
    const result = calculateMarketplaceFee(200, { percent: 5, fixedAmount: 1 });

    expect(result).toEqual({
      grossAmount: 200,
      feeAmount: 11,
      netAmount: 189,
      commissionPercent: 5,
      fixedFeeAmount: 1,
    });
  });

  it('caps marketplace fee at the gross payment amount', () => {
    const result = calculateMarketplaceFee(5, { percent: 50, fixedAmount: 10 });

    expect(result.feeAmount).toBe(5);
    expect(result.netAmount).toBe(0);
  });

  it('builds release eligibility from the configured confirmation window', () => {
    process.env.SABITO_TRADE_ASSURANCE_AUTO_RELEASE_HOURS = '24';
    const baseDate = new Date('2026-01-01T00:00:00.000Z');

    expect(getReleaseEligibleAt(baseDate).toISOString()).toBe('2026-01-02T00:00:00.000Z');
  });

  it('summarizes held seller payout and Sabito fee from marketplace payments', async () => {
    MarketplaceOrderPayment.findAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ status: 'paid_held', count: 1 }])
      .mockResolvedValueOnce([{ saleId: 'sale-1' }]);
    MarketplaceOrderPayment.sum
      .mockResolvedValueOnce(9129.5)
      .mockResolvedValueOnce(480.5);
    MarketplaceOrderPayment.findOne.mockResolvedValue({ currency: 'GHS' });

    const summary = await getTradeAssuranceSummary({ tenantId: 'tenant-1' });

    expect(summary.balances.pending).toBe(9129.5);
    expect(summary.balances.fee).toBe(480.5);
    expect(summary.counts.held).toBe(1);
  });

  it('uses available payout currency when no marketplace payments exist', async () => {
    MarketplaceOrderPayment.findAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    MarketplaceOrderPayment.findOne.mockResolvedValue(null);
    MarketplacePayout.sum.mockResolvedValue(100);
    MarketplacePayout.count.mockResolvedValue(1);
    MarketplacePayout.findOne.mockResolvedValue({ currency: 'USD' });

    const summary = await getTradeAssuranceSummary({ tenantId: 'tenant-1' });

    expect(summary.balances.available).toBe(100);
    expect(summary.balances.currency).toBe('USD');
    expect(summary.counts.payoutHistory).toBe(1);
  });

  it('includes metadata-only paid-held orders shown in the orders table', async () => {
    MarketplaceOrderPayment.findAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    Sale.findAll.mockResolvedValueOnce([{
      id: 'sale-1',
      total: 9610,
      metadata: {
        source: 'online_store',
        tradeAssurance: {
          paymentStatus: 'paid_held',
          netAmount: 9129.5,
          feeAmount: 480.5,
        },
      },
    }]);

    const summary = await getTradeAssuranceSummary({
      tenantId: 'tenant-1',
      shopId: 'shop-1',
      includeLegacyShopNull: true,
    });

    expect(Sale.findAll).toHaveBeenCalledWith(expect.objectContaining({
      attributes: ['id', 'total', 'metadata'],
    }));
    expect(summary.balances.pending).toBe(9129.5);
    expect(summary.balances.fee).toBe(480.5);
    expect(summary.counts.held).toBe(1);
  });
});
