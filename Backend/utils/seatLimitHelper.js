const { Tenant, UserTenant, SubscriptionPlan } = require('../models');
const { DEFAULT_PLAN_SEAT_LIMITS } = require('../config/features');

/**
 * Get current seat usage for a tenant
 */
async function getTenantSeatUsage(tenantId) {
  const activeUsers = await UserTenant.count({
    where: {
      tenantId,
      status: 'active'
    }
  });

  return activeUsers;
}

/**
 * Get seat limit for a tenant based on their plan
 */
async function getTenantSeatLimit(tenantId) {
  const tenant = await Tenant.findByPk(tenantId);
  
  if (!tenant) {
    throw new Error('Tenant not found');
  }

  // First try to get from database
  const plan = await SubscriptionPlan.findOne({
    where: { planId: tenant.plan, isActive: true }
  });

  if (plan) {
    return {
      limit: plan.seatLimit,
      pricePerAdditional: plan.seatPricePerAdditional,
      planName: plan.name,
      source: 'database'
    };
  }

  // Fallback to config
  return {
    limit: DEFAULT_PLAN_SEAT_LIMITS[tenant.plan] || null,
    pricePerAdditional: null,
    planName: tenant.plan,
    source: 'config'
  };
}

/**
 * Check if tenant can add more users
 */
async function canAddUser(tenantId) {
  const [usage, limitInfo] = await Promise.all([
    getTenantSeatUsage(tenantId),
    getTenantSeatLimit(tenantId)
  ]);

  // null limit = unlimited
  if (limitInfo.limit === null) {
    return {
      allowed: true,
      unlimited: true,
      current: usage,
      limit: null,
      remaining: null
    };
  }

  const remaining = limitInfo.limit - usage;
  const allowed = usage < limitInfo.limit;

  return {
    allowed,
    unlimited: false,
    current: usage,
    limit: limitInfo.limit,
    remaining,
    planName: limitInfo.planName,
    pricePerAdditional: limitInfo.pricePerAdditional
  };
}

/**
 * Get seat usage summary for a tenant
 */
async function getSeatUsageSummary(tenantId) {
  const [usage, limitInfo] = await Promise.all([
    getTenantSeatUsage(tenantId),
    getTenantSeatLimit(tenantId)
  ]);

  const isUnlimited = limitInfo.limit === null;
  const remaining = isUnlimited ? null : limitInfo.limit - usage;
  const percentageUsed = isUnlimited ? 0 : Math.round((usage / limitInfo.limit) * 100);
  const isNearLimit = !isUnlimited && remaining <= 2;
  const isAtLimit = !isUnlimited && remaining <= 0;

  return {
    current: usage,
    limit: limitInfo.limit,
    remaining,
    percentageUsed,
    isUnlimited,
    isNearLimit,
    isAtLimit,
    canAddMore: isUnlimited || remaining > 0,
    planName: limitInfo.planName,
    pricePerAdditional: limitInfo.pricePerAdditional
  };
}

/**
 * Validate seat limit before user creation/invite
 */
async function validateSeatLimit(tenantId, throwError = true) {
  const canAdd = await canAddUser(tenantId);

  if (!canAdd.allowed) {
    const error = new Error(
      `Seat limit reached. Your ${canAdd.planName} plan allows ${canAdd.limit} users. ` +
      `You currently have ${canAdd.current} active users. ` +
      (canAdd.pricePerAdditional 
        ? `Upgrade your plan or add seats for GHS ${canAdd.pricePerAdditional} per user.`
        : 'Please upgrade your plan to add more users.')
    );
    error.code = 'SEAT_LIMIT_EXCEEDED';
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
  getTenantSeatUsage,
  getTenantSeatLimit,
  canAddUser,
  getSeatUsageSummary,
  validateSeatLimit
};

