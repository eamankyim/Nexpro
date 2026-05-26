const {
  normalizeTenantClassification,
} = require('../../../utils/tenantClassification');

describe('tenantClassification', () => {
  it('defaults unclassified tenants to shop with other shopType', () => {
    const tenant = normalizeTenantClassification({
      id: 'tenant-1',
      businessType: null,
      metadata: {},
    });

    expect(tenant.businessType).toBe('shop');
    expect(tenant.metadata.shopType).toBe('other');
    expect(tenant.metadata.onboarding).toBeUndefined();
  });

  it('preserves explicit shop subtype metadata', () => {
    const tenant = normalizeTenantClassification({
      id: 'tenant-2',
      businessType: 'shop',
      metadata: { businessSubType: 'restaurant' },
    });

    expect(tenant.businessType).toBe('shop');
    expect(tenant.metadata.shopType).toBe('restaurant');
  });

  it('maps legacy studio business types to studio and keeps the legacy subtype', () => {
    const tenant = normalizeTenantClassification({
      id: 'tenant-3',
      businessType: 'printing_press',
      metadata: {},
    });

    expect(tenant.businessType).toBe('studio');
    expect(tenant.metadata.studioType).toBe('printing_press');
    expect(tenant.metadata.shopType).toBeUndefined();
  });

  it('does not invent a studioType for unknown studio tenants', () => {
    const tenant = normalizeTenantClassification({
      id: 'tenant-4',
      businessType: 'studio',
      metadata: {},
    });

    expect(tenant.businessType).toBe('studio');
    expect(tenant.metadata.studioType).toBeUndefined();
  });
});
