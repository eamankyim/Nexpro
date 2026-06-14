const express = require('express');
const { protect } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { shopContext } = require('../middleware/shopContext');
const {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getNotificationSummary,
  registerPushToken
} = require('../controllers/notificationController');

const router = express.Router();

router.use(protect);
router.use(tenantContext);
router.use(shopContext);

// Cache summary for 60s to reduce repeated DB hits (same user/tenant)
router.get('/summary', getNotificationSummary);
router.post('/push/register', registerPushToken);
router.post('/mark-all-read', markAllNotificationsRead);
router.put('/:id/read', markNotificationRead);
router.get('/', getNotifications);

module.exports = router;





