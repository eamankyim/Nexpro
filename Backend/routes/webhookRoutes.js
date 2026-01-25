const express = require('express');
const router = express.Router();
const { handleSabitoCustomerWebhook, handleWhatsAppWebhook } = require('../controllers/webhookController');

// Sabito webhook endpoint (no auth middleware - uses API key authentication)
router.post('/sabito/customer', handleSabitoCustomerWebhook);

// WhatsApp webhook endpoint (no auth middleware - uses signature verification)
router.get('/whatsapp', handleWhatsAppWebhook);
router.post('/whatsapp', handleWhatsAppWebhook);

module.exports = router;






