const express = require('express');
const { getPublicPlans } = require('../controllers/publicPricingController');
const { getInvoiceByToken, processPublicPayment } = require('../controllers/invoiceController');

const router = express.Router();

router.get('/pricing', getPublicPlans);

// Public invoice routes (no authentication required)
router.get('/invoices/:token', getInvoiceByToken);
router.post('/invoices/:token/pay', processPublicPayment);

module.exports = router;

