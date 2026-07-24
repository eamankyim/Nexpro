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
  DealerProductPrice: {
    destroy: jest.fn(),
  },
  Payment: {
    count: jest.fn(),
    destroy: jest.fn(),
  },
  User: {},
  Shop: {},
  Sale: {
    count: jest.fn(),
    findAll: jest.fn(),
  },
  SaleItem: {},
  Invoice: {},
}));

jest.mock('../../../utils/tenantUtils', () => ({
  applyTenantFilter: jest.fn((tenantId, where) => ({ ...where, tenantId })),
  sanitizePayload: jest.fn((body) => ({ ...body })),
}));

jest.mock('../../../utils/shopUtils', () => ({
  getShopIdForWrite: jest.fn((req) => req.shopFilterId || null),
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
  reverseAndDestroyLedgerEntriesForDealer: jest.fn().mockResolvedValue(0),
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

jest.mock('../../../services/saleHardDeleteService', () => ({
  hardDeleteSaleInTransaction: jest.fn().mockResolvedValue({ invoiceIds: [] }),
}));

jest.mock('../../../middleware/cache', () => ({
  invalidateSaleListCache: jest.fn(),
  invalidateInvoiceListCache: jest.fn(),
  invalidateAfterMutation: jest.fn(),
}));

const { sequelize } = require('../../../config/database');
const { Dealer, Sale, Payment, DealerProductPrice } = require('../../../models');
const { applyTenantFilter } = require('../../../utils/tenantUtils');
const { hardDeleteSaleInTransaction } = require('../../../services/saleHardDeleteService');
const { reverseAndDestroyLedgerEntriesForDealer } = require('../../../services/dealerLedgerService');
const dealerController = require('../../../controllers/dealerController');
const dealerRoutes = require('../../../routes/dealerRoutes');

describe('dealerController tenant scope', () => {
  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getDealers filters by tenant only, not shop', async () => {
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

    expect(applyTenantFilter).toHaveBeenCalledWith('tenant-1', {});
    expect(Dealer.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenantId: 'tenant-1' }),
    }));
    expect(Dealer.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.not.objectContaining({ shopId: 'shop-a' }),
    }));
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('getDealers works without an active shop', async () => {
    Dealer.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
    const req = {
      tenantId: 'tenant-1',
      shopScoped: true,
      shopFilterId: null,
      query: {},
    };
    const res = mockRes();
    const next = jest.fn();

    await dealerController.getDealers(req, res, next);

    expect(Dealer.findAndCountAll).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('getDealerStats scopes SQL to tenant only', async () => {
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

    expect(sequelize.query).toHaveBeenCalledWith(
      expect.not.stringContaining('"shopId"'),
      expect.objectContaining({
        replacements: expect.objectContaining({ tenantId: 'tenant-1' }),
      }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('createDealer accepts empty email as optional', async () => {
    const transaction = { commit: jest.fn(), rollback: jest.fn() };
    sequelize.transaction.mockResolvedValue(transaction);
    Dealer.create.mockResolvedValue({
      id: 'dealer-1',
      balance: 0,
      creditLimit: 0,
      reload: jest.fn(),
      toJSON: () => ({ id: 'dealer-1', balance: 0, creditLimit: 0, email: null }),
    });

    const req = {
      tenantId: 'tenant-1',
      shopScoped: true,
      shopFilterId: 'shop-a',
      body: { businessName: 'Danito Enterprise', email: '' },
    };
    const res = mockRes();
    const next = jest.fn();

    await dealerController.createDealer(req, res, next);

    expect(Dealer.create).toHaveBeenCalledWith(
      expect.objectContaining({ businessName: 'Danito Enterprise', email: null, tenantId: 'tenant-1' }),
      expect.any(Object),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(next).not.toHaveBeenCalled();
  });

  it('createDealer returns 400 for invalid email', async () => {
    const transaction = { commit: jest.fn(), rollback: jest.fn() };
    sequelize.transaction.mockResolvedValue(transaction);

    const req = {
      tenantId: 'tenant-1',
      body: { businessName: 'Danito Enterprise', email: 'not-an-email' },
    };
    const res = mockRes();
    const next = jest.fn();

    await dealerController.createDealer(req, res, next);

    expect(Dealer.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: 'Please enter a valid email address',
      errorCode: 'VALIDATION_ERROR',
    }));
    expect(transaction.rollback).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('createDealer does not attach shopId to dealer row', async () => {
    const transaction = { commit: jest.fn(), rollback: jest.fn() };
    sequelize.transaction.mockResolvedValue(transaction);
    Dealer.create.mockResolvedValue({
      id: 'dealer-1',
      balance: 0,
      creditLimit: 0,
      reload: jest.fn(),
      toJSON: () => ({ id: 'dealer-1', balance: 0, creditLimit: 0 }),
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

    expect(Dealer.create).toHaveBeenCalledWith(
      expect.objectContaining({ businessName: 'Danito Enterprise', tenantId: 'tenant-1' }),
      expect.any(Object),
    );
    expect(Dealer.create).toHaveBeenCalledWith(
      expect.not.objectContaining({ shopId: 'shop-a' }),
      expect.any(Object),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('dealerController deleteDealer', () => {
  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  let transaction;

  beforeEach(() => {
    jest.clearAllMocks();
    transaction = { commit: jest.fn(), rollback: jest.fn(), LOCK: { UPDATE: 'UPDATE' } };
    sequelize.transaction.mockResolvedValue(transaction);
    hardDeleteSaleInTransaction.mockResolvedValue({ invoiceIds: [] });
    reverseAndDestroyLedgerEntriesForDealer.mockResolvedValue(1);
    Payment.destroy.mockResolvedValue(1);
    DealerProductPrice.destroy.mockResolvedValue(1);
  });

  it('cascades hard-delete of sales, remaining payments, ledger, prices, then dealer', async () => {
    const sale = { id: 'sale-1', dealerId: 'dealer-1', items: [] };
    const dealer = {
      id: 'dealer-1',
      businessName: 'Acme Wholesale',
      balance: 120,
      destroy: jest.fn().mockResolvedValue(undefined),
    };
    Dealer.findOne.mockResolvedValue(dealer);
    Sale.findAll.mockResolvedValue([sale]);

    const req = {
      params: { id: 'dealer-1' },
      tenantId: 'tenant-1',
      body: { confirmName: 'Acme Wholesale' },
      user: { id: 'admin-1' },
    };
    const res = mockRes();
    const next = jest.fn();

    await dealerController.deleteDealer(req, res, next);

    expect(hardDeleteSaleInTransaction).toHaveBeenCalledWith(expect.objectContaining({
      sale,
      tenantId: 'tenant-1',
      transaction,
    }));
    expect(reverseAndDestroyLedgerEntriesForDealer).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      dealerId: 'dealer-1',
      transaction,
    });
    expect(Payment.destroy).toHaveBeenCalled();
    expect(DealerProductPrice.destroy).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', dealerId: 'dealer-1' },
      transaction,
    });
    expect(dealer.destroy).toHaveBeenCalledWith({ transaction });
    expect(transaction.commit).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ salesDeleted: 1 }),
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('requires typing the dealer business name', async () => {
    const dealer = {
      id: 'dealer-1',
      businessName: 'Acme Wholesale',
      destroy: jest.fn(),
    };
    Dealer.findOne.mockResolvedValue(dealer);

    const req = {
      params: { id: 'dealer-1' },
      tenantId: 'tenant-1',
      body: { confirmName: 'wrong name' },
    };
    const res = mockRes();
    const next = jest.fn();

    await dealerController.deleteDealer(req, res, next);

    expect(hardDeleteSaleInTransaction).not.toHaveBeenCalled();
    expect(dealer.destroy).not.toHaveBeenCalled();
    expect(transaction.rollback).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      errorCode: 'CONFIRM_NAME_REQUIRED',
    }));
  });

  it('aborts dealer delete when a related sale has returns', async () => {
    const sale = { id: 'sale-1', dealerId: 'dealer-1', items: [] };
    const dealer = {
      id: 'dealer-1',
      businessName: 'Acme Wholesale',
      destroy: jest.fn(),
    };
    Dealer.findOne.mockResolvedValue(dealer);
    Sale.findAll.mockResolvedValue([sale]);
    const err = new Error('Cannot permanently delete a sale that has returns or exchanges. Remove those first, or keep the sale for audit.');
    err.statusCode = 400;
    err.errorCode = 'SALE_HAS_RETURNS';
    hardDeleteSaleInTransaction.mockRejectedValue(err);

    const req = {
      params: { id: 'dealer-1' },
      tenantId: 'tenant-1',
      body: { confirmName: 'Acme Wholesale' },
    };
    const res = mockRes();
    const next = jest.fn();

    await dealerController.deleteDealer(req, res, next);

    expect(dealer.destroy).not.toHaveBeenCalled();
    expect(transaction.rollback).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('returns'),
    }));
  });

  it('getDealerDeleteImpact returns sales, payments, and balance counts', async () => {
    Dealer.findOne.mockResolvedValue({
      id: 'dealer-1',
      businessName: 'Acme Wholesale',
      balance: 250,
    });
    Sale.count.mockResolvedValue(3);
    Payment.count.mockResolvedValue(2);

    const req = { params: { id: 'dealer-1' }, tenantId: 'tenant-1' };
    const res = mockRes();
    const next = jest.fn();

    await dealerController.getDealerDeleteImpact(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        salesCount: 3,
        paymentsCount: 2,
        balance: 250,
        businessName: 'Acme Wholesale',
      }),
    }));
  });
});

describe('dealerRoutes delete authorization', () => {
  it('registers DELETE /:id and GET delete-impact (admin middleware stack)', () => {
    const stack = dealerRoutes.stack || [];
    const deleteLayer = stack.find((layer) =>
      layer.route
      && layer.route.path === '/:id'
      && layer.route.methods?.delete
    );
    const impactLayer = stack.find((layer) =>
      layer.route
      && layer.route.path === '/:id/delete-impact'
      && layer.route.methods?.get
    );

    expect(deleteLayer).toBeTruthy();
    expect(impactLayer).toBeTruthy();
    // authorize('admin') + timeCrudAction + handler (non-admin blocked by authorize)
    expect(deleteLayer.route.stack.length).toBeGreaterThanOrEqual(2);
    expect(impactLayer.route.stack.length).toBeGreaterThanOrEqual(1);
  });

  it('wires authorize(admin) for dealer delete so non-admins cannot call it', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.join(__dirname, '../../../routes/dealerRoutes.js'),
      'utf8',
    );
    expect(source).toMatch(/\.delete\(\s*authorize\(\s*'admin'\s*\)/);
    expect(source).toMatch(/delete-impact[\s\S]*?authorize\(\s*'admin'\s*\)/);
  });
});
