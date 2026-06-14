jest.mock('../../../models', () => ({
  OnlineStoreSettings: {
    findAll: jest.fn().mockResolvedValue([
      {
        id: 'studio-1',
        tenantId: 'tenant-1',
        studioLocationId: 'loc-1',
        slug: 'ink-studio',
        displayName: 'Ink Studio',
        description: 'Print and design',
        logoUrl: null,
        bannerImageUrl: null,
        primaryColor: '#166534',
        currency: 'GHS',
        pickupEnabled: true,
        deliveryEnabled: false,
        metadata: {},
        studioLocation: { city: 'Accra', country: 'Ghana', logoUrl: null },
        tenant: { businessType: 'printing_press' },
        reviewSummary: { rating: 4.8, reviewsCount: 20 },
        get: jest.fn(function get() { return { ...this }; }),
      },
    ]),
    findOne: jest.fn(),
  },
  OnlineServiceListing: {
    findAll: jest.fn().mockResolvedValue([
      {
        id: 'service-1',
        tenantId: 'tenant-1',
        studioLocationId: 'loc-1',
        title: 'Business Cards',
        slug: 'business-cards',
        shortDescription: 'Premium cards',
        category: 'Print',
        ctaType: 'book_service',
        priceType: 'starting_from',
        startingPrice: 250,
        durationMinutes: 60,
        images: ['https://example.com/cards.jpg'],
        pickupEnabled: true,
        deliveryEnabled: false,
        get: jest.fn(function get() { return { ...this }; }),
      },
      {
        id: 'service-2',
        tenantId: 'tenant-1',
        studioLocationId: 'loc-1',
        title: 'Custom Banner',
        slug: 'custom-banner',
        shortDescription: 'Large format print',
        category: 'Print',
        ctaType: 'request_quote',
        priceType: 'quote_only',
        startingPrice: null,
        images: ['https://example.com/banner.jpg'],
        pickupEnabled: true,
        deliveryEnabled: false,
        get: jest.fn(function get() { return { ...this }; }),
      },
    ]),
  },
  Lead: {},
  Job: {},
  sequelize: {
    transaction: jest.fn(),
    literal: jest.fn(),
  },
}));

jest.mock('../../../services/storefrontReviewService', () => ({
  attachServiceReviewSummaries: jest.fn((items) => Promise.resolve(items)),
  attachStoreReviewSummaries: jest.fn((stores) => Promise.resolve(stores)),
  getPublicReviewSummary: jest.fn(),
}));

const studioStoreController = require('../../../controllers/studioStoreController');

describe('getMarketplaceServicesHome', () => {
  it('returns service discovery payload sections', async () => {
    const req = {};
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await studioStoreController.getMarketplaceServicesHome(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data).toEqual(expect.objectContaining({
      hero: expect.objectContaining({ title: expect.any(String) }),
      categories: expect.any(Array),
      featuredServices: expect.any(Array),
      popularStudios: expect.any(Array),
      bookableServices: expect.any(Array),
      quoteServices: expect.any(Array),
      hasProviders: expect.any(Boolean),
    }));
  });
});
