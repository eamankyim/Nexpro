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
const { shopContext } = require('../middleware/shopContext');
const { studioLocationContext } = require('../middleware/studioLocationContext');
const { exportLimiter } = require('../middleware/rateLimiter');
const { timeCrudAction } = require('../middleware/crudTiming');

const router = express.Router();

router.use(protect);
router.use(tenantContext);
router.use(shopContext);
router.use(studioLocationContext);

router.get('/export', exportLimiter, authorize('admin', 'manager'), exportQuotes);

router.route('/')
  .get(timeCrudAction('quotes.list'), getQuotes)
  .post(authorize('admin', 'manager', 'staff'), timeCrudAction('quotes.create'), createQuote);

router.route('/:id')
  .get(timeCrudAction('quotes.read'), getQuote)
  .put(authorize('admin', 'manager', 'staff'), timeCrudAction('quotes.update'), updateQuote)
  .delete(authorize('admin'), timeCrudAction('quotes.delete'), deleteQuote);

router.patch('/:id/status', authorize('admin', 'manager', 'staff'), timeCrudAction('quotes.update_status'), updateQuoteStatus);

router.post('/:id/convert', authorize('admin', 'manager', 'staff'), timeCrudAction('quotes.convert_to_job'), convertQuoteToJob);
router.post('/:id/convert-to-sale', authorize('admin', 'manager', 'staff'), timeCrudAction('quotes.convert_to_sale'), convertQuoteToSale);

router.route('/:id/activities')
  .get(getQuoteActivities)
  .post(authorize('admin', 'manager', 'staff'), addQuoteActivity);

module.exports = router;







