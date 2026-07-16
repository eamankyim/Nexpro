const express = require('express');
const { ask, listIntents, classify } = require('../controllers/analysisController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { shopContext } = require('../middleware/shopContext');
const { studioLocationContext } = require('../middleware/studioLocationContext');

const router = express.Router();

router.use(protect);
router.use(tenantContext);
router.use(shopContext);
router.use(studioLocationContext);
router.use(authorize('admin', 'manager'));

router.post('/ask', ask);
router.get('/intents', listIntents);
router.post('/classify', classify);

module.exports = router;
