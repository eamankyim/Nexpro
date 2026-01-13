const express = require('express');
const router = express.Router();
const { handleSabitoCustomerWebhook } = require('../controllers/webhookController');

// Sabito webhook endpoint (no auth middleware - uses API key authentication)
router.post('/sabito/customer', handleSabitoCustomerWebhook);

module.exports = router;






