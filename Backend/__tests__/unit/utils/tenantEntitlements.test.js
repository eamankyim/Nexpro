jest.mock('../../../models', () => ({
  SubscriptionPlan: { findOne: jest.fn() },
}));

const { SubscriptionPlan } = require('../../../models');
const {
  buildBaseFeatureFlags,
  getTenantEffectiveEntitlements,
} = require('../../../utils/tenantEntitlements');
const { getFeatureFlagsForPlan } = require('../../../config/features');

describe('tenantEntitlements', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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

  it('ignores stale db trial matrix and keeps all trial features enabled', () => {
    const flags = buildBaseFeatureFlags('trial', {
      marketing: {
        featureFlags: {
          crm: false,
          automations: false,
        },
      },
    });
    const canonicalTrial = getFeatureFlagsForPlan('trial');
    expect(flags).toEqual(canonicalTrial);
    expect(Object.values(flags).every(Boolean)).toBe(true);
  });

  it('applies admin feature overrides last over gated trial defaults', async () => {
    SubscriptionPlan.findOne.mockResolvedValue({
      id: 'plan-trial',
      planId: 'trial',
      name: 'Trial',
      marketing: {
        featureFlags: {
          automations: true,
          apiAccess: false,
        },
      },
      seatLimit: 5,
      branchLimit: 5,
      storageLimitMB: 1024,
    });

    const entitlements = await getTenantEffectiveEntitlements({
      id: 'tenant-1',
      plan: 'trial',
      businessType: 'shop',
      metadata: {
        entitlements: {
          featureOverrides: {
            automations: false,
            apiAccess: true,
          },
        },
      },
    });

    expect(entitlements.baseFeatureFlags).toEqual(getFeatureFlagsForPlan('trial'));
    expect(entitlements.featureOverrides).toEqual({
      automations: false,
      apiAccess: true,
    });
    expect(entitlements.effectiveFeatureFlags.automations).toBe(false);
    expect(entitlements.effectiveFeatureFlags.apiAccess).toBe(true);
    expect(entitlements.enabledFeatures).not.toContain('automations');
    expect(entitlements.enabledFeatures).toContain('apiAccess');
  });

  it('falls back to canonical self-service limits when no db plan row exists', async () => {
    SubscriptionPlan.findOne.mockResolvedValue(null);

    const entitlements = await getTenantEffectiveEntitlements({
      id: 'tenant-2',
      plan: 'professional',
      businessType: 'shop',
      metadata: {},
    });

    expect(entitlements.limits.seatLimit).toBe(3);
    expect(entitlements.limits.branchLimit).toBe(3);
  });
});
