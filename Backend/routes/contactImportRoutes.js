const express = require('express');
const { importContactsFromJson } = require('../controllers/contactImportController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { studioLocationContext } = require('../middleware/studioLocationContext');
const { shopContext } = require('../middleware/shopContext');
const { bulkOperationLimiter } = require('../middleware/rateLimiter');
const { timeCrudAction } = require('../middleware/crudTiming');

const router = express.Router();

router.use(protect);
router.use(tenantContext);
router.use(studioLocationContext);
router.use(shopContext);

router.post(
  '/import',
  bulkOperationLimiter,
  authorize('admin', 'manager', 'staff'),
  timeCrudAction('contacts.import'),
  importContactsFromJson
);

module.exports = router;
