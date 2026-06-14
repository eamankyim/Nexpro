jest.mock('../../../models', () => {
  const makeProductStore = (overrides = {}) => ({
    id: 'store-1',
    tenantId: 'tenant-1',
    shopId: 'shop-1',
    slug: 'tech-hub',
    displayName: 'Tech Hub',
    description: 'Gadgets and accessories',
    logoUrl: null,
    bannerImageUrl: null,
    primaryColor: '#166534',
    currency: 'GHS',
    pickupEnabled: true,
    deliveryEnabled: true,
    deliveryFee: 15,
    metadata: {},
    shop: { shopType: 'retail', city: 'Accra', country: 'Ghana', logoUrl: null, isActive: true },
    reviewSummary: { rating: 4.2, reviewsCount: 8 },
    get: jest.fn(function get() { return { ...this }; }),
    ...overrides,
  });

  const makeListing = (overrides = {}) => ({
    id: 'listing-1',
    tenantId: 'tenant-1',
    shopId: 'shop-1',
    productId: 'product-1',
    title: 'Wireless Mouse',
    slug: 'wireless-mouse',
    shortDescription: 'Ergonomic mouse',
    publicPrice: 120,
    compareAtPrice: 150,
    images: ['https://example.com/mouse.jpg'],
    inventoryPolicy: 'track',
    sortOrder: 0,
    publishedAt: new Date('2026-06-01'),
    get: jest.fn(function get() { return { ...this }; }),
    ...overrides,
  });

  return {
    OnlineProductListing: {
      findAll: jest.fn().mockResolvedValue([makeListing()]),
      findOne: jest.fn(),
    },
    OnlineStoreSettings: {
      findAll: jest.fn().mockResolvedValue([makeProductStore()]),
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

describe('getMarketplaceProductsHome', () => {
  it('returns product discovery payload sections', async () => {
    const req = {};
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await storeController.getMarketplaceProductsHome(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data).toEqual(expect.objectContaining({
      hero: expect.objectContaining({ title: expect.any(String) }),
      categories: expect.any(Array),
      popularStores: expect.any(Array),
      featuredProducts: expect.any(Array),
      newArrivals: expect.any(Array),
      bestDeals: expect.any(Array),
      deliveryStores: expect.any(Array),
      hasVendors: expect.any(Boolean),
    }));
  });
});
