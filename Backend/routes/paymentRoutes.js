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
const { tenantContext } = require('../middleware/tenant');

const router = express.Router();

router.use(protect);
router.use(tenantContext);

router.get('/stats/overview', getPaymentStats);

router.route('/')
  .get(getPayments)
  .post(authorize('admin', 'manager', 'staff'), createPayment);

router.route('/:id')
  .get(getPayment)
  .put(authorize('admin', 'manager', 'staff'), updatePayment)
  .delete(authorize('admin', 'manager', 'staff'), deletePayment);

module.exports = router;


