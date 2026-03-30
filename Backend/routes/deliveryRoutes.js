const express = require('express');
const { getDeliveryQueue, patchDeliveryStatuses } = require('../controllers/deliveryController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { requireFeature } = require('../middleware/featureAccess');

const router = express.Router();

router.use(protect);
router.use(tenantContext);
router.use(requireFeature('deliveries'));

router.get('/queue', authorize('admin', 'manager', 'staff'), getDeliveryQueue);
router.patch('/status', authorize('admin', 'manager', 'staff'), patchDeliveryStatuses);

module.exports = router;
