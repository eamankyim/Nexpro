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
    findOne: jest.fn(),
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

const { Sale } = require('../../../models');
const saleController = require('../../../controllers/saleController');

describe('saleController getSale', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Sale.findOne.mockResolvedValue({
      id: 'sale-1',
      soldBy: 'user-1',
      toJSON: () => ({ id: 'sale-1' }),
    });
  });

  it('loads sale items in a separate query with product and variant includes', async () => {
    const req = {
      params: { id: 'sale-1' },
      tenantId: 'tenant-1',
      tenantRole: 'owner',
      user: { id: 'user-1', role: 'admin' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    await saleController.getSale(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(Sale.findOne).toHaveBeenCalledWith(expect.objectContaining({
      include: expect.arrayContaining([
        expect.objectContaining({
          as: 'items',
          separate: true,
          include: expect.arrayContaining([
            expect.objectContaining({ as: 'product' }),
            expect.objectContaining({ as: 'variant' }),
          ]),
        }),
      ]),
    }));
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
