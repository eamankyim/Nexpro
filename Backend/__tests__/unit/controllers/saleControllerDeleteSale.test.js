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
  SaleItem: {
    destroy: jest.fn(),
  },
  Product: { findByPk: jest.fn() },
  ProductVariant: { findByPk: jest.fn() },
  Barcode: {},
  Customer: {},
  Shop: {},
  Invoice: {},
  User: {},
  SaleActivity: {
    create: jest.fn(),
    destroy: jest.fn(),
  },
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
  invalidateInvoiceListCache: jest.fn(),
  invalidateAfterMutation: jest.fn(),
}));
jest.mock('../../../config/config', () => ({
  nodeEnv: 'test',
  pagination: {
    defaultPageSize: 10,
    maxPageSize: 100,
  },
}));

const { sequelize } = require('../../../config/database');
const { Sale, SaleItem, SaleActivity } = require('../../../models');
const { assertShopRecordAccess } = require('../../../utils/shopUtils');
const saleController = require('../../../controllers/saleController');

describe('saleController deleteSale (soft vs hard delete)', () => {
  let transaction;

  beforeEach(() => {
    jest.clearAllMocks();
    assertShopRecordAccess.mockImplementation(() => undefined);
    transaction = { commit: jest.fn(), rollback: jest.fn() };
    sequelize.transaction.mockResolvedValue(transaction);
  });

  const buildSale = (overrides = {}) => ({
    id: 'sale-1',
    tenantId: 'tenant-1',
    amountPaid: 100,
    status: 'completed',
    deletedAt: null,
    invoice: null,
    items: [],
    update: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  });

  const buildRes = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  });

  it('hard-deletes the sale row for admins (existing behavior)', async () => {
    const sale = buildSale();
    Sale.findOne.mockResolvedValue(sale);
    SaleItem.destroy.mockResolvedValue(undefined);
    SaleActivity.destroy.mockResolvedValue(undefined);

    const req = {
      params: { id: 'sale-1' },
      tenantId: 'tenant-1',
      tenantRole: 'admin',
      user: { id: 'admin-1', role: 'admin' },
      body: {},
    };
    const res = buildRes();
    const next = jest.fn();

    await saleController.deleteSale(req, res, next);

    expect(sale.destroy).toHaveBeenCalled();
    expect(sale.update).not.toHaveBeenCalled();
    expect(transaction.commit).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(next).not.toHaveBeenCalled();
  });

  it('soft-deletes a paid sale for managers, recording the reason and an audit activity', async () => {
    const sale = buildSale({ amountPaid: 250 });
    Sale.findOne.mockResolvedValue(sale);

    const req = {
      params: { id: 'sale-1' },
      tenantId: 'tenant-1',
      tenantRole: 'manager',
      user: { id: 'manager-1', role: 'manager' },
      body: { reason: 'Customer requested cancellation after refund' },
    };
    const res = buildRes();
    const next = jest.fn();

    await saleController.deleteSale(req, res, next);

    expect(sale.destroy).not.toHaveBeenCalled();
    expect(sale.update).toHaveBeenCalledWith(
      expect.objectContaining({
        deletedAt: expect.any(Date),
        deletedBy: 'manager-1',
        deletionReason: 'Customer requested cancellation after refund',
      }),
      expect.any(Object)
    );
    expect(SaleActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        saleId: 'sale-1',
        notes: 'Customer requested cancellation after refund',
        createdBy: 'manager-1',
      }),
      expect.any(Object)
    );
    expect(transaction.commit).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('rejects soft delete for staff when no reason is provided', async () => {
    const sale = buildSale({ amountPaid: 250 });
    Sale.findOne.mockResolvedValue(sale);

    const req = {
      params: { id: 'sale-1' },
      tenantId: 'tenant-1',
      tenantRole: 'staff',
      user: { id: 'staff-1', role: 'staff' },
      body: {},
    };
    const res = buildRes();
    const next = jest.fn();

    await saleController.deleteSale(req, res, next);

    expect(sale.update).not.toHaveBeenCalled();
    expect(sale.destroy).not.toHaveBeenCalled();
    expect(transaction.rollback).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: expect.stringContaining('reason'),
    }));
  });

  it('rejects soft delete for staff on an unpaid sale', async () => {
    const sale = buildSale({ amountPaid: 0 });
    Sale.findOne.mockResolvedValue(sale);

    const req = {
      params: { id: 'sale-1' },
      tenantId: 'tenant-1',
      tenantRole: 'staff',
      user: { id: 'staff-1', role: 'staff' },
      body: { reason: 'Wrong item' },
    };
    const res = buildRes();
    const next = jest.fn();

    await saleController.deleteSale(req, res, next);

    expect(sale.update).not.toHaveBeenCalled();
    expect(transaction.rollback).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: expect.stringContaining('paid'),
    }));
  });

  it('rejects deleting a sale that was already soft-deleted', async () => {
    const sale = buildSale({ deletedAt: new Date() });
    Sale.findOne.mockResolvedValue(sale);

    const req = {
      params: { id: 'sale-1' },
      tenantId: 'tenant-1',
      tenantRole: 'admin',
      user: { id: 'admin-1', role: 'admin' },
      body: {},
    };
    const res = buildRes();
    const next = jest.fn();

    await saleController.deleteSale(req, res, next);

    expect(transaction.rollback).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: expect.stringContaining('already'),
    }));
  });
});
