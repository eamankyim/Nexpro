jest.mock('../../../models', () => {
  const mockListing = {
    id: 'listing-1',
    tenantId: 'tenant-1',
    shopId: null,
    productId: 'product-1',
    title: 'Sample Product',
    slug: 'sample-product',
    publicPrice: 25,
    images: [],
    inventoryPolicy: 'deny',
    product: { category: { id: 'cat-1', name: 'General' } },
    get: jest.fn(function get() { return { ...this }; }),
  };

  return {
    OnlineProductListing: {
      findOne: jest.fn().mockResolvedValue(mockListing),
    },
    OnlineStoreSettings: {
      findOne: jest.fn().mockResolvedValue({
        slug: 'demo-shop',
        displayName: 'Demo Shop',
        currency: 'GHS',
        deliveryEnabled: true,
        pickupEnabled: true,
        deliveryFee: 10,
        tenantId: 'tenant-1',
        shopId: null,
        get: jest.fn(function get() { return { ...this }; }),
      }),
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
  buildEligibilityResponse: jest.fn(),
  createOrUpdateVerifiedReview: jest.fn(),
  getOrderReviewActions: jest.fn(),
  getPublicReviewSummary: jest.fn().mockResolvedValue({ rating: null, reviewsCount: 0 }),
  parseConfirmationReviewPayload: jest.fn(),
  updateOwnReview: jest.fn(),
}));

const storeController = require('../../../controllers/storeController');

describe('getMarketplaceProduct', () => {
  it('returns 404 when product is missing', async () => {
    const { OnlineProductListing } = require('../../../models');
    OnlineProductListing.findOne.mockResolvedValueOnce(null);

    const req = { params: { idOrSlug: 'missing' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await storeController.getMarketplaceProduct(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });
});

describe('previewStorefrontCheckout route wiring', () => {
  it('registers checkout preview endpoint', () => {
    const publicRoutes = require('../../../routes/publicRoutes');
    const stack = publicRoutes.stack || [];
    const paths = stack
      .map((layer) => layer.route?.path)
      .filter(Boolean);
    expect(paths).toContain('/storefront/checkout/preview');
  });
});
