const express = require('express');
const { protect, requirePlatformAdmin } = require('../middleware/auth');
const {
  getPlatformSettings,
  updatePlatformSettings,
  getSubscriptionPlans,
  getSubscriptionPlan,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
  reorderSubscriptionPlans,
  getFeatureCatalog,
  getModules,
  getTenantStorageUsage
} = require('../controllers/platformSettingsController');

const router = express.Router();

router.use(protect);
router.use(requirePlatformAdmin);

/**
 * @swagger
 * tags:
 *   name: PlatformSettings
 *   description: Platform-wide configuration, branding, and feature flags
 */

/**
 * @swagger
 * /api/platform-settings:
 *   get:
 *     summary: Retrieve platform settings
 *     tags: [PlatformSettings]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Current platform settings.
 */
router.get('/', getPlatformSettings);

/**
 * @swagger
 * /api/platform-settings:
 *   put:
 *     summary: Update platform settings
 *     tags: [PlatformSettings]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               branding:
 *                 type: object
 *               featureFlags:
 *                 type: object
 *               communications:
 *                 type: object
 *     responses:
 *       200:
 *         description: Platform settings updated.
 */
router.put('/', updatePlatformSettings);

/**
 * @swagger
 * /api/platform-settings/features:
 *   get:
 *     summary: Get feature catalog
 *     tags: [PlatformSettings]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Feature catalog with categories
 */
router.get('/features', getFeatureCatalog);

/**
 * @swagger
 * /api/platform-settings/modules:
 *   get:
 *     summary: Get modules (organized features for pricing)
 *     tags: [PlatformSettings]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Modules with grouped features
 */
router.get('/modules', getModules);

/**
 * @swagger
 * /api/platform-settings/storage-usage/:tenantId:
 *   get:
 *     summary: Get storage usage for a tenant
 *     tags: [PlatformSettings]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Storage usage details
 */
router.get('/storage-usage/:tenantId', getTenantStorageUsage);

/**
 * @swagger
 * /api/platform-settings/plans:
 *   get:
 *     summary: Get all subscription plans (CMS)
 *     tags: [PlatformSettings]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of all subscription plans
 */
router.get('/plans', getSubscriptionPlans);

/**
 * @swagger
 * /api/platform-settings/plans:
 *   post:
 *     summary: Create new subscription plan
 *     tags: [PlatformSettings]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Subscription plan created
 */
router.post('/plans', createSubscriptionPlan);

/**
 * @swagger
 * /api/platform-settings/plans/bulk/reorder:
 *   put:
 *     summary: Reorder subscription plans
 *     tags: [PlatformSettings]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Plan order updated
 */
router.put('/plans/bulk/reorder', reorderSubscriptionPlans);

/**
 * @swagger
 * /api/platform-settings/plans/:id:
 *   get:
 *     summary: Get single subscription plan
 *     tags: [PlatformSettings]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription plan details
 */
router.get('/plans/:id', getSubscriptionPlan);

/**
 * @swagger
 * /api/platform-settings/plans/:id:
 *   put:
 *     summary: Update subscription plan
 *     tags: [PlatformSettings]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription plan updated
 */
router.put('/plans/:id', updateSubscriptionPlan);

/**
 * @swagger
 * /api/platform-settings/plans/:id:
 *   delete:
 *     summary: Delete subscription plan
 *     tags: [PlatformSettings]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription plan deleted
 */
router.delete('/plans/:id', deleteSubscriptionPlan);

module.exports = router;

