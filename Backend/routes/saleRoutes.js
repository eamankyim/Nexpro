const express = require('express');
const {
  getSales,
  getSale,
  createSale,
  updateSale,
  cancelSale,
  generateInvoice,
  printReceipt
} = require('../controllers/saleController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

const router = express.Router();

router.use(protect);
router.use(tenantContext);

router.route('/')
  .get(getSales)
  .post(authorize('admin', 'manager', 'staff'), createSale);

router.route('/:id')
  .get(getSale)
  .put(authorize('admin', 'manager', 'staff'), updateSale);

router.route('/:id/cancel')
  .post(authorize('admin', 'manager', 'staff'), cancelSale);

router.route('/:id/generate-invoice')
  .post(authorize('admin', 'manager', 'staff'), generateInvoice);

router.route('/:id/receipt')
  .get(authorize('admin', 'manager', 'staff'), printReceipt);

module.exports = router;
