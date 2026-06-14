jest.mock('../../../config/database', () => ({
  sequelize: {
    literal: jest.fn((sql) => sql),
    where: jest.fn((left, right) => ({ left, right })),
  },
}));

jest.mock('../../../models', () => ({
  OnlineProductListing: {},
  OnlineStoreSettings: {},
  Product: {},
  ProductVariant: {},
  Sale: {},
  SaleItem: {},
  StorefrontCustomer: {},
  StorefrontReview: {},
  Tenant: {},
  Shop: {},
}));

const { StorefrontReview } = require('../../../models');
const {
  attachStoreReviewSummaries,
  computeOverallConfirmationRating,
  isReviewableDeliveredOrder,
  parseConfirmationReviewPayload,
  serializeReview,
} = require('../../../services/storefrontReviewService');

describe('storefrontReviewService', () => {
  it('allows delivered delivery orders to be reviewed from the order status', () => {
    expect(isReviewableDeliveredOrder({
      status: 'completed',
      orderStatus: 'delivered',
      deliveryStatus: 'delivered',
      deliveryRequired: true,
      metadata: {},
    })).toBe(true);

    expect(isReviewableDeliveredOrder({
      status: 'completed',
      orderStatus: 'delivered',
      deliveryStatus: 'delivered',
      deliveryRequired: true,
      metadata: { confirmedReceivedAt: new Date().toISOString() },
    })).toBe(true);
  });

  it('allows seller-delivered pickup orders without buyer confirmation', () => {
    expect(isReviewableDeliveredOrder({
      status: 'completed',
      orderStatus: 'completed',
      deliveryStatus: null,
      deliveryRequired: false,
      metadata: {},
    })).toBe(true);
  });

  it('serializes reviews without exposing private shopper contact data', () => {
    const review = serializeReview({
      id: 'review-1',
      reviewType: 'product',
      rating: 5,
      title: 'Great',
      comment: 'Loved it',
      verifiedAt: new Date(),
      storefrontCustomer: {
        name: 'Ama Shopper',
        email: 'ama@example.com',
        phone: '0240000000',
      },
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });

    expect(review).toEqual(expect.objectContaining({
      reviewerName: 'Ama S.',
      rating: 5,
      verified: true,
    }));
    expect(review.email).toBeUndefined();
    expect(review.phone).toBeUndefined();
  });

  it('requires both confirmation checkboxes before confirming receipt', () => {
    expect(() => parseConfirmationReviewPayload({
      confirmations: { receivedOrder: true, itemsMatchOrder: false },
    })).toThrow('Confirm that you received the order');
  });

  it('accepts confirmation without ratings', () => {
    const payload = parseConfirmationReviewPayload({
      confirmations: { receivedOrder: true, itemsMatchOrder: true },
    });
    expect(payload.overallRating).toBeNull();
    expect(payload.ratings).toBeNull();
  });

  it('requires all rating dimensions when any rating is provided', () => {
    expect(() => parseConfirmationReviewPayload({
      confirmations: { receivedOrder: true, itemsMatchOrder: true },
      ratings: { productQuality: 5, valueForMoney: 4 },
    })).toThrow('Rate product quality');
  });

  it('computes the overall confirmation rating from dimension scores', () => {
    const payload = parseConfirmationReviewPayload({
      confirmations: { receivedOrder: true, itemsMatchOrder: true },
      ratings: {
        productQuality: 5,
        valueForMoney: 5,
        packaging: 4,
        deliveryExperience: 4,
      },
      comment: 'Great order',
    });

    expect(payload.overallRating).toBe(5);
    expect(computeOverallConfirmationRating(payload.ratings)).toBe(5);
    expect(payload.comment).toBe('Great order');
  });

  it('returns stores without review data when the reviews table is missing', async () => {
    StorefrontReview.findAll = jest.fn().mockRejectedValue(
      Object.assign(new Error('relation "storefront_reviews" does not exist'), {
        parent: { code: '42P01' },
      })
    );

    const stores = [{ tenantId: 'tenant-1', shopId: null, slug: 'test-store', displayName: 'Test Store' }];
    const result = await attachStoreReviewSummaries(stores);

    expect(result).toEqual([expect.objectContaining({
      slug: 'test-store',
      rating: null,
      reviewsCount: 0,
      reviewSummary: expect.objectContaining({ reviewsCount: 0, reviews: [] }),
    })]);
  });
});
