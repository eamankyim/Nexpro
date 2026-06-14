jest.mock('../../../config/database', () => ({
  sequelize: {
    transaction: jest.fn(),
  },
}));

jest.mock('../../../config/config', () => ({
  jwt: {
    secret: 'test-secret',
    expire: '1h',
  },
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'storefront.jwt'),
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn(),
}));

jest.mock('../../../services/emailService', () => ({
  sendPlatformMessage: jest.fn(),
}));

jest.mock('../../../services/emailTemplates', () => ({
  emailOtpCode: jest.fn(),
  passwordReset: jest.fn(),
}));

jest.mock('../../../services/notificationService', () => ({
  notifyOnlineStoreOrderReceived: jest.fn(),
}));

jest.mock('../../../middleware/upload', () => ({
  baseUploadDir: '/tmp/uploads',
  ensureDirExists: jest.fn(),
}));

jest.mock('../../../services/tradeAssuranceService', () => ({
  markReleaseEligibleForSale: jest.fn(),
  openDisputeForSale: jest.fn(),
  recordHeldPaymentForSale: jest.fn(),
}));

jest.mock('../../../services/storefrontReviewService', () => ({
  buildEligibilityResponse: jest.fn(),
  createOrUpdateVerifiedReview: jest.fn(),
  getOrderReviewActions: jest.fn(),
  getPublicReviewSummary: jest.fn(),
  parseConfirmationReviewPayload: jest.fn(),
  updateOwnReview: jest.fn(),
}));

const mockStore = {
  slug: 'demo-shop',
  displayName: 'Demo Shop',
  currency: 'GHS',
  deliveryEnabled: true,
  pickupEnabled: true,
  deliveryFee: 10,
  tenantId: 'tenant-1',
  shopId: null,
  metadata: {},
  tenant: { id: 'tenant-1', name: 'Demo Tenant', status: 'active' },
  reload: jest.fn(async function reload() {
    return this;
  }),
};

const mockListing = {
  id: 'listing-1',
  tenantId: 'tenant-1',
  shopId: null,
  productId: 'product-1',
  productVariantId: null,
  title: 'Sample Product',
  publicPrice: 25,
  images: ['https://example.com/image.jpg'],
  inventoryPolicy: 'deny',
  status: 'published',
};

const mockProduct = {
  id: 'product-1',
  tenantId: 'tenant-1',
  isActive: true,
  hasVariants: false,
  trackStock: true,
  quantityOnHand: 10,
  sku: 'SKU-1',
  imageUrl: null,
};

jest.mock('../../../models', () => ({
  Customer: {},
  OnlineProductListing: {
    findAll: jest.fn(),
  },
  OnlineStoreSettings: {
    findOne: jest.fn(),
  },
  Product: {
    findAll: jest.fn(),
  },
  ProductCategory: {},
  ProductVariant: {
    findAll: jest.fn(),
  },
  Sale: {},
  SaleActivity: {},
  SaleItem: {},
  StorefrontCustomer: {},
  StorefrontWishlistItem: {},
  MarketplaceDispute: {},
  Tenant: {},
  Shop: {},
}));

const {
  OnlineProductListing,
  OnlineStoreSettings,
  Product,
  ProductVariant,
} = require('../../../models');
const storefrontCustomerController = require('../../../controllers/storefrontCustomerController');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('previewStorefrontCheckout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    OnlineStoreSettings.findOne.mockResolvedValue(mockStore);
    OnlineProductListing.findAll.mockResolvedValue([mockListing]);
    Product.findAll.mockResolvedValue([mockProduct]);
    ProductVariant.findAll.mockResolvedValue([]);
  });

  it('returns checkout preview without requiring a database transaction lock', async () => {
    const req = {
      storefrontCustomer: {
        id: 'shopper-1',
        email: 'shopper@example.com',
        name: 'Ama Shopper',
      },
      body: {
        storeSlug: 'demo-shop',
        items: [{ listingId: 'listing-1', quantity: 2 }],
        fulfillmentMethod: 'pickup',
      },
    };
    const res = mockRes();
    const next = jest.fn();

    await storefrontCustomerController.previewStorefrontCheckout(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({
        subtotal: 50,
        deliveryFee: 0,
        total: 50,
        fulfillmentMethod: 'pickup',
        items: [
          expect.objectContaining({
            listingId: 'listing-1',
            quantity: 2,
            unitPrice: 25,
            subtotal: 50,
            available: true,
          }),
        ],
      }),
    }));
    expect(OnlineStoreSettings.findOne).toHaveBeenCalledWith(expect.objectContaining({
      transaction: null,
      lock: undefined,
    }));
    expect(Product.findAll).toHaveBeenCalledWith(expect.objectContaining({
      transaction: null,
      lock: undefined,
    }));
  });
});
