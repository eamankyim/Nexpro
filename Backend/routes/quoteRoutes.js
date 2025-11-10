const express = require('express');
const {
  getQuotes,
  getQuote,
  createQuote,
  updateQuote,
  deleteQuote,
  convertQuoteToJob
} = require('../controllers/quoteController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getQuotes)
  .post(authorize('admin', 'manager', 'staff'), createQuote);

router.route('/:id')
  .get(getQuote)
  .put(authorize('admin', 'manager', 'staff'), updateQuote)
  .delete(authorize('admin', 'manager'), deleteQuote);

router.post('/:id/convert', authorize('admin', 'manager', 'staff'), convertQuoteToJob);

module.exports = router;




