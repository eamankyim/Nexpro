const express = require('express');
const { chat } = require('../controllers/assistantController');
const { protect } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { shopContext } = require('../middleware/shopContext');
const { studioLocationContext } = require('../middleware/studioLocationContext');
const { authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.use(tenantContext);
router.use(shopContext);
router.use(studioLocationContext);
// Chat + analysis routing: tenant-scoped reads / drafts; no privileged writes
router.use(authorize('admin', 'manager', 'staff'));

router.post('/chat', chat);

module.exports = router;
