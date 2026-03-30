const express = require('express');
const {
  getInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  recordPayment,
  sendInvoice,
  cancelInvoice,
  getInvoiceStats,
  markInvoicePaid,
  exportInvoices
} = require('../controllers/invoiceController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { cacheMiddleware, generateInvoiceListKey } = require('../middleware/cache');
const { exportLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.use(protect);
router.use(tenantContext);

router.get('/stats/summary', getInvoiceStats);

router.route('/')
  .get(cacheMiddleware(60, generateInvoiceListKey), getInvoices)
  .post(authorize('admin', 'manager', 'staff'), createInvoice);

router.get('/export', exportLimiter, authorize('admin', 'manager'), exportInvoices);

router.route('/:id')
  .get(getInvoice)
  .put(authorize('admin', 'manager', 'staff'), updateInvoice)
  .delete(authorize('admin', 'manager', 'staff'), deleteInvoice);

router.post('/:id/payment', authorize('admin', 'manager', 'staff'), recordPayment);
router.post('/:id/send', authorize('admin', 'manager', 'staff'), sendInvoice);
router.post('/:id/cancel', authorize('admin', 'manager', 'staff'), cancelInvoice);
router.post('/:id/mark-paid', authorize('admin', 'manager', 'staff'), markInvoicePaid);

module.exports = router;







