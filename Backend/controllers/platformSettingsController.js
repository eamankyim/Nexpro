const { Setting, SubscriptionPlan } = require('../models');
const { FEATURE_CATALOG, FEATURE_CATEGORIES, DEFAULT_PLAN_SEAT_LIMITS, PLAN_SEAT_PRICING, getFeaturesByCategory } = require('../config/features');
const { MODULES, ALL_FEATURES } = require('../config/modules');
const { getStorageUsageSummary } = require('../utils/storageLimitHelper');
const paystackService = require('../services/paystackService');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');

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
    console.log('[platformSettingsController] getSubscriptionPlans: Fetching plans from database...');
    console.log('[platformSettingsController] getSubscriptionPlans: SubscriptionPlan model:', SubscriptionPlan ? 'found' : 'not found');
    
    // First check count
    const count = await SubscriptionPlan.count();
    console.log('[platformSettingsController] getSubscriptionPlans: Total plans in database:', count);
    
    // Get all plans without filtering by isActive
    const plans = await SubscriptionPlan.findAll({
      order: [['order', 'ASC'], ['createdAt', 'ASC']]
    });
    
    // Log active/inactive breakdown
    const activeCount = plans.filter(p => p.isActive).length;
    const inactiveCount = plans.filter(p => !p.isActive).length;
    console.log('[platformSettingsController] getSubscriptionPlans: Active plans:', activeCount);
    console.log('[platformSettingsController] getSubscriptionPlans: Inactive plans:', inactiveCount);

    console.log('[platformSettingsController] getSubscriptionPlans: Found plans:', plans.length);
    console.log('[platformSettingsController] getSubscriptionPlans: Plans raw:', plans);
    
    if (plans.length > 0) {
      console.log('[platformSettingsController] getSubscriptionPlans: First plan:', JSON.stringify(plans[0].toJSON(), null, 2));
    } else {
      console.log('[platformSettingsController] getSubscriptionPlans: No plans found in database!');
      console.log('[platformSettingsController] getSubscriptionPlans: Check if plans table exists and has data');
    }

    const response = {
      success: true,
      count: plans.length,
      data: plans.map(plan => plan.toJSON ? plan.toJSON() : plan)
    };

    console.log('[platformSettingsController] getSubscriptionPlans: Response count:', response.count);
    console.log('[platformSettingsController] getSubscriptionPlans: Response data length:', response.data.length);
    console.log('[platformSettingsController] getSubscriptionPlans: Response JSON size:', JSON.stringify(response).length, 'bytes');
    
    res.status(200).json(response);
  } catch (error) {
    console.error('[platformSettingsController] getSubscriptionPlans: Error:', error);
    console.error('[platformSettingsController] getSubscriptionPlans: Error stack:', error.stack);
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
 * @desc    Sync plans from Paystack to database
 * @route   POST /api/platform-settings/plans/sync-paystack
 * @access  Platform Admin Only
 */
exports.syncPaystackPlans = async (req, res, next) => {
  try {
    console.log('[platformSettingsController] syncPaystackPlans: Starting sync...');
    
    if (!paystackService.secretKey) {
      return res.status(400).json({
        success: false,
        message: 'Paystack secret key not configured'
      });
    }

    // Fetch plans from Paystack
    console.log('[platformSettingsController] syncPaystackPlans: Fetching plans from Paystack...');
    const paystackResponse = await paystackService.listPlans();
    
    if (!paystackResponse.status || !paystackResponse.data || paystackResponse.data.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No plans found in Paystack'
      });
    }

    const paystackPlans = paystackResponse.data;
    console.log('[platformSettingsController] syncPaystackPlans: Found', paystackPlans.length, 'plans in Paystack');

    const syncedPlans = [];
    const errors = [];

    // Map Paystack plans to database format
    for (const paystackPlan of paystackPlans) {
      try {
        console.log('[platformSettingsController] syncPaystackPlans: Processing plan:', {
          name: paystackPlan.name,
          plan_code: paystackPlan.plan_code,
          amount: paystackPlan.amount,
          interval: paystackPlan.interval,
          status: paystackPlan.status,
          active: paystackPlan.active,
          isActive: paystackPlan.isActive,
          fullPlan: JSON.stringify(paystackPlan, null, 2)
        });
        
        // Extract plan ID from name or use plan_code as fallback
        // Paystack plan names might be like "Starter Monthly" or "Starter"
        const planName = paystackPlan.name || '';
        
        // Try to find existing plan by Paystack plan code in metadata first
        let existingPlan = null;
        if (paystackPlan.plan_code) {
          // Use Sequelize JSONB query syntax to find by Paystack plan code
          existingPlan = await SubscriptionPlan.findOne({
            where: sequelize.where(
              sequelize.cast(sequelize.col('metadata'), 'text'),
              'LIKE',
              `%"paystackPlanCode":"${paystackPlan.plan_code}"%`
            )
          });
        }
        
        // If not found by Paystack code, try to match by planId derived from name
        if (!existingPlan) {
          const planId = planName.toLowerCase()
            .replace(/\(.*?\)/g, '') // Remove parentheses content
            .replace(/monthly|yearly|annually/gi, '') // Remove billing period
            .trim()
            .replace(/[^a-z0-9]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '') || 
            paystackPlan.plan_code?.toLowerCase().replace(/[^a-z0-9]/g, '_');
          
          if (planId) {
            existingPlan = await SubscriptionPlan.findOne({ where: { planId } });
          }
        }
        
        // Determine order based on amount (cheaper first)
        const order = paystackPlan.amount || 0;
        
        // Convert amount from kobo/pesewas to main currency unit
        const amount = paystackPlan.amount ? paystackPlan.amount / 100 : 0;
        
        // Determine interval
        const interval = paystackPlan.interval || 'monthly';
        const isYearly = interval === 'annually' || interval === 'yearly';
        
        // Generate planId if we don't have an existing plan
        const planId = existingPlan?.planId || 
          planName.toLowerCase()
            .replace(/\(.*?\)/g, '')
            .replace(/monthly|yearly|annually/gi, '')
            .trim()
            .replace(/[^a-z0-9]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '') || 
          `plan_${paystackPlan.plan_code?.toLowerCase().replace(/[^a-z0-9]/g, '_') || Date.now()}`;
        
        // Paystack plans: default to ACTIVE unless explicitly marked as inactive
        // Paystack API might return: status: 'active' | 'inactive' | 'archived' or active: true/false
        // Most plans created via API are active by default
        const paystackStatus = paystackPlan.status?.toLowerCase();
        const paystackActive = paystackPlan.active;
        const paystackIsActive = paystackPlan.isActive;
        
        // Only mark as inactive if explicitly set to inactive
        // Default to ACTIVE (true) for all plans unless clearly marked inactive
        let isActive = true; // Default to active
        
        if (paystackStatus === 'inactive' || paystackStatus === 'archived' || paystackStatus === 'deleted') {
          isActive = false;
        } else if (paystackActive === false || paystackIsActive === false) {
          isActive = false;
        } else if (paystackStatus === 'active' || paystackActive === true || paystackIsActive === true) {
          isActive = true;
        }
        // Otherwise keep default (true)
        
        console.log('[platformSettingsController] syncPaystackPlans: Plan status check:', {
          plan_code: paystackPlan.plan_code,
          name: paystackPlan.name,
          status: paystackPlan.status,
          active: paystackPlan.active,
          isActive: paystackPlan.isActive,
          computedIsActive: isActive,
          allFields: Object.keys(paystackPlan)
        });
        
        const planData = {
          planId,
          order,
          name: planName,
          description: paystackPlan.description || '',
          price: {
            amount,
            currency: paystackPlan.currency || 'GHS',
            display: `${paystackPlan.currency || 'GHS'} ${amount.toFixed(2)}/${interval}`,
            billingDescription: `${paystackPlan.currency || 'GHS'} ${amount.toFixed(2)} per ${interval}`
          },
          highlights: [],
          marketing: {
            enabled: true,
            perks: [],
            featureFlags: {},
            popular: false
          },
          onboarding: {
            enabled: true,
            isDefault: false
          },
          isActive: isActive,
          metadata: {
            paystackPlanCode: paystackPlan.plan_code,
            paystackId: paystackPlan.id,
            interval: paystackPlan.interval,
            createdAt: paystackPlan.createdAt
          }
        };

        let plan;
        let created;
        
        if (existingPlan) {
          // Update existing plan
          console.log('[platformSettingsController] syncPaystackPlans: Updating existing plan:', existingPlan.planId);
          await existingPlan.update(planData);
          plan = existingPlan;
          created = false;
        } else {
          // Create new plan
          console.log('[platformSettingsController] syncPaystackPlans: Creating new plan:', planId);
          plan = await SubscriptionPlan.create(planData);
          created = true;
        }

        syncedPlans.push({
          planId: plan.planId,
          name: plan.name,
          paystackCode: paystackPlan.plan_code,
          action: created ? 'created' : 'updated'
        });

        console.log(`[platformSettingsController] syncPaystackPlans: ${created ? 'Created' : 'Updated'} plan: ${plan.name} (${plan.planId})`);
      } catch (error) {
        console.error(`[platformSettingsController] syncPaystackPlans: Error syncing plan ${paystackPlan.plan_code}:`, error);
        console.error(`[platformSettingsController] syncPaystackPlans: Error stack:`, error.stack);
        errors.push({
          paystackCode: paystackPlan.plan_code,
          name: paystackPlan.name,
          error: error.message
        });
      }
    }

    console.log('[platformSettingsController] syncPaystackPlans: Sync complete. Synced:', syncedPlans.length, 'Errors:', errors.length);

    res.status(200).json({
      success: true,
      message: `Synced ${syncedPlans.length} plans from Paystack`,
      synced: syncedPlans.length,
      errors: errors.length,
      plans: syncedPlans,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('[platformSettingsController] syncPaystackPlans: Error:', error);
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


