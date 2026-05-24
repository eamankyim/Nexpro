const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const {
  getTemplates,
  listRules,
  createRule,
  updateRule,
  toggleRule,
  deleteRule,
  getOverview,
  listRuns,
  listLogs,
  testRule,
  draftRule,
  getSuggestions,
  listWhatsAppEvents
} = require('../controllers/automationController');

const router = express.Router();

router.use(protect);
router.use(tenantContext);
router.use(authorize('admin', 'manager'));

router.get('/templates', getTemplates);
router.post('/draft', draftRule);
router.get('/suggestions', getSuggestions);
router.get('/overview', getOverview);
router.get('/logs', listLogs);
router.get('/rules', listRules);
router.post('/rules', createRule);
router.patch('/rules/:id', updateRule);
router.delete('/rules/:id', deleteRule);
router.post('/rules/:id/toggle', toggleRule);
router.post('/rules/:id/test', testRule);
router.get('/runs', listRuns);
router.get('/whatsapp-events', listWhatsAppEvents);

module.exports = router;
