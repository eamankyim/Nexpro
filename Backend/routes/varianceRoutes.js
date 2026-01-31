const express = require('express');
const {
  getStockVariance,
  getSuspiciousPatterns,
  getLeakageReport,
  runDetection,
  getDashboardSummary
} = require('../controllers/varianceController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

const router = express.Router();

router.use(protect);
router.use(tenantContext);

// Dashboard summary
router.get('/dashboard', getDashboardSummary);

// Stock variance report
router.get('/stock', getStockVariance);

// Suspicious patterns report
router.get('/patterns', getSuspiciousPatterns);

// Revenue leakage report
router.get('/leakage-report', authorize('admin', 'manager'), getLeakageReport);

// Run detection and create alerts
router.post('/detect', authorize('admin', 'manager'), runDetection);

module.exports = router;
