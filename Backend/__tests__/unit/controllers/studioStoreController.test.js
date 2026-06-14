const {
  serviceListingPayloadFromBody,
  assertServiceListingPublishable,
  isStudioTenant,
} = require('../../../controllers/studioStoreController');

describe('studioStoreController helpers', () => {
  describe('isStudioTenant', () => {
    it('returns true for studio-like business types', () => {
      expect(isStudioTenant('printing_press')).toBe(true);
      expect(isStudioTenant('barber')).toBe(true);
    });

    it('returns false for shop tenants', () => {
      expect(isStudioTenant('shop')).toBe(false);
    });
  });

  describe('serviceListingPayloadFromBody', () => {
    it('builds a quote-only listing payload', () => {
      const payload = serviceListingPayloadFromBody({
        title: 'Logo Design',
        category: 'Branding',
        priceType: 'quote_only',
        status: 'draft',
      });

      expect(payload.title).toBe('Logo Design');
      expect(payload.priceType).toBe('quote_only');
      expect(payload.startingPrice).toBeNull();
      expect(payload.slug).toBe('logo-design');
    });
  });

  describe('assertServiceListingPublishable', () => {
    it('requires images for published listings', () => {
      expect(() => assertServiceListingPublishable({
        title: 'Haircut',
        priceType: 'fixed',
        startingPrice: 50,
        images: [],
      })).toThrow('Published services need 1 to 5 images');
    });
  });
});
