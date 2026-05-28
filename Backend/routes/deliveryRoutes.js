const express = require('express');
const { getDeliveryQueue, patchDeliveryStatuses } = require('../controllers/deliveryController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { studioLocationContext } = require('../middleware/studioLocationContext');
const { shopContext } = require('../middleware/shopContext');
const { requireFeature } = require('../middleware/featureAccess');

const router = express.Router();

router.use(protect);
router.use(tenantContext);
router.use(studioLocationContext);
router.use(shopContext);
router.use(requireFeature('deliveries'));

router.get('/queue', authorize('admin', 'manager', 'staff', 'driver'), getDeliveryQueue);
router.patch('/status', authorize('admin', 'manager', 'staff', 'driver'), patchDeliveryStatuses);

module.exports = router;
