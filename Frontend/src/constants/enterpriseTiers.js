/** Mirror of Backend/config/enterpriseTiers.js for Control Center UI */

export const ENTERPRISE_TIERS = {
  starter: {
    id: 'starter',
    name: 'ABS Enterprise Starter',
    licenseFeeGhs: 10000,
    seatLimit: 1,
    branchLimit: 1,
    storageLimitGB: 20,
    storageLimitMB: 20480,
    cloudPlanAnnualGhs: 600,
  },
  business: {
    id: 'business',
    name: 'ABS Enterprise Business',
    licenseFeeGhs: 20000,
    seatLimit: 5,
    branchLimit: 5,
    storageLimitGB: 50,
    storageLimitMB: 51200,
    cloudPlanAnnualGhs: 1200,
  },
  pro: {
    id: 'pro',
    name: 'ABS Enterprise Pro',
    licenseFeeGhs: 30000,
    seatLimit: 10,
    branchLimit: 10,
    storageLimitGB: 100,
    storageLimitMB: 102400,
    cloudPlanAnnualGhs: 2400,
  },
};

export const ENTERPRISE_TIER_OPTIONS = Object.values(ENTERPRISE_TIERS);

export const getEnterpriseTier = (tierId) => {
  if (!tierId) return null;
  return ENTERPRISE_TIERS[String(tierId).toLowerCase()] || null;
};

export const applyEnterpriseTierToLimits = (tierId) => {
  const tier = getEnterpriseTier(tierId);
  if (!tier) return { seatLimit: '', branchLimit: '', storageLimitMB: '' };
  return {
    seatLimit: String(tier.seatLimit),
    branchLimit: String(tier.branchLimit),
    storageLimitMB: String(tier.storageLimitMB),
  };
};
