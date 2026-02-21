const express = require('express');
const {
  getSales,
  getSale,
  createSale,
  updateSale,
  deleteSale,
  cancelSale,
  generateInvoice,
  printReceipt,
  sendReceipt,
  addSaleActivity,
  getSaleActivities,
  updateOrderStatus
} = require('../controllers/saleController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { cacheMiddleware, generateSaleListKey } = require('../middleware/cache');

const router = express.Router();

router.use(protect);
router.use(tenantContext);

router.route('/')
  .get(cacheMiddleware(60, generateSaleListKey), getSales)
  .post(authorize('admin', 'manager', 'staff'), createSale);

router.route('/:id')
  .get(getSale)
  .put(authorize('admin', 'manager', 'staff'), updateSale)
  .delete(authorize('admin'), deleteSale);

router.route('/:id/order-status')
  .patch(authorize('admin', 'manager', 'staff'), updateOrderStatus);

router.route('/:id/cancel')
  .post(authorize('admin', 'manager', 'staff'), cancelSale);

router.route('/:id/generate-invoice')
  .post(authorize('admin', 'manager', 'staff'), generateInvoice);

router.route('/:id/receipt')
  .get(authorize('admin', 'manager', 'staff'), printReceipt);

router.route('/:id/send-receipt')
  .post(authorize('admin', 'manager', 'staff'), sendReceipt);

router.route('/:id/activities')
  .get(getSaleActivities)
  .post(authorize('admin', 'manager', 'staff'), addSaleActivity);

module.exports = router;
