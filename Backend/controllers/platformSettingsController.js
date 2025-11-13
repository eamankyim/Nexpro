const { Setting, SubscriptionPlan } = require('../models');
const { FEATURE_CATALOG, FEATURE_CATEGORIES, DEFAULT_PLAN_SEAT_LIMITS, PLAN_SEAT_PRICING, getFeaturesByCategory } = require('../config/features');
const { MODULES, ALL_FEATURES } = require('../config/modules');
const { getStorageUsageSummary } = require('../utils/storageLimitHelper');

const CORE_SETTINGS_KEYS = [
  'platform:branding',
  'platform:featureFlags',
  'platform:communications'
];

exports.getPlatformSettings = async (req, res, next) => {
  try {
    const settings = await Setting.findAll({
      where: {
        tenantId: null,
        key: CORE_SETTINGS_KEYS
      }
    });

    const payload = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value || {};
      return acc;
    }, {});

    CORE_SETTINGS_KEYS.forEach((key) => {
      if (!payload[key]) {
        payload[key] = {};
      }
    });

    res.status(200).json({
      success: true,
      data: payload
    });
  } catch (error) {
    next(error);
  }
};

exports.updatePlatformSettings = async (req, res, next) => {
  try {
    const { branding, featureFlags, communications } = req.body || {};

    const upserts = [
      {
        key: 'platform:branding',
        value: branding
      },
      {
        key: 'platform:featureFlags',
        value: featureFlags
      },
      {
        key: 'platform:communications',
        value: communications
      }
    ];

    await Promise.all(
      upserts.map(async ({ key, value }) => {
        await Setting.upsert({
          tenantId: null,
          key,
          value: value || {}
        });
      })
    );

    res.status(200).json({
      success: true,
      message: 'Platform settings updated'
    });
  } catch (error) {
    next(error);
  }
};

// =====================================================
// Subscription Plan Management (CMS)
// =====================================================

/**
 * @desc    Get all subscription plans (admin view)
 * @route   GET /api/platform/plans
 * @access  Platform Admin Only
 */
exports.getSubscriptionPlans = async (req, res, next) => {
  try {
    const plans = await SubscriptionPlan.findAll({
      order: [['order', 'ASC'], ['createdAt', 'ASC']]
    });

    res.status(200).json({
      success: true,
      count: plans.length,
      data: plans
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single subscription plan
 * @route   GET /api/platform/plans/:id
 * @access  Platform Admin Only
 */
exports.getSubscriptionPlan = async (req, res, next) => {
  try {
    const plan = await SubscriptionPlan.findByPk(req.params.id);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Subscription plan not found'
      });
    }

    res.status(200).json({
      success: true,
      data: plan
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create new subscription plan
 * @route   POST /api/platform/plans
 * @access  Platform Admin Only
 */
exports.createSubscriptionPlan = async (req, res, next) => {
  try {
    const {
      planId,
      order,
      name,
      description,
      price,
      highlights,
      marketing,
      onboarding,
      isActive,
      metadata
    } = req.body;

    // Check if planId already exists
    const existingPlan = await SubscriptionPlan.findOne({ where: { planId } });
    if (existingPlan) {
      return res.status(400).json({
        success: false,
        message: `A plan with ID "${planId}" already exists`
      });
    }

    const plan = await SubscriptionPlan.create({
      planId,
      order: order || 0,
      name,
      description,
      price: price || {},
      highlights: highlights || [],
      marketing: marketing || {},
      onboarding: onboarding || {},
      isActive: isActive !== undefined ? isActive : true,
      metadata: metadata || {}
    });

    res.status(201).json({
      success: true,
      message: 'Subscription plan created successfully',
      data: plan
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update subscription plan
 * @route   PUT /api/platform/plans/:id
 * @access  Platform Admin Only
 */
exports.updateSubscriptionPlan = async (req, res, next) => {
  try {
    const plan = await SubscriptionPlan.findByPk(req.params.id);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Subscription plan not found'
      });
    }

    const {
      planId,
      order,
      name,
      description,
      price,
      highlights,
      marketing,
      onboarding,
      isActive,
      metadata
    } = req.body;

    // If planId is being changed, check for duplicates
    if (planId && planId !== plan.planId) {
      const existingPlan = await SubscriptionPlan.findOne({ where: { planId } });
      if (existingPlan) {
        return res.status(400).json({
          success: false,
          message: `A plan with ID "${planId}" already exists`
        });
      }
    }

    await plan.update({
      planId: planId || plan.planId,
      order: order !== undefined ? order : plan.order,
      name: name || plan.name,
      description: description !== undefined ? description : plan.description,
      price: price || plan.price,
      highlights: highlights || plan.highlights,
      marketing: marketing || plan.marketing,
      onboarding: onboarding || plan.onboarding,
      isActive: isActive !== undefined ? isActive : plan.isActive,
      metadata: metadata || plan.metadata
    });

    res.status(200).json({
      success: true,
      message: 'Subscription plan updated successfully',
      data: plan
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete subscription plan
 * @route   DELETE /api/platform/plans/:id
 * @access  Platform Admin Only
 */
exports.deleteSubscriptionPlan = async (req, res, next) => {
  try {
    const plan = await SubscriptionPlan.findByPk(req.params.id);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Subscription plan not found'
      });
    }

    await plan.destroy();

    res.status(200).json({
      success: true,
      message: 'Subscription plan deleted successfully',
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Bulk update plan order
 * @route   PUT /api/platform/plans/bulk/reorder
 * @access  Platform Admin Only
 */
exports.reorderSubscriptionPlans = async (req, res, next) => {
  try {
    const { planOrders } = req.body; // Expected format: [{ id: 'uuid', order: 1 }, ...]

    if (!Array.isArray(planOrders)) {
      return res.status(400).json({
        success: false,
        message: 'planOrders must be an array'
      });
    }

    await Promise.all(
      planOrders.map(({ id, order }) =>
        SubscriptionPlan.update({ order }, { where: { id } })
      )
    );

    res.status(200).json({
      success: true,
      message: 'Plan order updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get feature catalog (legacy - returns flat features)
 * @route   GET /api/platform-settings/features
 * @access  Platform Admin Only
 */
exports.getFeatureCatalog = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        features: FEATURE_CATALOG,
        categories: FEATURE_CATEGORIES,
        seatLimits: DEFAULT_PLAN_SEAT_LIMITS,
        featuresByCategory: getFeaturesByCategory()
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get modules (organized features for pricing)
 * @route   GET /api/platform-settings/modules
 * @access  Platform Admin Only
 */
exports.getModules = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        modules: MODULES,
        allFeatures: ALL_FEATURES,
        totalModules: MODULES.length,
        totalFeatures: ALL_FEATURES.length
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get storage usage for a tenant
 * @route   GET /api/platform-settings/storage-usage/:tenantId
 * @access  Platform Admin Only
 */
exports.getTenantStorageUsage = async (req, res, next) => {
  try {
    const { tenantId } = req.params;
    const storageUsage = await getStorageUsageSummary(tenantId);

    res.status(200).json({
      success: true,
      data: storageUsage
    });
  } catch (error) {
    next(error);
  }
};


