const express = require('express');
const { protect, requirePlatformAdmin } = require('../middleware/auth');
const { loadPlatformAdminPermissions, requirePlatformAdminPermission, requireAnyPlatformAdminPermission } = require('../middleware/platformAdminPermissions');
const {
  getPlatformSummary,
  getTenants,
  inviteTenant,
  getTenantInvites,
  revokeTenantInvite,
  bootstrapPlatformAdmin,
  getTenantMetrics,
  getPlatformAlerts,
  getTenantById,
  getTenantAccessAudit,
  updateTenantAccess,
  getTenantVendors,
  getTenantJobs,
  updateTenantStatus,
  getBillingSummary,
  getBillingTenants,
  getSystemHealth,
  updateTenantBranding
} = require('../controllers/adminController');
const {
  getAdminKpiSummary,
  getAdminRevenueReport,
  getAdminExpenseReport,
  getAdminPipelineSummary,
  getAdminTopCustomers
} = require('../controllers/adminReportController');
const {
  getAdminLeads,
  getAdminLead,
  createAdminLead,
  updateAdminLead,
  deleteAdminLead,
  addAdminLeadActivity,
  getAdminLeadStats,
  convertAdminLeadToJob
} = require('../controllers/adminLeadController');
const {
  getAdminJobs,
  getAdminJob,
  createAdminJob,
  updateAdminJob,
  assignAdminJob,
  deleteAdminJob,
  getAdminJobStats
} = require('../controllers/adminJobController');
const {
  getAdminExpenseCategories,
  getAdminExpenses,
  getAdminExpense,
  getAdminExpenseStats,
  createAdminExpense
} = require('../controllers/adminExpenseController');
const {
  getAdminCustomers,
  getAdminCustomer,
  createAdminCustomer,
  updateAdminCustomer,
  deleteAdminCustomer
} = require('../controllers/adminCustomerController');

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
router.use(loadPlatformAdminPermissions); // Load permissions for all admin routes

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
router.get('/summary', requirePlatformAdminPermission('overview.view'), getPlatformSummary);

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
router.post('/tenants/invite', requirePlatformAdminPermission('tenants.create'), inviteTenant);
router.get('/tenants/invites', requirePlatformAdminPermission('tenants.create'), getTenantInvites);
router.delete('/tenants/invites/:id', requirePlatformAdminPermission('tenants.create'), revokeTenantInvite);

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
router.get('/tenants/:id/vendors', requirePlatformAdminPermission('expenses.manage'), getTenantVendors);
router.get('/tenants/:id/jobs', requirePlatformAdminPermission('expenses.manage'), getTenantJobs);
router.get('/tenants/:id', requirePlatformAdminPermission('tenants.view'), getTenantById);
router.get('/tenants/:id/access-audit', requirePlatformAdminPermission('tenants.view'), getTenantAccessAudit);

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
router.patch('/tenants/:id/status', requirePlatformAdminPermission('tenants.manage_status'), updateTenantStatus);
router.patch('/tenants/:id/access', requirePlatformAdminPermission('tenants.update'), updateTenantAccess);

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
router.get('/billing/summary', requirePlatformAdminPermission('billing.view'), getBillingSummary);

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
router.get('/billing/tenants', requirePlatformAdminPermission('billing.view'), getBillingTenants);

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
router.get('/health', requirePlatformAdminPermission('health.view'), getSystemHealth);

/**
 * Platform-wide report endpoints (aggregate across all tenants)
 */
router.get('/reports/kpi-summary', requirePlatformAdminPermission('reports.view'), getAdminKpiSummary);
router.get('/reports/revenue', requirePlatformAdminPermission('reports.view'), getAdminRevenueReport);
router.get('/reports/expenses', requirePlatformAdminPermission('reports.view'), getAdminExpenseReport);
router.get('/reports/pipeline-summary', requirePlatformAdminPermission('reports.view'), getAdminPipelineSummary);
router.get('/reports/top-customers', requirePlatformAdminPermission('reports.view'), getAdminTopCustomers);

/**
 * Admin Leads routes (for tracking potential customers/businesses)
 */
router.get('/leads', getAdminLeads);
router.get('/leads/stats', getAdminLeadStats);
router.get('/leads/:id', getAdminLead);
router.post('/leads', createAdminLead);
router.put('/leads/:id', updateAdminLead);
router.delete('/leads/:id', deleteAdminLead);
router.post('/leads/:id/activities', addAdminLeadActivity);
router.post('/leads/:id/convert-to-job', convertAdminLeadToJob);

/**
 * Admin Jobs routes (for tracking software projects)
 */
router.get('/jobs', getAdminJobs);
router.get('/jobs/stats', getAdminJobStats);
router.get('/jobs/:id', getAdminJob);
router.post('/jobs', createAdminJob);
router.put('/jobs/:id', updateAdminJob);
router.patch('/jobs/:id/assign', assignAdminJob);
router.delete('/jobs/:id', deleteAdminJob);

/**
 * Admin Expenses routes (platform-wide expense tracking)
 */
router.get('/expenses/categories', requirePlatformAdminPermission('expenses.view'), getAdminExpenseCategories);
router.get('/expenses', requirePlatformAdminPermission('expenses.view'), getAdminExpenses);
router.post('/expenses', requirePlatformAdminPermission('expenses.manage'), createAdminExpense);
router.get('/expenses/stats', requirePlatformAdminPermission('expenses.view'), getAdminExpenseStats);
router.get('/expenses/:id', requirePlatformAdminPermission('expenses.view'), getAdminExpense);

/**
 * Admin Customers routes (platform's own customers, e.g. for jobs like website design)
 */
router.get('/customers', requirePlatformAdminPermission('tenants.view'), getAdminCustomers);
router.post('/customers', requirePlatformAdminPermission('tenants.view'), createAdminCustomer);
router.get('/customers/:id', requirePlatformAdminPermission('tenants.view'), getAdminCustomer);
router.put('/customers/:id', requirePlatformAdminPermission('tenants.view'), updateAdminCustomer);
router.delete('/customers/:id', requirePlatformAdminPermission('tenants.view'), deleteAdminCustomer);

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
router.patch('/tenants/:id/branding', requirePlatformAdminPermission('tenants.update'), updateTenantBranding);

module.exports = router;

