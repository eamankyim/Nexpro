jest.mock('../../../config/database', () => ({
  sequelize: {
    query: jest.fn(),
    QueryTypes: { SELECT: 'SELECT' },
    transaction: jest.fn(),
  },
}));

jest.mock('../../../models', () => ({
  Dealer: {
    findAndCountAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
  },
  DealerLedgerEntry: {},
  DealerPriceTier: {},
  DealerProductPrice: {},
  Payment: {},
  User: {},
  Shop: {},
}));

jest.mock('../../../utils/tenantUtils', () => ({
  applyTenantFilter: jest.fn((_tenantId, where) => where),
  sanitizePayload: jest.fn((body) => ({ ...body })),
}));

jest.mock('../../../utils/shopUtils', () => ({
  applyShopFilter: jest.fn((req, where) => (
    req.shopFilterId ? { ...where, shopId: req.shopFilterId } : where
  )),
  attachShopToPayload: jest.fn((req, payload) => ({
    ...payload,
    shopId: req.shopFilterId || null,
  })),
  getShopIdForWrite: jest.fn((req) => req.shopFilterId || null),
  getShopSqlFragment: jest.fn((req) => (
    req.shopFilterId
      ? { sql: ' AND "shopId" = :shopFilterId', replacements: { shopFilterId: req.shopFilterId } }
      : { sql: '', replacements: {} }
  )),
  assertShopRecordAccess: jest.fn(),
}));

jest.mock('../../../utils/paginationUtils', () => ({
  getPagination: jest.fn(() => ({ page: 1, limit: 10, offset: 0 })),
}));

jest.mock('../../../services/dealerBalanceService', () => ({
  roundMoney: jest.fn((v) => Number(v)),
  getAvailableCredit: jest.fn(() => 0),
  checkCreditLimit: jest.fn(),
  parseAmount: jest.fn((v) => Number(v)),
}));

jest.mock('../../../services/dealerLedgerService', () => ({
  recordOpeningBalance: jest.fn(),
  recordPayment: jest.fn(),
  recordAdjustment: jest.fn(),
}));

jest.mock('../../../services/dealerPricingService', () => ({
  resolvePrice: jest.fn(),
  resolvePricesForItems: jest.fn(),
  listDealerPrices: jest.fn(),
  upsertDealerPrices: jest.fn(),
}));

jest.mock('../../../services/dealerStatementService', () => ({
  getDealerStatement: jest.fn(),
  getOutstandingDealersReport: jest.fn(),
}));

const { sequelize } = require('../../../config/database');
const { Dealer } = require('../../../models');
const { applyShopFilter, attachShopToPayload, getShopSqlFragment } = require('../../../utils/shopUtils');
const dealerController = require('../../../controllers/dealerController');

describe('dealerController shop scope', () => {
  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getDealers filters by active shop', async () => {
    Dealer.findAndCountAll.mockResolvedValue({
      count: 1,
      rows: [{ toJSON: () => ({ id: 'd1', balance: 0, creditLimit: 0 }) }],
    });
    const req = {
      tenantId: 'tenant-1',
      shopScoped: true,
      shopFilterId: 'shop-a',
      query: {},
    };
    const res = mockRes();
    const next = jest.fn();

    await dealerController.getDealers(req, res, next);

    expect(applyShopFilter).toHaveBeenCalled();
    expect(Dealer.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ shopId: 'shop-a' }),
    }));
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('getDealers returns 400 when shop-scoped tenant has no active shop', async () => {
    const req = {
      tenantId: 'tenant-1',
      shopScoped: true,
      shopFilterId: null,
      query: {},
    };
    const res = mockRes();
    const next = jest.fn();

    await dealerController.getDealers(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Dealer.findAndCountAll).not.toHaveBeenCalled();
  });

  it('getDealerStats scopes SQL to active shop', async () => {
    sequelize.query.mockResolvedValue([{
      totalDealers: 2,
      activeDealers: 2,
      totalOutstanding: 100,
      totalAvailableCredit: 50,
    }]);
    const req = {
      tenantId: 'tenant-1',
      shopScoped: true,
      shopFilterId: 'shop-b',
    };
    const res = mockRes();
    const next = jest.fn();

    await dealerController.getDealerStats(req, res, next);

    expect(getShopSqlFragment).toHaveBeenCalledWith(req);
    expect(sequelize.query).toHaveBeenCalledWith(
      expect.stringContaining('"shopId" = :shopFilterId'),
      expect.objectContaining({
        replacements: expect.objectContaining({ tenantId: 'tenant-1', shopFilterId: 'shop-b' }),
      }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('createDealer attaches shopId from active branch', async () => {
    const transaction = { commit: jest.fn(), rollback: jest.fn() };
    sequelize.transaction.mockResolvedValue(transaction);
    Dealer.create.mockResolvedValue({
      id: 'dealer-1',
      shopId: 'shop-a',
      balance: 0,
      creditLimit: 0,
      reload: jest.fn(),
      toJSON: () => ({ id: 'dealer-1', shopId: 'shop-a', balance: 0, creditLimit: 0 }),
    });

    const req = {
      tenantId: 'tenant-1',
      shopScoped: true,
      shopFilterId: 'shop-a',
      body: { businessName: 'Danito Enterprise' },
    };
    const res = mockRes();
    const next = jest.fn();

    await dealerController.createDealer(req, res, next);

    expect(attachShopToPayload).toHaveBeenCalled();
    expect(Dealer.create).toHaveBeenCalledWith(
      expect.objectContaining({ shopId: 'shop-a', tenantId: 'tenant-1' }),
      expect.any(Object),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
