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
  getInvoiceStats
} = require('../controllers/invoiceController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/stats/summary', getInvoiceStats);

router.route('/')
  .get(getInvoices)
  .post(authorize('admin', 'manager'), createInvoice);

router.route('/:id')
  .get(getInvoice)
  .put(authorize('admin', 'manager'), updateInvoice)
  .delete(authorize('admin'), deleteInvoice);

router.post('/:id/payment', authorize('admin', 'manager'), recordPayment);
router.post('/:id/send', authorize('admin', 'manager'), sendInvoice);
router.post('/:id/cancel', authorize('admin', 'manager'), cancelInvoice);

module.exports = router;







