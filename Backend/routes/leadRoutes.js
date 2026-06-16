const express = require('express');
const {
  getLeads,
  getLead,
  createLead,
  updateLead,
  deleteLead,
  addLeadActivity,
  getLeadActivities,
  getLeadSummary,
  convertLead,
  exportLeads
} = require('../controllers/leadController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { exportLimiter } = require('../middleware/rateLimiter');
const { timeCrudAction } = require('../middleware/crudTiming');

const { studioLocationContext } = require('../middleware/studioLocationContext');
const { shopContext } = require('../middleware/shopContext');

const router = express.Router();

router.use(protect);
router.use(tenantContext);
router.use(studioLocationContext);
router.use(shopContext);

router.get('/summary', getLeadSummary);
router.get('/export', exportLimiter, authorize('admin', 'manager'), exportLeads);

router
  .route('/')
  .get(timeCrudAction('leads.list'), getLeads)
  .post(authorize('admin', 'manager', 'staff'), timeCrudAction('leads.create'), createLead);

router
  .route('/:id')
  .get(timeCrudAction('leads.read'), getLead)
  .put(authorize('admin', 'manager', 'staff'), timeCrudAction('leads.update'), updateLead)
  .delete(authorize('admin', 'manager'), timeCrudAction('leads.delete'), deleteLead);

router.post('/:id/convert', authorize('admin', 'manager', 'staff'), timeCrudAction('leads.convert'), convertLead);

router
  .route('/:id/activities')
  .get(getLeadActivities)
  .post(authorize('admin', 'manager', 'staff'), addLeadActivity);

module.exports = router;




