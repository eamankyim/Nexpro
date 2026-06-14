jest.mock('../../../config/database', () => ({
  sequelize: {
    where: jest.fn((left, right) => ({ type: 'where', left, right })),
    json: jest.fn((path) => ({ type: 'json', path })),
    literal: jest.fn((sql) => ({ type: 'literal', sql })),
    query: jest.fn(),
    QueryTypes: { SELECT: 'SELECT' },
    transaction: jest.fn(),
  },
  testConnection: jest.fn(),
}));

jest.mock('../../../models', () => ({
  OnlineStoreSettings: { findOne: jest.fn(), create: jest.fn(), count: jest.fn() },
  OnlineProductListing: { findOne: jest.fn(), findAndCountAll: jest.fn(), count: jest.fn(), create: jest.fn(), findAll: jest.fn() },
  Sale: { findAndCountAll: jest.fn(), findAll: jest.fn(), findOne: jest.fn(), count: jest.fn(), sum: jest.fn() },
  SaleItem: {},
  SaleActivity: { create: jest.fn() },
  MarketplaceOrderPayment: {},
  Customer: {},
  Lead: {},
  Job: { findAll: jest.fn(), findOne: jest.fn(), count: jest.fn(), sum: jest.fn() },
  Product: {},
  ProductVariant: {},
  Shop: {},
  Tenant: {},
  Setting: { findOne: jest.fn() },
}));

jest.mock('../../../middleware/upload', () => ({
  baseUploadDir: '/tmp/uploads',
  ensureDirExists: jest.fn(),
}));

jest.mock('../../../utils/tenantUtils', () => ({
  applyTenantFilter: jest.fn((tenantId, where = {}) => ({ ...where, tenantId })),
}));

jest.mock('../../../utils/paginationUtils', () => ({
  getPagination: jest.fn(() => ({ page: 1, limit: 20, offset: 0 })),
}));

jest.mock('../../../utils/shopUtils', () => ({
  applyShopReadFilter: jest.fn((_req, where) => where),
  attachShopToPayload: jest.fn((_req, payload) => payload),
  assertShopIdAccess: jest.fn(),
}));

jest.mock('../../../middleware/cache', () => ({
  invalidateSaleListCache: jest.fn(),
}));

jest.mock('../../../services/tradeAssuranceService', () => ({
  getTradeAssuranceSummary: jest.fn(),
  listPayoutHistory: jest.fn(),
  listTradeAssuranceDisputes: jest.fn(),
  listTradeAssurancePayments: jest.fn(),
  markDeliveryReleaseWindowForSale: jest.fn(),
  refundMarketplaceOrderPayment: jest.fn(),
  releaseMarketplaceOrderPayment: jest.fn(),
}));

const { sequelize } = require('../../../config/database');
const { Sale, SaleActivity, Job } = require('../../../models');
const { invalidateSaleListCache } = require('../../../middleware/cache');
const {
  getTradeAssuranceSummary,
  listPayoutHistory,
  listTradeAssuranceDisputes,
  listTradeAssurancePayments,
  markDeliveryReleaseWindowForSale,
} = require('../../../services/tradeAssuranceService');
const storeController = require('../../../controllers/storeController');

