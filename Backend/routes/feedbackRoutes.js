const express = require('express');
const { listTenantFeedback } = require('../controllers/feedbackController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { studioLocationContext } = require('../middleware/studioLocationContext');

const router = express.Router();

router.use(protect);
router.use(tenantContext);
router.use(studioLocationContext);

router.get('/', authorize('admin', 'manager', 'staff'), listTenantFeedback);

module.exports = router;
