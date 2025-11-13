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
  markInvoicePaid
} = require('../controllers/invoiceController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

const router = express.Router();

router.use(protect);
router.use(tenantContext);

router.get('/stats/summary', getInvoiceStats);

router.route('/')
  .get(getInvoices)
  .post(authorize('admin', 'manager', 'staff'), createInvoice);

router.route('/:id')
  .get(getInvoice)
  .put(authorize('admin', 'manager', 'staff'), updateInvoice)
  .delete(authorize('admin', 'manager', 'staff'), deleteInvoice);

router.post('/:id/payment', authorize('admin', 'manager', 'staff'), recordPayment);
router.post('/:id/send', authorize('admin', 'manager', 'staff'), sendInvoice);
router.post('/:id/cancel', authorize('admin', 'manager', 'staff'), cancelInvoice);
router.post('/:id/mark-paid', authorize('admin', 'manager', 'staff'), markInvoicePaid);

module.exports = router;







