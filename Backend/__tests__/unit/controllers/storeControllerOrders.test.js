jest.mock('../../../config/database', () => ({
  sequelize: {
    where: jest.fn((left, right) => ({ type: 'where', left, right })),
    json: jest.fn((path) => ({ type: 'json', path })),
    transaction: jest.fn(),
  },
  testConnection: jest.fn(),
}));

jest.mock('../../../models', () => ({
  OnlineStoreSettings: { findOne: jest.fn(), create: jest.fn(), count: jest.fn() },
  OnlineProductListing: { findOne: jest.fn(), findAndCountAll: jest.fn(), count: jest.fn(), create: jest.fn(), findAll: jest.fn() },
  Sale: { findAndCountAll: jest.fn(), findOne: jest.fn(), count: jest.fn(), sum: jest.fn() },
  SaleItem: {},
  SaleActivity: { create: jest.fn() },
  Customer: {},
  Product: {},
  ProductVariant: {},
  Shop: {},
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

const { sequelize } = require('../../../config/database');
const { Sale, SaleActivity } = require('../../../models');
const { invalidateSaleListCache } = require('../../../middleware/cache');
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
    Sale.count.mockResolvedValue(0);
    Sale.sum.mockResolvedValue(0);
  });

  it('lists only online store sales with stats and pagination', async () => {
    Sale.count
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(2);
    Sale.sum.mockResolvedValueOnce(125.5);

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
    expect(sequelize.json).toHaveBeenCalledWith('metadata.source');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      count: 1,
      stats: expect.objectContaining({
        total: 4,
        pendingPayment: 1,
        paid: 2,
        todayOrders: 2,
        todayRevenue: 125.5,
      }),
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

    expect(order.update).toHaveBeenCalledWith(
      { orderStatus: 'ready', deliveryStatus: 'out_for_delivery' },
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
});
