const express = require('express');
const {
  getQuotes,
  getQuote,
  createQuote,
  updateQuote,
  updateQuoteStatus,
  deleteQuote,
  convertQuoteToJob,
  convertQuoteToSale,
  addQuoteActivity,
  getQuoteActivities,
  exportQuotes
} = require('../controllers/quoteController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { exportLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.use(protect);
router.use(tenantContext);

router.get('/export', exportLimiter, authorize('admin', 'manager'), exportQuotes);

router.route('/')
  .get(getQuotes)
  .post(authorize('admin', 'manager', 'staff'), createQuote);

router.route('/:id')
  .get(getQuote)
  .put(authorize('admin', 'manager', 'staff'), updateQuote)
  .delete(authorize('admin', 'manager'), deleteQuote);

router.patch('/:id/status', authorize('admin', 'manager', 'staff'), updateQuoteStatus);

router.post('/:id/convert', authorize('admin', 'manager', 'staff'), convertQuoteToJob);
router.post('/:id/convert-to-sale', authorize('admin', 'manager', 'staff'), convertQuoteToSale);

router.route('/:id/activities')
  .get(getQuoteActivities)
  .post(authorize('admin', 'manager', 'staff'), addQuoteActivity);

module.exports = router;







