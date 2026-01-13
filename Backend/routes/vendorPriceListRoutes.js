const express = require('express');
const router = express.Router({ mergeParams: true }); // mergeParams to access vendorId from parent route
const {
  getVendorPriceList,
  createPriceListItem,
  updatePriceListItem,
  deletePriceListItem,
  uploadPriceListItemImage
} = require('../controllers/vendorPriceListController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { vendorPriceListUploader, checkStorageLimit } = require('../middleware/upload');

// All routes require authentication
router.use(protect);
router.use(tenantContext);

router.route('/')
  .get(getVendorPriceList)
  .post(authorize('admin', 'manager', 'staff'), createPriceListItem);

router.route('/:id')
  .put(authorize('admin', 'manager', 'staff'), updatePriceListItem)
  .delete(authorize('admin', 'manager', 'staff'), deletePriceListItem);

router.post(
  '/:id/image',
  authorize('admin', 'manager', 'staff'),
  (req, res, next) => {
    console.log('[Image Upload Route] Request received');
    console.log('[Image Upload Route] Params:', req.params);
    console.log('[Image Upload Route] Headers:', {
      'content-type': req.headers['content-type'],
      'content-length': req.headers['content-length']
    });
    next();
  },
  checkStorageLimit,
  (req, res, next) => {
    console.log('[Image Upload Route] Storage limit check passed');
    next();
  },
  vendorPriceListUploader.single('file'),
  (req, res, next) => {
    console.log('[Image Upload Route] Multer processing complete');
    if (req.file) {
      console.log('[Image Upload Route] File received:', {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        hasBuffer: !!req.file.buffer
      });
    } else {
      console.log('[Image Upload Route] ⚠️  No file in request after multer');
    }
    next();
  },
  uploadPriceListItemImage
);

module.exports = router;









