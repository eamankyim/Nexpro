const express = require('express');
const {
  getPayments,
  getPayment,
  createPayment,
  updatePayment,
  deletePayment,
  getPaymentStats
} = require('../controllers/paymentController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/stats/overview', getPaymentStats);

router.route('/')
  .get(getPayments)
  .post(authorize('admin', 'manager'), createPayment);

router.route('/:id')
  .get(getPayment)
  .put(authorize('admin', 'manager'), updatePayment)
  .delete(authorize('admin'), deletePayment);

module.exports = router;