describe('storeController online orders', () => {
  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Sale.findAndCountAll.mockResolvedValue({ count: 1, rows: [{ id: 'sale-1', saleNumber: 'SALE-1' }] });
    Sale.findAll.mockResolvedValue([]);
    Sale.count.mockResolvedValue(0);
    Sale.sum.mockResolvedValue(0);
    Job.findAll.mockResolvedValue([]);
    Job.count.mockResolvedValue(0);
    Job.sum.mockResolvedValue(0);
    sequelize.query.mockResolvedValue([]);
    getTradeAssuranceSummary.mockResolvedValue({ balances: {}, counts: {} });
    listTradeAssurancePayments.mockResolvedValue({ count: 0, rows: [] });
    listTradeAssuranceDisputes.mockResolvedValue({ count: 0, rows: [] });
    listPayoutHistory.mockResolvedValue({ count: 0, rows: [] });
  });

  it('lists only online store sales with stats and pagination', async () => {
    Sale.count
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(2);
    Sale.sum
      .mockResolvedValueOnce(2400)
      .mockResolvedValueOnce(125.5);

    const req = {
      tenantId: 'tenant-1',
      query: { search: 'Ama', status: 'paid' },
    };
    const res = mockRes();
    const next = jest.fn();

    await storeController.getStoreOrders(req, res, next);

    expect(Sale.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
      distinct: true,
      limit: 20,
      offset: 0,
      order: [['createdAt', 'DESC']],
    }));
    expect(sequelize.literal).toHaveBeenCalledWith('"Sale"."metadata"->>\'source\'');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      count: 1,
      stats: expect.objectContaining({
        total: 4,
        pendingPayment: 1,
        paid: 2,
        pendingFulfillment: 3,
        totalRevenue: 2400,
        todayOrders: 2,
        todayRevenue: 125.5,
      }),
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('paginates mixed studio orders through a unified feed before hydrating details', async () => {
    sequelize.query.mockResolvedValue([
      { orderType: 'service', id: 'job-1', sortAt: '2026-06-14T10:00:00.000Z' },
      { orderType: 'product', id: 'sale-1', sortAt: '2026-06-13T10:00:00.000Z' },
    ]);
    Sale.count.mockResolvedValue(1);
    Job.count.mockResolvedValue(1);
    Sale.findAll.mockResolvedValue([{
      id: 'sale-1',
      get: () => ({
        id: 'sale-1',
        saleNumber: 'SALE-1',
        createdAt: '2026-06-13T10:00:00.000Z',
        status: 'completed',
        metadata: { source: 'online_store' },
      }),
    }]);
    Job.findAll.mockResolvedValue([{
      id: 'job-1',
      get: () => ({
        id: 'job-1',
        jobNumber: 'JOB-1',
        title: 'Logo design',
        createdAt: '2026-06-14T10:00:00.000Z',
        status: 'new',
        adminLead: {
          id: 'lead-1',
          name: 'Ama',
          email: 'ama@example.com',
          phone: '123',
          metadata: { requestType: 'paid_service_booking', paymentStatus: 'paid' },
        },
        metadata: { paymentStatus: 'paid', serviceTitle: 'Logo design' },
      }),
    }]);

    const req = {
      tenantId: 'tenant-1',
      tenant: { businessType: 'printing_press' },
      query: { page: '2', limit: '2', search: 'Ama' },
    };
    const res = mockRes();
    const next = jest.fn();

    await storeController.getStoreOrders(req, res, next);

    expect(sequelize.query).toHaveBeenCalledWith(expect.stringContaining('UNION ALL'), expect.objectContaining({
      replacements: expect.objectContaining({
        limit: 20,
        offset: 0,
        mixedSearch: '%Ama%',
      }),
      type: sequelize.QueryTypes.SELECT,
    }));
    expect(Sale.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: expect.any(Object) }),
    }));
    expect(Job.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: expect.any(Object) }),
    }));
    const payload = res.json.mock.calls[0][0];
    expect(payload.count).toBe(2);
    expect(payload.data).toEqual([
      expect.objectContaining({ orderType: 'service', id: 'job-1' }),
      expect.objectContaining({ id: 'sale-1' }),
    ]);
    expect(next).not.toHaveBeenCalled();
  });

  it('serializes preparing online orders as processing fulfillment with paid_held payment', async () => {
    Sale.findAndCountAll.mockResolvedValue({
      count: 1,
      rows: [{
        get: () => ({
          id: 'sale-1',
          saleNumber: 'SALE-20260611-0001',
          status: 'completed',
          orderStatus: 'preparing',
          deliveryStatus: null,
          metadata: {
            source: 'online_store',
            tradeAssurance: { paymentStatus: 'paid_held' },
          },
          marketplacePayment: { status: 'paid_held' },
        }),
      }],
    });

    const req = {
      tenantId: 'tenant-1',
      query: {},
    };
    const res = mockRes();
    const next = jest.fn();

    await storeController.getStoreOrders(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({
        fulfillmentStatus: 'processing',
        paymentStatus: 'paid_held',
        tradeAssurance: expect.objectContaining({
          fundsReleasedToBusiness: false,
          canSellerRefund: false,
        }),
      })],
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('marks released marketplace payouts as seller refundable', async () => {
    Sale.findAndCountAll.mockResolvedValue({
      count: 1,
      rows: [{
        get: () => ({
          id: 'sale-1',
          saleNumber: 'SALE-20260611-0002',
          total: 125,
          status: 'completed',
          orderStatus: 'completed',
          deliveryStatus: 'delivered',
          metadata: {
            source: 'online_store',
            tradeAssurance: {
              paymentStatus: 'released',
              payoutReleasedAt: '2026-06-12T10:00:00.000Z',
              payoutId: 'payout-1',
            },
          },
          marketplacePayment: {
            id: 'payment-1',
            status: 'released',
            grossAmount: 125,
            feeAmount: 5,
            netAmount: 120,
            refundedAmount: 0,
            releasedAt: '2026-06-12T10:00:00.000Z',
            metadata: { payoutId: 'payout-1' },
          },
        }),
      }],
    });

    const req = {
      tenantId: 'tenant-1',
      query: {},
    };
    const res = mockRes();
    const next = jest.fn();

    await storeController.getStoreOrders(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({
        paymentStatus: 'released',
        tradeAssurance: expect.objectContaining({
          paymentStatus: 'released',
          fundsReleasedToBusiness: true,
          canSellerRefund: true,
        }),
      })],
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('serializes received online orders as pending fulfillment', async () => {
    Sale.findAndCountAll.mockResolvedValue({
      count: 1,
      rows: [{
        get: () => ({
          id: 'sale-1',
          saleNumber: 'SALE-20260610-0003',
          status: 'completed',
          orderStatus: 'received',
          deliveryStatus: null,
          metadata: {
            source: 'online_store',
            tradeAssurance: { paymentStatus: 'paid_held' },
          },
        }),
      }],
    });

    const req = {
      tenantId: 'tenant-1',
      query: {},
    };
    const res = mockRes();
    const next = jest.fn();

    await storeController.getStoreOrders(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({
        fulfillmentStatus: 'pending',
        paymentStatus: 'paid_held',
        tradeAssurance: expect.objectContaining({ paymentStatus: 'paid_held' }),
      })],
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('updates fulfillment status without changing payment status', async () => {
    const transaction = {
      LOCK: { UPDATE: 'UPDATE' },
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      finished: false,
    };
    sequelize.transaction.mockResolvedValue(transaction);
    const order = {
      id: 'sale-1',
      status: 'pending',
      orderStatus: null,
      deliveryStatus: null,
      metadata: {},
      update: jest.fn().mockResolvedValue(undefined),
    };
    Sale.findOne
      .mockResolvedValueOnce(order)
      .mockResolvedValueOnce({ id: 'sale-1', deliveryStatus: 'out_for_delivery' });
    SaleActivity.create.mockResolvedValue({ id: 'activity-1' });

    const req = {
      tenantId: 'tenant-1',
      user: { id: 'user-1' },
      params: { id: 'sale-1' },
      query: {},
      body: { status: 'out_for_delivery' },
    };
    const res = mockRes();
    const next = jest.fn();

    await storeController.updateStoreOrderStatus(req, res, next);

    expect(Sale.findOne).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({ id: 'sale-1', tenantId: 'tenant-1' }),
      transaction,
      lock: 'UPDATE',
    }));
    expect(Sale.findOne.mock.calls[0][0].include).toBeUndefined();
    expect(order.update).toHaveBeenCalledWith(
      {
        orderStatus: 'ready',
        deliveryStatus: 'out_for_delivery',
        metadata: expect.objectContaining({
          deliveryTracking: expect.objectContaining({ status: 'out_for_delivery' }),
        }),
      },
      { transaction }
    );
    expect(SaleActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        saleId: 'sale-1',
        tenantId: 'tenant-1',
        metadata: expect.objectContaining({ action: 'out_for_delivery' }),
      }),
      { transaction }
    );
    expect(transaction.commit).toHaveBeenCalled();
    expect(invalidateSaleListCache).toHaveBeenCalledWith('tenant-1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects invalid fulfillment status transitions', async () => {
    const transaction = {
      LOCK: { UPDATE: 'UPDATE' },
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      finished: false,
    };
    sequelize.transaction.mockResolvedValue(transaction);
    const order = {
      id: 'sale-1',
      status: 'completed',
      orderStatus: 'completed',
      deliveryStatus: 'delivered',
      update: jest.fn(),
    };
    Sale.findOne.mockResolvedValueOnce(order);

    const req = {
      tenantId: 'tenant-1',
      user: { id: 'user-1' },
      params: { id: 'sale-1' },
      query: {},
      body: { status: 'processing' },
    };
    const res = mockRes();
    const next = jest.fn();

    await storeController.updateStoreOrderStatus(req, res, next);

    expect(order.update).not.toHaveBeenCalled();
    expect(transaction.rollback).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: expect.stringContaining('Status transition not allowed'),
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects status changes after customer confirms delivered online order', async () => {
    const transaction = {
      LOCK: { UPDATE: 'UPDATE' },
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      finished: false,
    };
    sequelize.transaction.mockResolvedValue(transaction);
    const order = {
      id: 'sale-1',
      status: 'completed',
      orderStatus: 'completed',
      deliveryStatus: 'delivered',
      metadata: { confirmedReceivedAt: '2026-06-10T13:30:00.000Z' },
      update: jest.fn(),
    };
    Sale.findOne.mockResolvedValueOnce(order);

    const req = {
      tenantId: 'tenant-1',
      user: { id: 'user-1' },
      params: { id: 'sale-1' },
      query: {},
      body: { status: 'cancelled', reason: 'Customer asked to cancel' },
    };
    const res = mockRes();
    const next = jest.fn();

    await storeController.updateStoreOrderStatus(req, res, next);

    expect(order.update).not.toHaveBeenCalled();
    expect(transaction.rollback).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      errorCode: 'ORDER_DELIVERY_CONFIRMED_LOCKED',
      message: expect.stringContaining('confirmed by the customer'),
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('starts the trade assurance release window when marking delivered', async () => {
    const transaction = {
      LOCK: { UPDATE: 'UPDATE' },
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      finished: false,
    };
    sequelize.transaction.mockResolvedValue(transaction);
    const deliveredAt = new Date('2026-06-10T13:00:00.000Z');
    const order = {
      id: 'sale-1',
      status: 'completed',
      orderStatus: 'ready',
      deliveryStatus: 'out_for_delivery',
      deliveredAt,
      metadata: {},
      update: jest.fn().mockResolvedValue(undefined),
    };
    Sale.findOne
      .mockResolvedValueOnce(order)
      .mockResolvedValueOnce({ id: 'sale-1', deliveryStatus: 'delivered' });
    SaleActivity.create.mockResolvedValue({ id: 'activity-1' });
    markDeliveryReleaseWindowForSale.mockResolvedValue({ id: 'payment-1' });

    const req = {
      tenantId: 'tenant-1',
      user: { id: 'user-1' },
      params: { id: 'sale-1' },
      query: {},
      body: { status: 'delivered' },
    };
    const res = mockRes();
    const next = jest.fn();

    await storeController.updateStoreOrderStatus(req, res, next);

    expect(order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        orderStatus: 'completed',
        deliveryStatus: 'delivered',
        deliveredAt: expect.any(Date),
      }),
      { transaction }
    );
    expect(markDeliveryReleaseWindowForSale).toHaveBeenCalledWith({
      sale: order,
      deliveredAt,
      transaction,
    });
    expect(transaction.commit).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it('ignores stale dashboard shopId for non-shop tenants when listing online orders', async () => {
    Sale.count.mockResolvedValue(1);
    Sale.findAndCountAll.mockResolvedValue({
      count: 1,
      rows: [{ id: 'sale-1', saleNumber: 'SALE-20260610-0001', get: () => ({ id: 'sale-1' }) }],
    });

    const req = {
      tenantId: 'tenant-1',
      shopScoped: false,
      query: { shopId: 'stale-shop-id' },
    };
    const res = mockRes();
    const next = jest.fn();

    await storeController.getStoreOrders(req, res, next);

    const findArgs = Sale.findAndCountAll.mock.calls[0][0];
    expect(findArgs.where.tenantId).toBe('tenant-1');
    expect(findArgs.where.shopId).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it('uses online order scope for trade assurance dashboard on non-shop tenants', async () => {
    const req = {
      tenantId: 'tenant-1',
      shopScoped: false,
      query: { shopId: 'stale-shop-id' },
    };
    const res = mockRes();
    const next = jest.fn();

    await storeController.getTradeAssuranceDashboard(req, res, next);

    expect(getTradeAssuranceSummary).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      shopId: null,
      includeLegacyShopNull: false,
    });
    expect(listTradeAssurancePayments).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      shopId: null,
      includeLegacyShopNull: false,
    }));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it('includes legacy null-shop trade assurance rows for scoped shop tenants', async () => {
    const req = {
      tenantId: 'tenant-1',
      shopScoped: true,
      shopFilterId: 'shop-1',
      query: {},
    };
    const res = mockRes();
    const next = jest.fn();

    await storeController.getTradeAssuranceDashboard(req, res, next);

    expect(getTradeAssuranceSummary).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      shopId: 'shop-1',
      includeLegacyShopNull: true,
    });
    expect(listPayoutHistory).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      shopId: 'shop-1',
      includeLegacyShopNull: true,
    }));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });
});
