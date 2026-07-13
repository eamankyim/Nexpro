const express = require('express');
const { getMerchandiseSummary } = require('../controllers/merchandiseController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { shopContext } = require('../middleware/shopContext');

const router = express.Router();

router.use(protect);
router.use(tenantContext);
router.use(shopContext);

// Merchandise is a read-only overview for owners/admins/managers only — staff must not
// see cost/selling value rollups (same rule as Products sensitive fields).
router.route('/summary').get(authorize('admin', 'manager'), getMerchandiseSummary);

module.exports = router;
