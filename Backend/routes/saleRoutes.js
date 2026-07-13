const express = require('express');
const {
  getSales,
  getSale,
  createSale,
  batchSyncSales,
  updateSale,
  deleteSale,
  cancelSale,
  recordPayment,
  generateInvoice,
  printReceipt,
  sendReceipt,
  addSaleActivity,
  getSaleActivities,
  updateOrderStatus,
  updateDeliveryStatus,
  initializePaystackForSale,
  paystackMobileMoneyForSale,
  checkPaystackChargeForSale,
  exportSales
} = require('../controllers/saleController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { shopContext } = require('../middleware/shopContext');
const { exportLimiter } = require('../middleware/rateLimiter');
const { timeCrudAction } = require('../middleware/crudTiming');

const router = express.Router();

router.use(protect);
router.use(tenantContext);
router.use(shopContext);
router.use((req, res, next) => {
  // Sale totals/cards must reflect POS writes immediately; avoid stale browser/backend list cache.
  res.set('Cache-Control', 'no-store');
  next();
});

router.route('/')
  .get(timeCrudAction('sales.list'), getSales)
  .post(authorize('admin', 'manager', 'staff'), timeCrudAction('sales.create'), createSale);

router.get('/export', exportLimiter, authorize('admin', 'manager'), exportSales);

router.route('/sync')
  .post(authorize('admin', 'manager', 'staff'), timeCrudAction('sales.batch_sync'), batchSyncSales);

router.route('/:id')
  .get(timeCrudAction('sales.read'), getSale)
  .put(authorize('admin', 'manager', 'staff'), timeCrudAction('sales.update'), updateSale)
  .delete(authorize('admin', 'manager', 'staff'), timeCrudAction('sales.delete'), deleteSale);

router.route('/:id/order-status')
  .patch(authorize('admin', 'manager', 'staff'), timeCrudAction('sales.update_order_status'), updateOrderStatus);

router.route('/:id/delivery-status')
  .patch(authorize('admin', 'manager', 'staff'), timeCrudAction('sales.update_delivery_status'), updateDeliveryStatus);

router.route('/:id/cancel')
  .post(authorize('admin', 'manager', 'staff'), timeCrudAction('sales.cancel'), cancelSale);

router.route('/:id/payment')
  .post(authorize('admin', 'manager', 'staff'), timeCrudAction('sales.record_payment'), recordPayment);

router.route('/:id/generate-invoice')
  .post(authorize('admin', 'manager', 'staff'), timeCrudAction('sales.generate_invoice'), generateInvoice);

router.route('/:id/receipt')
  .get(authorize('admin', 'manager', 'staff'), printReceipt);

router.route('/:id/send-receipt')
  .post(authorize('admin', 'manager', 'staff'), timeCrudAction('sales.send_receipt'), sendReceipt);

router.route('/:id/initialize-paystack')
  .post(authorize('admin', 'manager', 'staff'), initializePaystackForSale);

router.route('/:id/paystack-mobile-money')
  .post(authorize('admin', 'manager', 'staff'), paystackMobileMoneyForSale);

router.route('/:id/check-paystack-charge')
  .get(authorize('admin', 'manager', 'staff'), checkPaystackChargeForSale);

router.route('/:id/activities')
  .get(getSaleActivities)
  .post(authorize('admin', 'manager', 'staff'), addSaleActivity);

module.exports = router;
