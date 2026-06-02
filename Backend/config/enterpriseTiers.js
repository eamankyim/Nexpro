/**
 * ABS Enterprise License tiers (from Terms — section 8).
 * Used for Control Center plan metadata and per-tenant limit enforcement.
 */

const ENTERPRISE_TIERS = {
  starter: {
    id: 'starter',
    name: 'ABS Enterprise Starter',
    licenseFeeGhs: 10000,
    seatLimit: 1,
    branchLimit: 1,
    storageLimitMB: 20480, // 20 GB
    cloudPlanAnnualGhs: 600,
  },
  business: {
    id: 'business',
    name: 'ABS Enterprise Business',
    licenseFeeGhs: 20000,
    seatLimit: 5,
    branchLimit: 5,
    storageLimitMB: 51200, // 50 GB
    cloudPlanAnnualGhs: 1200,
  },
  pro: {
    id: 'pro',
    name: 'ABS Enterprise Pro',
    licenseFeeGhs: 30000,
    seatLimit: 10,
    branchLimit: 10,
    storageLimitMB: 102400, // 100 GB
    cloudPlanAnnualGhs: 2400,
  },
};

const ENTERPRISE_TIER_IDS = Object.keys(ENTERPRISE_TIERS);

const getEnterpriseTier = (tierId) => {
  if (!tierId) return null;
  const key = String(tierId).toLowerCase();
  return ENTERPRISE_TIERS[key] || null;
};

/**
 * Limits for an enterprise tenant: tier override in metadata, else subscription plan row.
 */
const resolveEnterpriseLimits = (tenant, planRow) => {
  const entitlements = tenant?.metadata?.entitlements;
  const tierId = entitlements?.enterpriseTier;
  const tier = getEnterpriseTier(tierId);
  if (tier) {
    return {
      seatLimit: tier.seatLimit,
      branchLimit: tier.branchLimit,
      storageLimitMB: tier.storageLimitMB,
      tierName: tier.name,
      tierId: tier.id,
      source: 'tenant_enterprise_tier',
    };
  }
  if (planRow) {
    return {
      seatLimit: planRow.seatLimit,
      branchLimit: planRow.branchLimit,
      storageLimitMB: planRow.storageLimitMB,
      tierName: planRow.name,
      tierId: planRow.metadata?.selectedEnterpriseTier || null,
      source: 'subscription_plan',
    };
  }
  return {
    seatLimit: 10,
    branchLimit: 10,
    storageLimitMB: null,
    tierName: 'Enterprise',
    tierId: null,
    source: 'fallback_default',
  };
};

module.exports = {
  ENTERPRISE_TIERS,
  ENTERPRISE_TIER_IDS,
  getEnterpriseTier,
  resolveEnterpriseLimits,
};
