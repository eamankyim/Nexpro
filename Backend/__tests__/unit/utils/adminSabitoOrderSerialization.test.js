jest.mock('../../../models', () => ({
  Customer: {},
  MarketplaceDispute: { count: jest.fn() },
  MarketplaceLedgerEntry: { findAll: jest.fn() },
  MarketplaceOrderPayment: { findAll: jest.fn(), count: jest.fn() },
  MarketplacePayout: { findAll: jest.fn() },
  OnlineStoreSettings: {},
  Sale: { count: jest.fn(), findAndCountAll: jest.fn() },
  Shop: {},
  StorefrontCustomer: {},
  Tenant: {},
}));

jest.mock('../../../utils/paginationUtils', () => ({
  getPagination: jest.fn(() => ({ page: 1, limit: 20, offset: 0 })),
}));

jest.mock('../../../services/tradeAssuranceService', () => ({
  getAutoReleaseHours: jest.fn(() => 72),
}));

const { Sale } = require('../../../models');
const adminSabitoController = require('../../../controllers/adminSabitoController');

describe('adminSabitoController marketplace order serialization', () => {
  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  it('normalizes payment and fulfillment for held marketplace orders', async () => {
    Sale.findAndCountAll.mockResolvedValue({
      count: 1,
      rows: [{
        get: () => ({
          id: 'sale-1',
          saleNumber: 'SALE-20260611-0001',
          status: 'completed',
          orderStatus: 'preparing',
          deliveryStatus: null,
          subtotal: 20,
          deliveryFee: 5,
          total: 25,
          metadata: {
            source: 'online_store',
            tradeAssurance: { paymentStatus: 'paid_held' },
          },
          marketplacePayment: {
            id: 'payment-1',
            status: 'paid_held',
            currency: 'GHS',
            grossAmount: 25,
            feeAmount: 1.25,
            netAmount: 23.75,
            refundedAmount: 0,
            heldAt: '2026-06-11T13:34:25.186Z',
            releaseEligibleAt: null,
            releasedAt: null,
            storefrontCustomer: { id: 'shopper-1', name: 'Eric Amankyim' },
          },
        }),
      }],
    });

    const req = { query: {} };
    const res = mockRes();
    const next = jest.fn();

    await adminSabitoController.getSabitoOrders(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({
        status: 'completed',
        orderStatus: 'preparing',
        paymentStatus: 'paid_held',
        fulfillmentStatus: 'processing',
        tradeAssurance: expect.objectContaining({
          status: 'paid_held',
          paymentStatus: 'paid_held',
        }),
      })],
    }));
    expect(next).not.toHaveBeenCalled();
  });
});
