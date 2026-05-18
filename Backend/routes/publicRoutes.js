const express = require('express');
const { getPublicPlans } = require('../controllers/publicPricingController');
const {
  getInvoiceByToken,
  processPublicPayment,
  initializePaystackForInvoice,
  verifyPaystackReturnForPublicInvoice,
  initiateMobileMoneyForPublicInvoice,
  pollMobileMoneyForPublicInvoice
} = require('../controllers/invoiceController');
const { getQuoteByViewToken, respondToQuoteByToken } = require('../controllers/quoteController');
const { submitDemoBooking, getJobTrackByToken, lookupPublicTracking, getPublicTrackBranding } = require('../controllers/publicController');
const {
  getPublicFeedbackBranding,
  submitPublicFeedback
} = require('../controllers/publicFeedbackController');
const {
  publicTrackingLookupLimiter,
  publicTrackBrandingLimiter,
  publicFeedbackSubmitLimiter
} = require('../middleware/rateLimiter');

const router = express.Router();

router.get('/pricing', getPublicPlans);

// Demo booking from marketing site → creates admin lead (control center)
router.post('/demo-booking', submitDemoBooking);

// Public invoice routes (no authentication required)
router.get('/invoices/:token', getInvoiceByToken);
router.post('/invoices/:token/pay', processPublicPayment);
router.post('/invoices/:token/initialize-paystack', initializePaystackForInvoice);
router.post('/invoices/:token/verify-paystack', verifyPaystackReturnForPublicInvoice);
router.post('/invoices/:token/mobile-money/initiate', initiateMobileMoneyForPublicInvoice);
router.post('/invoices/:token/mobile-money/poll', pollMobileMoneyForPublicInvoice);

// Public quote view (no login – for customer "View your quote" links)
router.get('/quotes/view/:token', getQuoteByViewToken);
router.post('/quotes/view/:token/respond', respondToQuoteByToken);

// Customer job tracking (no login)
router.get('/jobs/track/:token', getJobTrackByToken);
router.get('/track/:tenantSlug/branding', publicTrackBrandingLimiter, getPublicTrackBranding);
router.post('/track/:tenantSlug/lookup', publicTrackingLookupLimiter, lookupPublicTracking);

// End-customer feedback (no login)
router.get('/feedback/branding/:tenantSlug', publicTrackBrandingLimiter, getPublicFeedbackBranding);
router.post('/feedback', publicFeedbackSubmitLimiter, submitPublicFeedback);

module.exports = router;

