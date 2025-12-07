const express = require('express');
const { protect, requirePlatformAdmin } = require('../middleware/auth');
const {
  getPlatformSummary,
  getTenants,
  bootstrapPlatformAdmin,
  getTenantMetrics,
  getPlatformAlerts,
  getTenantById,
  updateTenantStatus,
  getBillingSummary,
  getBillingTenants,
  getSystemHealth,
  updateTenantBranding
} = require('../controllers/adminController');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: ControlCenter
 *   description: Platform control center endpoints (platform admin only)
 */

/**
 * @swagger
 * /api/admin/bootstrap:
 *   post:
 *     summary: One-time platform admin bootstrap
 *     description: Creates the first platform administrator when none exist yet.
 *     tags: [ControlCenter]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       201:
 *         description: Platform admin created successfully.
 *       409:
 *         description: Platform admin already exists.
 */
router.post('/bootstrap', bootstrapPlatformAdmin);

router.use(protect);
router.use(requirePlatformAdmin);

/**
 * @swagger
 * /api/admin/summary:
 *   get:
 *     summary: Platform-wide KPIs
 *     tags: [ControlCenter]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Aggregate metrics across all tenants.
 */
router.get('/summary', getPlatformSummary);

/**
 * @swagger
 * /api/admin/tenants:
 *   get:
 *     summary: Paginated tenant directory
 *     tags: [ControlCenter]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number (default 1)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Page size (default 20)
 *     responses:
 *       200:
 *         description: List of tenants with plan and usage info.
 */
router.get('/tenants', getTenants);

/**
 * @swagger
 * /api/admin/metrics/tenants:
 *   get:
 *     summary: Tenant metrics and trends
 *     tags: [ControlCenter]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Time-series and distribution metrics for tenants.
 */
router.get('/metrics/tenants', getTenantMetrics);

/**
 * @swagger
 * /api/admin/alerts:
 *   get:
 *     summary: Platform alerts
 *     tags: [ControlCenter]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Notices for upcoming trial expirations or tenants needing attention.
 */
router.get('/alerts', getPlatformAlerts);

/**
 * @swagger
 * /api/admin/tenants/{tenantId}:
 *   get:
 *     summary: Tenant detail
 *     tags: [ControlCenter]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: Detailed tenant information, including members.
 *       404:
 *         description: Tenant not found.
 */
router.get('/tenants/:id', getTenantById);

/**
 * @swagger
 * /api/admin/tenants/{tenantId}/status:
 *   patch:
 *     summary: Update tenant status
 *     tags: [ControlCenter]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         schema:
 *           type: string
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [action]
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [activate, pause, suspend]
 *     responses:
 *       200:
 *         description: Tenant status updated.
 *       400:
 *         description: Invalid action.
 *       404:
 *         description: Tenant not found.
 */
router.patch('/tenants/:id/status', updateTenantStatus);

/**
 * @swagger
 * /api/admin/billing/summary:
 *   get:
 *     summary: Billing overview
 *     tags: [ControlCenter]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Estimated MRR and plan breakdown.
 */
router.get('/billing/summary', getBillingSummary);

/**
 * @swagger
 * /api/admin/billing/tenants:
 *   get:
 *     summary: Paying tenants list
 *     tags: [ControlCenter]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Tenants with paid plans.
 */
router.get('/billing/tenants', getBillingTenants);

/**
 * @swagger
 * /api/admin/health:
 *   get:
 *     summary: Platform system health
 *     tags: [ControlCenter]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Uptime, database status, and recent alerts.
 */
router.get('/health', getSystemHealth);

/**
 * @swagger
 * /api/admin/tenants/{tenantId}/branding:
 *   patch:
 *     summary: Update tenant branding
 *     tags: [ControlCenter]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         schema:
 *           type: string
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               logoUrl:
 *                 type: string
 *                 description: Base64 encoded image data
 *     responses:
 *       200:
 *         description: Tenant branding updated.
 */
router.patch('/tenants/:id/branding', updateTenantBranding);

module.exports = router;

