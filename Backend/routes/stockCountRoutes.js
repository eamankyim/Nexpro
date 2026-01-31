const express = require('express');
const {
  getStockCounts,
  getStockCount,
  createStockCount,
  updateCountItem,
  completeStockCount,
  approveStockCount,
  getReconciliationReport,
  deleteStockCount
} = require('../controllers/stockCountController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

const router = express.Router();

router.use(protect);
router.use(tenantContext);

// Report route (before :id routes)
router.get('/reconciliation-report', getReconciliationReport);

// Standard routes
router.route('/')
  .get(getStockCounts)
  .post(authorize('admin', 'manager'), createStockCount);

router.route('/:id')
  .get(getStockCount)
  .delete(authorize('admin'), deleteStockCount);

router.route('/:id/items/:itemId')
  .put(authorize('admin', 'manager', 'staff'), updateCountItem);

router.route('/:id/complete')
  .post(authorize('admin', 'manager'), completeStockCount);

router.route('/:id/approve')
  .post(authorize('admin'), approveStockCount);

module.exports = router;
