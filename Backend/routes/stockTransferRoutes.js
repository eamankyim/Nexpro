const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { shopContext } = require('../middleware/shopContext');
const {
  getStockTransfers,
  createStockTransfer,
  createBulkStockTransfer,
} = require('../controllers/stockTransferController');

const router = express.Router();

router.use(protect);
router.use(tenantContext);
router.use(shopContext);

router.route('/')
  .get(getStockTransfers)
  .post(authorize('admin', 'manager', 'staff'), createStockTransfer);

router.route('/bulk')
  .post(authorize('admin', 'manager', 'staff'), createBulkStockTransfer);

module.exports = router;
