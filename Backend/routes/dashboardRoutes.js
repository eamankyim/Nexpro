const express = require('express');
const {
  getDashboardOverview,
  getRevenueByMonth,
  getExpensesByCategory,
  getTopCustomers,
  getJobStatusDistribution
} = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { shopContext } = require('../middleware/shopContext');
const { studioLocationContext } = require('../middleware/studioLocationContext');
const { cacheMiddleware, generateCacheKey, getShopCacheSegment } = require('../middleware/cache');

const router = express.Router();

router.use(protect);
router.use(tenantContext);
router.use(studioLocationContext);
router.use(shopContext);

const getStudioLocationCacheSegment = (req) => {
  if (!req?.studioLocationScoped) return '';
  if (req.studioLocationFilterId) return `:studio:${req.studioLocationFilterId}`;
  if (req.canAccessAllStudioLocations) return ':studio:all';
  return ':studio:assigned';
};

// Cache dashboard endpoints for 2 minutes (120 seconds)
const dashboardCache = cacheMiddleware(120, (req) => {
  const scopeSegment = `${getShopCacheSegment(req)}${getStudioLocationCacheSegment(req)}`;
  return generateCacheKey(req.tenantId, req.path, req.query, scopeSegment);
});

router.get('/overview', dashboardCache, getDashboardOverview);
router.get('/revenue-by-month', dashboardCache, getRevenueByMonth);
router.get('/expenses-by-category', dashboardCache, getExpensesByCategory);
router.get('/top-customers', dashboardCache, getTopCustomers);
router.get('/job-status-distribution', dashboardCache, getJobStatusDistribution);

module.exports = router;


