const express = require('express');
const { getCapabilities, getPreview, postBroadcast } = require('../controllers/marketingController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { bulkOperationLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.use(protect);
router.use(tenantContext);

/**
 * @openapi
 * /api/marketing/capabilities:
 *   get:
 *     summary: Marketing channel availability (email, SMS, WhatsApp)
 *     tags: [Marketing]
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Per-channel configured flag
 */
router.get('/capabilities', authorize('admin', 'manager'), getCapabilities);

/**
 * @openapi
 * /api/marketing/preview:
 *   get:
 *     summary: Recipient counts for customer broadcast
 *     tags: [Marketing]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: activeOnly
 *         schema: { type: string, enum: ['true', 'false'] }
 *     responses:
 *       200:
 *         description: Counts and capabilities
 */
router.get('/preview', authorize('admin', 'manager'), getPreview);

/**
 * @openapi
 * /api/marketing/broadcast:
 *   post:
 *     summary: Send bulk message to customers
 *     tags: [Marketing]
 *     security: [{ BearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               channels: { type: array, items: { type: string } }
 *               dryRun: { type: boolean }
 *               activeOnly: { type: boolean }
 *               customerIds: { type: array, items: { type: string, format: uuid }, description: 'Optional; omit to use full batch. If set, only these customer IDs (must be in the preview list).' }
 *     responses:
 *       200:
 *         description: Send results per channel
 */
router.post('/broadcast', bulkOperationLimiter, authorize('admin', 'manager'), postBroadcast);

module.exports = router;
