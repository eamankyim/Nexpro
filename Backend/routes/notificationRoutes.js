const express = require('express');
const { protect } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { cacheMiddleware, generateNotificationSummaryKey, generateNotificationListKey } = require('../middleware/cache');
const {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getNotificationSummary
} = require('../controllers/notificationController');

const router = express.Router();

router.use(protect);
router.use(tenantContext);

// Cache summary for 60s to reduce repeated DB hits (same user/tenant)
router.get('/summary', cacheMiddleware(60, generateNotificationSummaryKey), getNotificationSummary);
router.post('/mark-all-read', markAllNotificationsRead);
router.put('/:id/read', markNotificationRead);
router.get('/', cacheMiddleware(60, generateNotificationListKey), getNotifications);

module.exports = router;





