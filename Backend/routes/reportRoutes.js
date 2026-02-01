const express = require('express');
const {
  getRevenueReport,
  getExpenseReport,
  getOutstandingPaymentsReport,
  getSalesReport,
  getProfitLossReport,
  getKpiSummary,
  getTopCustomers,
  getPipelineSummary,
  getServiceAnalyticsReport,
  getProductSalesReport,
  getPrescriptionReport,
  getInventorySummary,
  getInventoryMovements,
  getFastestMovingItems,
  getRevenueByChannel,
  generateAIAnalysis,
  getOverviewPhase1,
  getOverviewPhase2
} = require('../controllers/reportController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { cacheMiddleware, generateReportCacheKey } = require('../middleware/cache');

const router = express.Router();

router.use(protect);
router.use(tenantContext);
router.use(authorize('admin', 'manager'));

// Cache report endpoints for 5 minutes (300 seconds)
const reportCache = cacheMiddleware(300, (req) => {
  return generateReportCacheKey(req.tenantId, req.path.replace('/api/reports/', ''), req.query);
});

// Batched overview (fewer round trips for Reports page)
router.get('/overview/phase1', reportCache, getOverviewPhase1);
router.get('/overview/phase2', reportCache, getOverviewPhase2);

router.get('/revenue', reportCache, getRevenueReport);
router.get('/expenses', reportCache, getExpenseReport);
router.get('/outstanding-payments', reportCache, getOutstandingPaymentsReport);
router.get('/sales', reportCache, getSalesReport);
router.get('/profit-loss', reportCache, getProfitLossReport);
router.get('/kpi-summary', reportCache, getKpiSummary);
router.get('/top-customers', reportCache, getTopCustomers);
router.get('/pipeline-summary', reportCache, getPipelineSummary);
router.get('/service-analytics', reportCache, getServiceAnalyticsReport);
router.get('/product-sales', reportCache, getProductSalesReport);
router.get('/prescription-report', reportCache, getPrescriptionReport);
router.get('/inventory-summary', reportCache, getInventorySummary);
router.get('/inventory-movements', reportCache, getInventoryMovements);
router.get('/fastest-moving-items', reportCache, getFastestMovingItems);
router.get('/revenue-by-channel', reportCache, getRevenueByChannel);
router.post('/ai-analysis', generateAIAnalysis); // No cache for POST requests

module.exports = router;

