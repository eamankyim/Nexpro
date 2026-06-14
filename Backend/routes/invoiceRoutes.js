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
  cancelInvoice,
  getInvoiceStats,
  markInvoicePaid,
  exportInvoices
} = require('../controllers/invoiceController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { shopContext } = require('../middleware/shopContext');
const { studioLocationContext } = require('../middleware/studioLocationContext');
const { exportLimiter } = require('../middleware/rateLimiter');

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
  .get(getInvoices)
  .post(authorize('admin', 'manager', 'staff'), createInvoice);

router.get('/export', exportLimiter, authorize('admin', 'manager'), exportInvoices);

router.delete('/:id/cancelled', authorize('admin'), deleteCancelledInvoice);

router.route('/:id')
  .get(getInvoice)
  .put(authorize('admin', 'manager', 'staff'), updateInvoice)
  .delete(authorize('admin'), deleteInvoice);

router.post('/:id/payment', authorize('admin', 'manager', 'staff'), recordPayment);
router.post('/:id/send', authorize('admin', 'manager', 'staff'), sendInvoice);
router.post('/:id/cancel', authorize('admin', 'manager'), cancelInvoice);
router.post('/:id/mark-paid', authorize('admin', 'manager', 'staff'), markInvoicePaid);

module.exports = router;







