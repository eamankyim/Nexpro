const { Tenant, SubscriptionPlan, Shop, StudioLocation, Pharmacy } = require('../models');
const { DEFAULT_PLAN_BRANCH_LIMITS } = require('../config/features');
const { resolveEnterpriseLimits } = require('../config/enterpriseTiers');

const BRANCH_RESOURCES = {
  shop: {
    model: Shop,
    label: 'shops',
  },
  studioLocation: {
    model: StudioLocation,
    label: 'studio locations',
  },
  pharmacy: {
    model: Pharmacy,
    label: 'pharmacy locations',
  },
};

async function getTenantBranchUsage(tenantId, resourceType) {
  const resource = BRANCH_RESOURCES[resourceType];
  if (!resource) {
    throw Object.assign(new Error(`Unknown branch resource type: ${resourceType}`), {
      statusCode: 500,
    });
  }
  return resource.model.count({ where: { tenantId } });
}

async function getTenantBranchLimit(tenantId) {
  const tenant = await Tenant.findByPk(tenantId);

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  const normalizedPlan = String(tenant.plan || '').trim().toLowerCase() || 'trial';
  const plan = await SubscriptionPlan.findOne({
    where: { planId: normalizedPlan, isActive: true },
  });

  if (normalizedPlan === 'enterprise') {
    const enterprise = resolveEnterpriseLimits(tenant, plan);
    return {
      limit: enterprise.branchLimit,
      planName: enterprise.tierName || plan?.name || 'Enterprise',
      enterpriseTier: enterprise.tierId,
      source: enterprise.source,
    };
  }

  return {
    limit: plan?.branchLimit ?? DEFAULT_PLAN_BRANCH_LIMITS[normalizedPlan] ?? null,
    planName: plan?.name || normalizedPlan,
    source: plan?.branchLimit != null ? 'database' : 'config',
  };
}

async function canAddBranch(tenantId, resourceType) {
  const [usage, limitInfo] = await Promise.all([
    getTenantBranchUsage(tenantId, resourceType),
    getTenantBranchLimit(tenantId),
  ]);

  if (limitInfo.limit === null) {
    return {
      allowed: true,
      unlimited: true,
      current: usage,
      limit: null,
      remaining: null,
      planName: limitInfo.planName,
      resourceLabel: BRANCH_RESOURCES[resourceType].label,
    };
  }

  const remaining = limitInfo.limit - usage;
  return {
    allowed: usage < limitInfo.limit,
    unlimited: false,
    current: usage,
    limit: limitInfo.limit,
    remaining,
    planName: limitInfo.planName,
    resourceLabel: BRANCH_RESOURCES[resourceType].label,
  };
}

async function validateBranchLimit(tenantId, resourceType, throwError = true) {
  const canAdd = await canAddBranch(tenantId, resourceType);

  if (!canAdd.allowed) {
    const error = new Error(
      `Branch limit reached. Your ${canAdd.planName} plan allows ${canAdd.limit} ${canAdd.resourceLabel}. ` +
        `You currently have ${canAdd.current}. Please upgrade your plan to add more.`
    );
    error.code = 'BRANCH_LIMIT_EXCEEDED';
    error.statusCode = 403;
    error.details = canAdd;

    if (throwError) {
      throw error;
    }
    return { valid: false, error };
  }

  return { valid: true, usage: canAdd };
}

module.exports = {
  getTenantBranchUsage,
  getTenantBranchLimit,
  canAddBranch,
  validateBranchLimit,
};
