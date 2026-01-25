const { canAccessFeature, canAccessRoute, getFeatureByKey } = require('../config/features');
const { Tenant, SubscriptionPlan } = require('../models');
const { getFeaturesForBusinessType, isFeatureAvailableForBusinessType } = require('../config/businessTypes');

/**
 * Middleware to check if tenant's plan includes a specific feature
 */
const requireFeature = (featureKey) => {
  return async (req, res, next) => {
    try {
      const tenantId = req.headers['x-tenant-id'] || req.user?.activeTenantId;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'Tenant context required'
        });
      }

      // Get tenant and their plan
      const tenant = await Tenant.findByPk(tenantId);
      
      if (!tenant) {
        return res.status(404).json({
          success: false,
          message: 'Tenant not found'
        });
      }

      // Get plan features from database
      const plan = await SubscriptionPlan.findOne({
        where: { planId: tenant.plan, isActive: true }
      });

      // Get plan features
      let planFeatures = [];
      if (!plan) {
        // Fallback: check config file
        const { getFeaturesForPlan } = require('../config/features');
        planFeatures = getFeaturesForPlan(tenant.plan);
      } else {
        // Check database plan features
        planFeatures = Object.keys(plan.marketing?.featureFlags || {})
          .filter(key => plan.marketing.featureFlags[key] === true);
      }

      // Filter features by business type
      if (tenant.businessType) {
        const businessTypeFeatures = getFeaturesForBusinessType(tenant.businessType);
        planFeatures = planFeatures.filter(f => businessTypeFeatures.includes(f));
      }

      // Check if feature is available
      if (!canAccessFeature(planFeatures, featureKey)) {
        const feature = getFeatureByKey(featureKey);
        const businessTypeMessage = tenant.businessType 
          ? ` or not available for ${tenant.businessType} business type`
          : '';
        return res.status(403).json({
          success: false,
          message: `This feature (${feature?.name || featureKey}) is not included in your current plan${businessTypeMessage}`,
          featureRequired: featureKey,
          currentPlan: tenant.plan,
          businessType: tenant.businessType,
          upgradeRequired: true
        });
      }

      // Feature is available, proceed
      next();
    } catch (error) {
      console.error('Feature access check failed:', error);
      next(error);
    }
  };
};

/**
 * Middleware to check route-based access
 */
const checkRouteAccess = async (req, res, next) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || req.user?.activeTenantId;
    
    // Skip for platform admins
    if (req.user?.isPlatformAdmin) {
      return next();
    }

    if (!tenantId) {
      return next();
    }

    const tenant = await Tenant.findByPk(tenantId);
    if (!tenant) {
      return next();
    }

    // Get plan features
    const plan = await SubscriptionPlan.findOne({
      where: { planId: tenant.plan, isActive: true }
    });

    let planFeatures = [];
    
    if (plan) {
      planFeatures = Object.keys(plan.marketing?.featureFlags || {})
        .filter(key => plan.marketing.featureFlags[key] === true);
    } else {
      // Fallback to config
      const { getFeaturesForPlan } = require('../config/features');
      planFeatures = getFeaturesForPlan(tenant.plan);
    }

    // Filter features by business type
    if (tenant.businessType) {
      const businessTypeFeatures = getFeaturesForBusinessType(tenant.businessType);
      planFeatures = planFeatures.filter(f => businessTypeFeatures.includes(f));
    }

    // Check if route is accessible
    const route = req.path;
    if (!canAccessRoute(planFeatures, route)) {
      return res.status(403).json({
        success: false,
        message: 'This feature is not included in your current plan',
        currentPlan: tenant.plan,
        upgradeRequired: true
      });
    }

    // Attach plan features to request for later use
    req.tenantFeatures = planFeatures;
    req.tenantPlan = tenant.plan;
    
    next();
  } catch (error) {
    console.error('Route access check failed:', error);
    next(error);
  }
};

/**
 * Helper to get tenant features for response
 */
const getTenantFeatures = async (tenantId) => {
  const tenant = await Tenant.findByPk(tenantId);
  if (!tenant) return [];

  const plan = await SubscriptionPlan.findOne({
    where: { planId: tenant.plan, isActive: true }
  });

  let planFeatures = [];
  
  if (plan) {
    planFeatures = Object.keys(plan.marketing?.featureFlags || {})
      .filter(key => plan.marketing.featureFlags[key] === true);
  } else {
    // Fallback
    const { getFeaturesForPlan } = require('../config/features');
    planFeatures = getFeaturesForPlan(tenant.plan);
  }

  // Filter features by business type
  if (tenant.businessType) {
    const businessTypeFeatures = getFeaturesForBusinessType(tenant.businessType);
    planFeatures = planFeatures.filter(f => businessTypeFeatures.includes(f));
  }

  return planFeatures;
};

/**
 * Middleware to check seat limits before user creation
 */
const checkSeatLimit = async (req, res, next) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || req.user?.activeTenantId;

    // Skip for platform admins
    if (req.user?.isPlatformAdmin) {
      return next();
    }

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant context required'
      });
    }

    const { validateSeatLimit } = require('../utils/seatLimitHelper');
    
    // Validate seat limit
    const validation = await validateSeatLimit(tenantId, false);
    
    if (!validation.valid) {
      return res.status(403).json({
        success: false,
        message: validation.error.message,
        code: 'SEAT_LIMIT_EXCEEDED',
        details: validation.error.details,
        upgradeRequired: true
      });
    }

    // Attach usage info to request
    req.seatUsage = validation.usage;
    next();
  } catch (error) {
    console.error('Seat limit check failed:', error);
    next(error);
  }
};

module.exports = {
  requireFeature,
  checkRouteAccess,
  getTenantFeatures,
  checkSeatLimit
};

