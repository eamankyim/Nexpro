const express = require('express');
const { chat } = require('../controllers/assistantController');
const { protect } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.use(tenantContext);
router.use(authorize('admin', 'manager'));

router.post('/chat', chat);

module.exports = router;
