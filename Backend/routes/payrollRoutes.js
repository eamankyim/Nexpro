const express = require('express');
const {
  getPayrollRuns,
  getPayrollRun,
  createPayrollRun,
  postPayrollRun
} = require('../controllers/payrollController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

const router = express.Router();

router.use(protect);
router.use(tenantContext);

router
  .route('/runs')
  .get(getPayrollRuns)
  .post(authorize('admin', 'manager'), createPayrollRun);

router
  .route('/runs/:id')
  .get(getPayrollRun);

router.post('/runs/:id/post', authorize('admin', 'manager'), postPayrollRun);

module.exports = router;



