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
  Dealer: {},
  Shop: {},
  Invoice: {
    findAll: jest.fn(),
  },
  User: {},
  SaleActivity: {
    create: jest.fn(),
    destroy: jest.fn(),
  },
  Tenant: {},
  Payment: {
    destroy: jest.fn(),
  },
  Setting: {},
  SaleReturn: {
    count: jest.fn(),
  },
}));

jest.mock('../../../services/invoiceAccountingService', () => ({
  createInvoiceRevenueJournal: jest.fn(),
}));
jest.mock('../../../services/saleAccountingService', () => ({
  createSaleCogsJournal: jest.fn(),
  createSaleRevenueJournal: jest.fn(),
}));
jest.mock('../../../services/accountingService', () => ({
  reverseAndDestroyJournalEntries: jest.fn().mockResolvedValue(0),
}));
jest.mock('../../../services/dealerLedgerService', () => ({
  recordSaleCharge: jest.fn(),
  reverseAndDestroyLedgerEntriesForSale: jest.fn().mockResolvedValue(0),
}));
jest.mock('../../../services/customerBalanceService', () => ({
  updateCustomerBalance: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../services/dealerBalanceService', () => ({
  checkCreditLimit: jest.fn(),
}));
jest.mock('../../../services/invoiceSaleService', () => ({
  syncSaleInvoiceAndRefreshCustomerBalance: jest.fn(),
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
jest.mock('../../../services/automationEngineService', () => ({
  runReviewRequestAutomations: jest.fn(),
  runSaleCompletedAutomations: jest.fn(),
  runOrderCreatedAutomations: jest.fn(),
  runLowProfitMarginAutomations: jest.fn(),
  runStockChangeAutomations: jest.fn(),
}));
jest.mock('../../../services/deliverySettingsService', () => ({
  resolveDeliveryForSale: jest.fn(),
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
const { Sale, SaleItem, SaleActivity, Invoice, Payment, SaleReturn } = require('../../../models');
const { assertShopRecordAccess } = require('../../../utils/shopUtils');
const { reverseAndDestroyJournalEntries } = require('../../../services/accountingService');
const { reverseAndDestroyLedgerEntriesForSale } = require('../../../services/dealerLedgerService');
const { updateCustomerBalance } = require('../../../services/customerBalanceService');
const saleController = require('../../../controllers/saleController');

describe('saleController deleteSale (soft vs hard delete)', () => {
  let transaction;

  beforeEach(() => {
    jest.clearAllMocks();
    assertShopRecordAccess.mockImplementation(() => undefined);
    transaction = { commit: jest.fn(), rollback: jest.fn(), LOCK: { UPDATE: 'UPDATE' } };
    sequelize.transaction.mockResolvedValue(transaction);
    SaleReturn.count.mockResolvedValue(0);
    Invoice.findAll.mockResolvedValue([]);
    Payment.destroy.mockResolvedValue(0);
    reverseAndDestroyJournalEntries.mockResolvedValue(0);
    reverseAndDestroyLedgerEntriesForSale.mockResolvedValue(0);
    updateCustomerBalance.mockResolvedValue(undefined);
  });

  const buildSale = (overrides = {}) => ({
    id: 'sale-1',
    tenantId: 'tenant-1',
    amountPaid: 100,
    status: 'completed',
    deletedAt: null,
    customerId: null,
    invoiceId: null,
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

  it('hard-deletes the sale row for admins and cleans journals', async () => {
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
    expect(reverseAndDestroyJournalEntries).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      sources: expect.arrayContaining([
        { source: 'sale_revenue', sourceId: 'sale-1' },
        { source: 'sale_cogs', sourceId: 'sale-1' },
      ]),
    }));
    expect(reverseAndDestroyLedgerEntriesForSale).toHaveBeenCalledWith(expect.objectContaining({
      saleId: 'sale-1',
    }));
    expect(transaction.commit).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(next).not.toHaveBeenCalled();
  });

  it('hard-deletes paid-invoice sales for admins (payments, journals, invoice)', async () => {
    const invoice = {
      id: 'inv-1',
      status: 'paid',
      saleId: 'sale-1',
      customerId: 'cust-1',
      update: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn().mockResolvedValue(undefined),
    };
    const sale = buildSale({
      invoiceId: 'inv-1',
      invoice,
      customerId: 'cust-1',
      amountPaid: 500,
      status: 'completed',
    });
    Sale.findOne.mockResolvedValue(sale);
    Invoice.findAll.mockResolvedValue([invoice]);
    SaleItem.destroy.mockResolvedValue(undefined);
    SaleActivity.destroy.mockResolvedValue(undefined);

    const req = {
      params: { id: 'sale-1' },
      tenantId: 'tenant-1',
      tenantRole: 'owner',
      user: { id: 'owner-1', role: 'admin' },
      body: {},
    };
    const res = buildRes();
    const next = jest.fn();

    await saleController.deleteSale(req, res, next);

    expect(Payment.destroy).toHaveBeenCalled();
    expect(reverseAndDestroyJournalEntries).toHaveBeenCalledWith(expect.objectContaining({
      sources: expect.arrayContaining([
        { source: 'invoice_revenue', sourceId: 'inv-1' },
        { source: 'invoice_payment', sourceId: 'inv-1' },
      ]),
    }));
    expect(sale.update).toHaveBeenCalledWith({ invoiceId: null }, { transaction });
    expect(invoice.destroy).toHaveBeenCalledWith({ transaction });
    expect(updateCustomerBalance).toHaveBeenCalledWith('cust-1', transaction);
    expect(sale.destroy).toHaveBeenCalled();
    expect(transaction.commit).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it('blocks permanent delete when the sale has returns', async () => {
    const sale = buildSale();
    Sale.findOne.mockResolvedValue(sale);
    SaleReturn.count.mockResolvedValue(2);

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

    expect(sale.destroy).not.toHaveBeenCalled();
    expect(transaction.rollback).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('returns'),
    }));
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
      { transaction }
    );
    expect(SaleActivity.create).toHaveBeenCalled();
    expect(transaction.commit).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
