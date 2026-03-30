const express = require('express');
const router = express.Router();
const {
  initializeSubscriptionPayment,
  verifySubscriptionPayment
} = require('../controllers/subscriptionController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

router.use(protect);
router.use(tenantContext);

router.post('/initialize', authorize('admin', 'manager'), initializeSubscriptionPayment);
router.get('/verify/:reference', authorize('admin', 'manager'), verifySubscriptionPayment);

module.exports = router;
