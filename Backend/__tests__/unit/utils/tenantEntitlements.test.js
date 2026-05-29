jest.mock('../../../models', () => ({
  SubscriptionPlan: { findOne: jest.fn() },
}));

const { buildBaseFeatureFlags } = require('../../../utils/tenantEntitlements');

describe('tenantEntitlements', () => {
  it('uses canonical professional flags when no db plan row exists', () => {
    const flags = buildBaseFeatureFlags('professional', null);
    expect(flags.automations).toBe(true);
    expect(flags.apiAccess).toBe(false);
    expect(flags.studioLocationsModule).toBe(true);
  });

  it('merges db matrix overrides on top of canonical defaults', () => {
    const flags = buildBaseFeatureFlags('professional', {
      marketing: {
        featureFlags: {
          crm: false,
          apiAccess: true,
        },
      },
    });
    expect(flags.crm).toBe(false);
    expect(flags.apiAccess).toBe(true);
    expect(flags.automations).toBe(true);
  });
});
