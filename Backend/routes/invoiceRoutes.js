const express = require('express');
const {
  getInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  deleteCancelledInvoice,
  recordPayment,
  sendInvoice,
  ensureInvoicePaymentLink,
  cancelInvoice,
  getInvoiceStats,
  markInvoicePaid,
  exportInvoices,
  verifyPaystackChargeForInvoice,
  paystackMobileMoneyForInvoice
} = require('../controllers/invoiceController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { shopContext } = require('../middleware/shopContext');
const { studioLocationContext } = require('../middleware/studioLocationContext');
const { exportLimiter } = require('../middleware/rateLimiter');
const { timeCrudAction } = require('../middleware/crudTiming');

const router = express.Router();

router.use(protect);
router.use(tenantContext);
router.use(shopContext);
router.use(studioLocationContext);
router.use((req, res, next) => {
  // Invoice lists must reflect POS/sale writes immediately; avoid Express 304 + stale list cache.
  res.set('Cache-Control', 'no-store');
  delete req.headers['if-none-match'];
  delete req.headers['if-modified-since'];
  next();
});

router.get('/stats/summary', getInvoiceStats);

router.route('/')
  .get(timeCrudAction('invoices.list'), getInvoices)
  .post(authorize('admin', 'manager', 'staff'), timeCrudAction('invoices.create'), createInvoice);

router.get('/export', exportLimiter, authorize('admin', 'manager'), exportInvoices);

router.delete('/:id/cancelled', authorize('admin'), timeCrudAction('invoices.delete_cancelled'), deleteCancelledInvoice);

router.route('/:id')
  .get(timeCrudAction('invoices.read'), getInvoice)
  .put(authorize('admin', 'manager', 'staff'), timeCrudAction('invoices.update'), updateInvoice)
  .delete(authorize('admin'), timeCrudAction('invoices.delete'), deleteInvoice);

router.post('/:id/payment', authorize('admin', 'manager', 'staff'), timeCrudAction('invoices.record_payment'), recordPayment);
router.post('/:id/payment-link', authorize('admin', 'manager', 'staff'), timeCrudAction('invoices.payment_link'), ensureInvoicePaymentLink);
router.post('/:id/send', authorize('admin', 'manager', 'staff'), timeCrudAction('invoices.send'), sendInvoice);
router.post('/:id/cancel', authorize('admin', 'manager'), timeCrudAction('invoices.cancel'), cancelInvoice);
router.post('/:id/mark-paid', authorize('admin', 'manager', 'staff'), timeCrudAction('invoices.mark_paid'), markInvoicePaid);
router.post('/:id/verify-paystack', authorize('admin', 'manager', 'staff'), timeCrudAction('invoices.verify_paystack'), verifyPaystackChargeForInvoice);
router.post('/:id/paystack-mobile-money', authorize('admin', 'manager', 'staff'), timeCrudAction('invoices.paystack_mobile_money'), paystackMobileMoneyForInvoice);

module.exports = router;







