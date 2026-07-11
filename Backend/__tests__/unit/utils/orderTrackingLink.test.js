const {
  buildOrderTrackingLink,
  resolveOrderTrackingLink,
} = require('../../../utils/orderTrackingLink');

describe('orderTrackingLink', () => {
  const originalFrontendUrl = process.env.FRONTEND_URL;

  afterEach(() => {
    process.env.FRONTEND_URL = originalFrontendUrl;
  });

  describe('buildOrderTrackingLink', () => {
    it('builds /track/{slug} from FRONTEND_URL', () => {
      process.env.FRONTEND_URL = 'https://app.example.com/';
      expect(buildOrderTrackingLink({ tenantSlug: 'kofi-kitchen' })).toBe(
        'https://app.example.com/track/kofi-kitchen'
      );
    });

    it('appends order query when orderNumber is provided', () => {
      process.env.FRONTEND_URL = 'https://app.example.com';
      expect(
        buildOrderTrackingLink({ tenantSlug: 'kofi-kitchen', orderNumber: 'ORD-1001' })
      ).toBe('https://app.example.com/track/kofi-kitchen?order=ORD-1001');
    });

    it('encodes slug and order number', () => {
      process.env.FRONTEND_URL = 'http://localhost:3000';
      expect(
        buildOrderTrackingLink({ tenantSlug: 'café shop', orderNumber: 'A B/1' })
      ).toBe('http://localhost:3000/track/caf%C3%A9%20shop?order=A%20B%2F1');
    });

    it('returns null without a slug', () => {
      expect(buildOrderTrackingLink({ tenantSlug: '' })).toBeNull();
      expect(buildOrderTrackingLink({})).toBeNull();
    });
  });

  describe('resolveOrderTrackingLink', () => {
    it('loads tenant slug and builds link with order number', async () => {
      process.env.FRONTEND_URL = 'https://app.example.com';
      const TenantModel = {
        findByPk: jest.fn().mockResolvedValue({ id: 't1', slug: 'barima-eats' }),
      };

      const link = await resolveOrderTrackingLink('t1', {
        orderNumber: 'SALE-9',
        TenantModel,
      });

      expect(TenantModel.findByPk).toHaveBeenCalledWith('t1', { attributes: ['id', 'slug'] });
      expect(link).toBe('https://app.example.com/track/barima-eats?order=SALE-9');
    });

    it('returns null when tenant has no slug', async () => {
      const TenantModel = {
        findByPk: jest.fn().mockResolvedValue({ id: 't1', slug: null }),
      };
      await expect(resolveOrderTrackingLink('t1', { TenantModel })).resolves.toBeNull();
    });

    it('returns null without tenantId', async () => {
      await expect(resolveOrderTrackingLink(null)).resolves.toBeNull();
    });
  });
});
