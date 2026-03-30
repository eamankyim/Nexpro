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
const { cacheMiddleware, generateSaleListKey } = require('../middleware/cache');
const { exportLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.use(protect);
router.use(tenantContext);

router.route('/')
  .get(cacheMiddleware(60, generateSaleListKey), getSales)
  .post(authorize('admin', 'manager', 'staff'), createSale);

router.get('/export', exportLimiter, authorize('admin', 'manager'), exportSales);

router.route('/sync')
  .post(authorize('admin', 'manager', 'staff'), batchSyncSales);

router.route('/:id')
  .get(getSale)
  .put(authorize('admin', 'manager', 'staff'), updateSale)
  .delete(authorize('admin'), deleteSale);

router.route('/:id/order-status')
  .patch(authorize('admin', 'manager', 'staff'), updateOrderStatus);

router.route('/:id/delivery-status')
  .patch(authorize('admin', 'manager', 'staff'), updateDeliveryStatus);

router.route('/:id/cancel')
  .post(authorize('admin', 'manager', 'staff'), cancelSale);

router.route('/:id/payment')
  .post(authorize('admin', 'manager', 'staff'), recordPayment);

router.route('/:id/generate-invoice')
  .post(authorize('admin', 'manager', 'staff'), generateInvoice);

router.route('/:id/receipt')
  .get(authorize('admin', 'manager', 'staff'), printReceipt);

router.route('/:id/send-receipt')
  .post(authorize('admin', 'manager', 'staff'), sendReceipt);

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
