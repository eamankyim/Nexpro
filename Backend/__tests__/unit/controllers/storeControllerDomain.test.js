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
  OnlineProductListing: {},
  Sale: {},
  SaleItem: {},
  SaleActivity: {},
  MarketplaceOrderPayment: {},
  Customer: {},
  Lead: {},
  Job: {},
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

jest.mock('../../../services/pushNotificationService', () => ({
  dispatchExpoPushToStorefrontCustomers: jest.fn(),
}));

const { Op } = require('sequelize');
const { OnlineStoreSettings } = require('../../../models');
const storeController = require('../../../controllers/storeController');

const buildRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const buildReq = (overrides = {}) => ({
  tenantId: 'tenant-1',
  tenant: { businessType: 'shop' },
  body: {},
  query: {},
  headers: {},
  ...overrides,
});

describe('storeController — "Online Store" custom domain', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.STOREFRONT_CNAME_TARGET;
  });

  describe('getDomainSettings', () => {
    it('returns none/default when no custom domain is set', async () => {
      OnlineStoreSettings.findOne.mockResolvedValueOnce({
        id: 's1',
        slug: 'my-shop',
        displayName: 'My Shop',
        enabled: true,
        customDomain: null,
        customDomainStatus: 'none',
      });
      const req = buildReq();
      const res = buildRes();

      await storeController.getDomainSettings(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(200);
      const payload = res.json.mock.calls[0][0].data;
      expect(payload).toMatchObject({
        slug: 'my-shop',
        hasStoreSettings: true,
        enabled: true,
        customDomain: null,
        customDomainStatus: 'none',
      });
      expect(payload.cnameTarget).toBeTruthy();
    });

    it('reports hasStoreSettings:false when store setup has not started', async () => {
      OnlineStoreSettings.findOne.mockResolvedValueOnce(null);
      const req = buildReq();
      const res = buildRes();

      await storeController.getDomainSettings(req, res, jest.fn());

      const payload = res.json.mock.calls[0][0].data;
      expect(payload.hasStoreSettings).toBe(false);
      expect(payload.customDomainStatus).toBe('none');
    });
  });

  describe('updateDomain', () => {
    it('rejects when store setup has not been completed yet', async () => {
      OnlineStoreSettings.findOne.mockResolvedValueOnce(null);
      const req = buildReq({ body: { customDomain: 'shop.example.com' } });
      const res = buildRes();
      const next = jest.fn();

      await storeController.updateDomain(req, res, next);

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(400);
      expect(error.message).toMatch(/store setup/i);
    });

    it('rejects an invalid domain format', async () => {
      const settings = { id: 's1', update: jest.fn() };
      OnlineStoreSettings.findOne.mockResolvedValueOnce(settings);
      const req = buildReq({ body: { customDomain: 'not a domain' } });
      const res = buildRes();
      const next = jest.fn();

      await storeController.updateDomain(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0].statusCode).toBe(400);
      expect(settings.update).not.toHaveBeenCalled();
    });

    it('rejects a reserved Sabito/ABS domain', async () => {
      const settings = { id: 's1', update: jest.fn() };
      OnlineStoreSettings.findOne.mockResolvedValueOnce(settings);
      const req = buildReq({ body: { customDomain: 'myshop.sabito.app' } });
      const res = buildRes();
      const next = jest.fn();

      await storeController.updateDomain(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0].statusCode).toBe(400);
      expect(next.mock.calls[0][0].message).toMatch(/reserved/i);
    });

    it('rejects a domain already connected to another tenant', async () => {
      const settings = { id: 's1', update: jest.fn() };
      OnlineStoreSettings.findOne
        .mockResolvedValueOnce(settings) // getCurrentStoreSettings
        .mockResolvedValueOnce({ id: 'other', tenantId: 'tenant-2' }); // ensureCustomDomainAvailable
      const req = buildReq({ body: { customDomain: 'shop.example.com' } });
      const res = buildRes();
      const next = jest.fn();

      await storeController.updateDomain(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0].statusCode).toBe(400);
      expect(next.mock.calls[0][0].message).toMatch(/already connected/i);
      expect(settings.update).not.toHaveBeenCalled();
    });

    it('normalizes and saves a valid domain as pending', async () => {
      const settings = { id: 's1', slug: 'my-shop', displayName: 'My Shop', enabled: false, update: jest.fn() };
      settings.update.mockImplementation(async (payload) => {
        Object.assign(settings, payload);
        return settings;
      });
      OnlineStoreSettings.findOne
        .mockResolvedValueOnce(settings) // getCurrentStoreSettings
        .mockResolvedValueOnce(null); // ensureCustomDomainAvailable: no conflict
      const req = buildReq({ body: { customDomain: 'https://Shop.MyClient.com/some/path' } });
      const res = buildRes();
      const next = jest.fn();

      await storeController.updateDomain(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(settings.update).toHaveBeenCalledWith({
        customDomain: 'shop.myclient.com',
        customDomainStatus: 'pending',
      });
      const payload = res.json.mock.calls[0][0].data;
      expect(payload.customDomain).toBe('shop.myclient.com');
      expect(payload.customDomainStatus).toBe('pending');
    });

    it('disconnects the domain when an empty value is submitted', async () => {
      const settings = {
        id: 's1',
        customDomain: 'shop.myclient.com',
        customDomainStatus: 'verified',
        update: jest.fn(),
      };
      settings.update.mockImplementation(async (payload) => {
        Object.assign(settings, payload);
        return settings;
      });
      OnlineStoreSettings.findOne.mockResolvedValueOnce(settings);
      const req = buildReq({ body: { customDomain: '' } });
      const res = buildRes();
      const next = jest.fn();

      await storeController.updateDomain(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(settings.update).toHaveBeenCalledWith({ customDomain: null, customDomainStatus: 'none' });
    });
  });

  describe('resolveStoreByDomain', () => {
    it('returns matched:false when no host is provided', async () => {
      const req = buildReq({ query: {}, headers: {} });
      const res = buildRes();

      await storeController.resolveStoreByDomain(req, res, jest.fn());

      expect(OnlineStoreSettings.findOne).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ success: true, data: { matched: false } });
    });

    it('returns matched:false when the domain is not connected to any active tenant', async () => {
      OnlineStoreSettings.findOne.mockResolvedValueOnce(null);
      const req = buildReq({ query: { host: 'shop.unknown.com' } });
      const res = buildRes();

      await storeController.resolveStoreByDomain(req, res, jest.fn());

      const payload = res.json.mock.calls[0][0].data;
      expect(payload).toEqual({ matched: false });
    });

    it('resolves an active, launched shop store by custom domain', async () => {
      OnlineStoreSettings.findOne.mockResolvedValueOnce({
        id: 's1',
        slug: 'my-shop',
        displayName: 'My Shop',
        enabled: true,
        customDomainStatus: 'pending',
        tenant: { businessType: 'shop', status: 'active' },
      });
      const req = buildReq({ query: { host: 'shop.myclient.com' }, tenant: undefined });
      const res = buildRes();

      await storeController.resolveStoreByDomain(req, res, jest.fn());

      const payload = res.json.mock.calls[0][0].data;
      expect(payload).toMatchObject({
        matched: true,
        slug: 'my-shop',
        launched: true,
        storeType: 'shop',
      });
    });

    it('flags launched:false for a connected but not-yet-launched store', async () => {
      OnlineStoreSettings.findOne.mockResolvedValueOnce({
        id: 's1',
        slug: 'my-shop',
        displayName: 'My Shop',
        enabled: false,
        customDomainStatus: 'pending',
        tenant: { businessType: 'shop', status: 'active' },
      });
      const req = buildReq({ query: { host: 'shop.myclient.com' } });
      const res = buildRes();

      await storeController.resolveStoreByDomain(req, res, jest.fn());

      const payload = res.json.mock.calls[0][0].data;
      expect(payload.matched).toBe(true);
      expect(payload.launched).toBe(false);
    });

    it('returns matched:false when the owning tenant is not active', async () => {
      OnlineStoreSettings.findOne.mockResolvedValueOnce({
        id: 's1',
        slug: 'my-shop',
        enabled: true,
        tenant: { businessType: 'shop', status: 'suspended' },
      });
      const req = buildReq({ query: { host: 'shop.myclient.com' } });
      const res = buildRes();

      await storeController.resolveStoreByDomain(req, res, jest.fn());

      expect(res.json.mock.calls[0][0].data).toEqual({ matched: false });
    });

    it('falls back to the x-forwarded-host header when no query host is given', async () => {
      OnlineStoreSettings.findOne.mockResolvedValueOnce(null);
      const req = buildReq({ query: {}, headers: { 'x-forwarded-host': 'shop.myclient.com' } });
      const res = buildRes();

      await storeController.resolveStoreByDomain(req, res, jest.fn());

      expect(OnlineStoreSettings.findOne).toHaveBeenCalledTimes(1);
      const whereArg = OnlineStoreSettings.findOne.mock.calls[0][0].where;
      expect(whereArg.customDomain[Op.iLike]).toBe('shop.myclient.com');
    });
  });
});
