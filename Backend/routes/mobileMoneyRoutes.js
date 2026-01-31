const express = require('express');
const {
  initiatePayment,
  checkPaymentStatus,
  pollSalePayment,
  validatePhoneNumber,
  detectProvider
} = require('../controllers/mobileMoneyController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

const router = express.Router();

router.use(protect);
router.use(tenantContext);

// Initiate payment
router.post('/pay', authorize('admin', 'manager', 'staff'), initiatePayment);

// Check payment status
router.get('/status/:referenceId', checkPaymentStatus);

// Poll sale payment status
router.post('/poll/:saleId', authorize('admin', 'manager', 'staff'), pollSalePayment);

// Validate phone number
router.get('/validate/:phoneNumber', validatePhoneNumber);

// Detect provider from phone number
router.get('/detect-provider/:phoneNumber', detectProvider);

module.exports = router;
