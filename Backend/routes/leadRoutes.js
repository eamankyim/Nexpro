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
  convertLead
} = require('../controllers/leadController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

const router = express.Router();

router.use(protect);
router.use(tenantContext);

router.get('/summary', getLeadSummary);

router
  .route('/')
  .get(getLeads)
  .post(authorize('admin', 'manager', 'staff'), createLead);

router
  .route('/:id')
  .get(getLead)
  .put(authorize('admin', 'manager', 'staff'), updateLead)
  .delete(authorize('admin', 'manager'), deleteLead);

router.post('/:id/convert', authorize('admin', 'manager', 'staff'), convertLead);

router
  .route('/:id/activities')
  .get(getLeadActivities)
  .post(authorize('admin', 'manager', 'staff'), addLeadActivity);

module.exports = router;




