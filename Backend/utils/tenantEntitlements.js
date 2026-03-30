const { SubscriptionPlan } = require('../models');
const { getFeaturesForPlan } = require('../config/features');

const ACCESS_STATES = ['active', 'read_only', 'restricted', 'suspended'];

const getTenantEntitlementsMeta = (tenant) => {
  const metadata = tenant?.metadata && typeof tenant.metadata === 'object' ? tenant.metadata : {};
  const entitlements = metadata.entitlements && typeof metadata.entitlements === 'object'
    ? metadata.entitlements
    : {};
  return entitlements;
};

const normalizeFeatureOverrides = (overrides) => {
  if (!overrides || typeof overrides !== 'object') return {};
  return Object.entries(overrides).reduce((acc, [key, value]) => {
    if (typeof value === 'boolean') {
      acc[key] = value;
    }
    return acc;
  }, {});
};

const buildBaseFeatureFlags = (tenantPlan, dbPlan) => {
  if (dbPlan?.marketing?.featureFlags && typeof dbPlan.marketing.featureFlags === 'object') {
    return { ...dbPlan.marketing.featureFlags };
  }
  const fallback = getFeaturesForPlan(tenantPlan) || [];
  return fallback.reduce((acc, featureKey) => {
    acc[featureKey] = true;
    return acc;
  }, {});
};

const computeEffectiveFeatureFlags = (baseFeatureFlags, featureOverrides) => ({
  ...baseFeatureFlags,
  ...normalizeFeatureOverrides(featureOverrides),
});

const resolveTenantAccessState = (tenant) => {
  const entitlements = getTenantEntitlementsMeta(tenant);
  const configured = entitlements.accessState;
  if (ACCESS_STATES.includes(configured)) {
    return configured;
  }
  if (tenant?.status === 'suspended') return 'suspended';
  if (tenant?.status === 'paused') return 'restricted';
  return 'active';
};

/**
 * @param {object} tenant - Sequelize Tenant instance or plain row
 * @param {{ logContext?: string }} [options] - When set (e.g. getMe, admin_tenant_detail), logs plan/access/features for that flow (not used on every API request).
 */
const getTenantEffectiveEntitlements = async (tenant, options = {}) => {
  const { logContext } = options;
  const dbPlan = await SubscriptionPlan.findOne({
    where: { planId: tenant.plan, isActive: true },
    attributes: ['id', 'planId', 'name', 'marketing', 'seatLimit', 'storageLimitMB'],
  });
  const entitlementsMeta = getTenantEntitlementsMeta(tenant);
  const featureOverrides = normalizeFeatureOverrides(entitlementsMeta.featureOverrides);
  const baseFeatureFlags = buildBaseFeatureFlags(tenant.plan, dbPlan);
  const effectiveFeatureFlags = computeEffectiveFeatureFlags(baseFeatureFlags, featureOverrides);
  const enabledFeatures = Object.keys(effectiveFeatureFlags).filter((k) => effectiveFeatureFlags[k] === true);
  const accessState = resolveTenantAccessState(tenant);
  const matrix =
    dbPlan?.marketing?.featureFlags && typeof dbPlan.marketing.featureFlags === 'object'
      ? dbPlan.marketing.featureFlags
      : null;
  const featureBaseSource = matrix && Object.keys(matrix).length > 0 ? 'subscription_plan_matrix' : 'catalog_fallback';

  if (logContext) {
    const overrideKeys = Object.keys(featureOverrides);
    console.log(
      '[TenantAccess] %s tenantId=%s tenant.plan=%s resolvedPlanRow=%s featureBase=%s accessState=%s overrideKeys=%s enabledCount=%s enabled=%j',
      logContext,
      tenant?.id || 'n/a',
      tenant?.plan || 'n/a',
      dbPlan ? `${dbPlan.planId} (${dbPlan.name})` : `none (using tenant.plan=${tenant?.plan})`,
      featureBaseSource,
      accessState,
      overrideKeys.length ? overrideKeys.sort().join(',') : '—',
      enabledFeatures.length,
      enabledFeatures.sort()
    );
  }

  return {
    accessState,
    baseFeatureFlags,
    featureOverrides,
    effectiveFeatureFlags,
    enabledFeatures,
    limits: {
      seatLimit: dbPlan?.seatLimit ?? null,
      storageLimitMB: dbPlan?.storageLimitMB ?? null,
    },
    sourcePlan: dbPlan
      ? { id: dbPlan.id, planId: dbPlan.planId, name: dbPlan.name }
      : { id: null, planId: tenant.plan, name: tenant.plan },
    updatedAt: entitlementsMeta.updatedAt || null,
    updatedBy: entitlementsMeta.updatedBy || null,
    note: entitlementsMeta.note || '',
  };
};

module.exports = {
  ACCESS_STATES,
  getTenantEntitlementsMeta,
  normalizeFeatureOverrides,
  buildBaseFeatureFlags,
  computeEffectiveFeatureFlags,
  resolveTenantAccessState,
  getTenantEffectiveEntitlements,
};
