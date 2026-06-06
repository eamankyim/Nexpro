jest.mock('../../../config/database', () => ({
  sequelize: {
    col: jest.fn((name) => ({ col: name })),
    fn: jest.fn((name, ...args) => ({ fn: name, args })),
    json: jest.fn((path) => ({ json: path })),
    literal: jest.fn((value) => ({ literal: value })),
    query: jest.fn(),
    transaction: jest.fn(),
    where: jest.fn((left, right) => ({ where: [left, right] })),
  },
}));

jest.mock('../../../models', () => ({
  Sale: {
    findAndCountAll: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
  },
  SaleItem: {},
  Product: {},
  ProductVariant: {},
  Barcode: {},
  Customer: {},
  Shop: {},
  Invoice: {},
  User: {},
  SaleActivity: {},
  Tenant: {},
  Payment: {},
  Setting: {},
}));

jest.mock('../../../services/invoiceAccountingService', () => ({
  createInvoiceRevenueJournal: jest.fn(),
}));
jest.mock('../../../services/saleAccountingService', () => ({
  createSaleCogsJournal: jest.fn(),
  createSaleRevenueJournal: jest.fn(),
}));
jest.mock('../../../services/websocketService', () => ({
  emitNewSale: jest.fn(),
  emitSaleStatusChange: jest.fn(),
  emitInventoryAlert: jest.fn(),
}));
jest.mock('../../../services/notificationService', () => ({
  notifyOrderStatusChanged: jest.fn(),
  notifyNewOrder: jest.fn(),
}));
jest.mock('../../../services/orderCustomerNotificationService', () => ({
  notifyOrderCreatedForCustomer: jest.fn(),
}));
jest.mock('../../../utils/taxConfig', () => ({
  getTaxConfigForTenant: jest.fn(),
  hasTaxConfigCache: jest.fn(() => false),
}));
jest.mock('../../../utils/taxCalculation', () => ({
  computeDocumentTax: jest.fn(),
}));
jest.mock('../../../utils/tenantLogo', () => ({ getTenantLogoUrl: jest.fn(() => '') }));
jest.mock('../../../utils/shopUtils', () => ({
  applyShopFilter: jest.fn((req, where) => where),
  attachShopToPayload: jest.fn((req, body) => body),
  assertShopRecordAccess: jest.fn(),
  userCanAccessShopId: jest.fn(() => true),
}));
jest.mock('../../../middleware/cache', () => ({
  invalidateSaleListCache: jest.fn(),
}));
jest.mock('../../../config/config', () => ({
  nodeEnv: 'test',
  pagination: {
    defaultPageSize: 10,
    maxPageSize: 100,
  },
}));

const { Op } = require('sequelize');
const { Sale } = require('../../../models');
const { applyShopFilter } = require('../../../utils/shopUtils');
const saleController = require('../../../controllers/saleController');

describe('saleController getSales summary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    applyShopFilter.mockImplementation((_req, where) => where);
    Sale.findAndCountAll.mockResolvedValue({ count: 15, rows: [] });
    Sale.findOne.mockResolvedValue({
      totalSales: 15,
      completedCount: 15,
      pendingCount: 0,
      completedRevenue: '998.00',
    });
    Sale.count.mockResolvedValue(0);
  });

  it('uses today active kitchen queue count (not payment pending or filtered totals)', async () => {
    const req = {
      query: { status: 'completed' },
      tenantId: 'tenant-1',
      tenantRole: 'owner',
      user: { id: 'user-1', role: 'admin' },
      shopScoped: false,
      tenant: {
        businessType: 'shop',
        metadata: { businessSubType: 'restaurant' },
      },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    await saleController.getSales(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(Sale.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        tenantId: 'tenant-1',
        orderStatus: { [Op.in]: ['received', 'preparing', 'ready'] },
        createdAt: { [Op.between]: [expect.any(Date), expect.any(Date)] },
      }),
    });
    expect(Sale.count).toHaveBeenCalledWith({
      where: expect.not.objectContaining({
        status: 'completed',
      }),
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      count: 15,
      summary: expect.objectContaining({
        totalSales: 15,
        completedCount: 15,
        pendingCount: 0,
        kitchenPendingCount: 0,
        completedRevenue: 998,
      }),
    }));
  });

  it('lets shop-scoped staff list same-shop sales without soldBy ownership filter', async () => {
    applyShopFilter.mockImplementation((_req, where) => ({ ...where, shopId: 'shop-a' }));

    const req = {
      query: {},
      tenantId: 'tenant-1',
      tenantRole: 'staff',
      user: { id: 'staff-1', role: 'admin' },
      shopScoped: true,
      shopFilterId: 'shop-a',
      tenant: {
        businessType: 'shop',
        metadata: { businessSubType: 'restaurant' },
      },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    await saleController.getSales(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(Sale.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tenantId: 'tenant-1',
        shopId: 'shop-a',
      }),
    }));
    expect(Sale.findAndCountAll.mock.calls[0][0].where).not.toHaveProperty('soldBy');
    expect(Sale.count.mock.calls[0][0].where).not.toHaveProperty('soldBy');
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
