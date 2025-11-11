const express = require('express');
const { protect } = require('../middleware/auth');
const {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getNotificationSummary
} = require('../controllers/notificationController');

const router = express.Router();

router.use(protect);

router.get('/summary', getNotificationSummary);
router.post('/mark-all-read', markAllNotificationsRead);
router.put('/:id/read', markNotificationRead);
router.get('/', getNotifications);

module.exports = router;





