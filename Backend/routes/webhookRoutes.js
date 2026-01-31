const express = require('express');
const router = express.Router();
const { handleSabitoCustomerWebhook, handleWhatsAppWebhook } = require('../controllers/webhookController');
const { mtnWebhook, airtelWebhook } = require('../controllers/mobileMoneyController');

// Sabito webhook endpoint (no auth middleware - uses API key authentication)
router.post('/sabito/customer', handleSabitoCustomerWebhook);

// WhatsApp webhook endpoint (no auth middleware - uses signature verification)
router.get('/whatsapp', handleWhatsAppWebhook);
router.post('/whatsapp', handleWhatsAppWebhook);

// Mobile Money webhooks (no auth - provider verifies via signature/IP)
router.post('/mtn-momo', mtnWebhook);
router.post('/airtel-money', airtelWebhook);

module.exports = router;






