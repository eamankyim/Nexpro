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
  exportQuotes,
  uploadQuoteAttachment,
  deleteQuoteAttachment,
} = require('../controllers/quoteController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { shopContext } = require('../middleware/shopContext');
const { studioLocationContext } = require('../middleware/studioLocationContext');
const { exportLimiter } = require('../middleware/rateLimiter');
const { timeCrudAction } = require('../middleware/crudTiming');
const multer = require('multer');
const { checkStorageLimit } = require('../middleware/upload');

const router = express.Router();

router.use(protect);
router.use(tenantContext);
router.use(shopContext);
router.use(studioLocationContext);

const quoteAttachmentUploader = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.UPLOAD_MAX_SIZE_MB || '20', 10) * 1024 * 1024,
  },
});

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

router.post(
  '/:id/attachments',
  authorize('admin', 'manager', 'staff'),
  checkStorageLimit,
  quoteAttachmentUploader.single('file'),
  timeCrudAction('quotes.upload_attachment'),
  uploadQuoteAttachment
);

router.delete(
  '/:id/attachments/:attachmentId',
  authorize('admin', 'manager', 'staff'),
  timeCrudAction('quotes.delete_attachment'),
  deleteQuoteAttachment
);

router.route('/:id/activities')
  .get(getQuoteActivities)
  .post(authorize('admin', 'manager', 'staff'), addQuoteActivity);

module.exports = router;







