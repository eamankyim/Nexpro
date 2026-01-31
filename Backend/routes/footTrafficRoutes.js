const express = require('express');
const {
  getFootTraffic,
  getTrafficAnalytics,
  getFootTrafficById,
  createFootTraffic,
  bulkCreateFootTraffic,
  updateFootTraffic,
  deleteFootTraffic,
  recordCheckIn,
  getTodaySummary
} = require('../controllers/footTrafficController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

const router = express.Router();

router.use(protect);
router.use(tenantContext);

// Analytics and summary routes (must be before /:id to avoid conflict)
router.get('/analytics', getTrafficAnalytics);
router.get('/today', getTodaySummary);

// Check-in endpoint (for customer/staff check-in)
router.post('/checkin', recordCheckIn);

// Bulk create (for IoT devices)
router.post('/bulk', authorize('admin', 'manager'), bulkCreateFootTraffic);

// Standard CRUD routes
router.route('/')
  .get(getFootTraffic)
  .post(authorize('admin', 'manager', 'staff'), createFootTraffic);

router.route('/:id')
  .get(getFootTrafficById)
  .put(authorize('admin', 'manager'), updateFootTraffic)
  .delete(authorize('admin'), deleteFootTraffic);

module.exports = router;
