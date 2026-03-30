const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const {
  getTemplates,
  listRules,
  createRule,
  updateRule,
  toggleRule,
  listRuns,
  testRule
} = require('../controllers/automationController');

const router = express.Router();

router.use(protect);
router.use(tenantContext);
router.use(authorize('admin', 'manager'));

router.get('/templates', getTemplates);
router.get('/rules', listRules);
router.post('/rules', createRule);
router.patch('/rules/:id', updateRule);
router.post('/rules/:id/toggle', toggleRule);
router.post('/rules/:id/test', testRule);
router.get('/runs', listRuns);

module.exports = router;
