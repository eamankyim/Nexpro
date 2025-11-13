const express = require('express');
const {
  getRevenueReport,
  getExpenseReport,
  getOutstandingPaymentsReport,
  getSalesReport,
  getProfitLossReport,
  getKpiSummary,
  getTopCustomers,
  getPipelineSummary
} = require('../controllers/reportController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

const router = express.Router();

router.use(protect);
router.use(tenantContext);
router.use(authorize('admin'));

router.get('/revenue', getRevenueReport);
router.get('/expenses', getExpenseReport);
router.get('/outstanding-payments', getOutstandingPaymentsReport);
router.get('/sales', getSalesReport);
router.get('/profit-loss', getProfitLossReport);
router.get('/kpi-summary', getKpiSummary);
router.get('/top-customers', getTopCustomers);
router.get('/pipeline-summary', getPipelineSummary);

module.exports = router;

