jest.mock('../../../models', () => {
  const makeStore = (overrides = {}) => ({
    id: 'store-1',
    tenantId: 'tenant-1',
    shopId: 'shop-1',
    slug: 'tasty-bites',
    displayName: 'Tasty Bites',
    description: 'Local meals',
    logoUrl: null,
    bannerImageUrl: null,
    primaryColor: '#166534',
    currency: 'GHS',
    pickupEnabled: true,
    deliveryEnabled: true,
    deliveryFee: 12,
    metadata: {
      cuisineTags: ['Ghanaian', 'Fast food'],
      avgPrepMinutes: 25,
      freeDeliveryThreshold: 100,
      openingHours: {
        friday: { open: '08:00', close: '22:00' },
      },
    },
    shop: { shopType: 'restaurant', city: 'Accra', country: 'Ghana', logoUrl: null, isActive: true },
    reviewSummary: { rating: 4.5, reviewsCount: 12 },
    get: jest.fn(function get() { return { ...this }; }),
    ...overrides,
  });

  return {
    OnlineProductListing: {
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
    },
    OnlineStoreSettings: {
      findAll: jest.fn().mockResolvedValue([makeStore(), makeStore({
        id: 'store-2',
        slug: 'fresh-mart',
        displayName: 'Fresh Mart',
        shop: { shopType: 'supermarket', city: 'Accra', country: 'Ghana', logoUrl: null, isActive: true },
        metadata: { cuisineTags: ['Groceries'] },
      })]),
      findOne: jest.fn(),
      findAndCountAll: jest.fn(),
    },
    SaleItem: { findAll: jest.fn().mockResolvedValue([]) },
    Sale: {},
    Product: {},
    ProductVariant: {},
    ProductCategory: {},
    Shop: {},
    Tenant: {},
    Customer: {},
    StorefrontCustomer: {},
    StorefrontWishlistItem: {},
    MarketplaceDispute: {},
    OnlineServiceListing: {},
  };
});

jest.mock('../../../services/storefrontReviewService', () => ({
  attachProductReviewSummaries: jest.fn((items) => Promise.resolve(items)),
  attachStoreReviewSummaries: jest.fn((stores) => Promise.resolve(stores)),
  getPublicReviewSummary: jest.fn(),
}));

jest.mock('../../../controllers/studioStoreController', () => ({
  countPublishedServiceListings: jest.fn(),
  getStudioMarketplaceHomeData: jest.fn().mockResolvedValue({ categories: [], popularStudios: [], featuredServices: [] }),
  isStudioTenant: jest.fn(),
}));

const storeController = require('../../../controllers/storeController');

describe('getMarketplaceFoodHome', () => {
  it('returns food discovery payload sections', async () => {
    const req = {};
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await storeController.getMarketplaceFoodHome(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({
        cuisineChips: expect.any(Array),
        restaurants: expect.any(Array),
        hasVendors: expect.any(Boolean),
        hero: expect.objectContaining({ title: expect.any(String) }),
      }),
    }));
  });
});

describe('getMarketplaceStores shopType filter', () => {
  it('accepts shopType query and returns store cards', async () => {
    const { OnlineStoreSettings } = require('../../../models');
    OnlineStoreSettings.findAndCountAll = jest.fn().mockResolvedValue({ count: 0, rows: [] });

    const req = { query: { shopType: 'restaurant', page: 1, limit: 12 } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await storeController.getMarketplaceStores(req, res, next);

    expect(OnlineStoreSettings.findAndCountAll).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
