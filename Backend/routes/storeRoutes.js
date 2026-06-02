const express = require('express');
const {
  getSettings,
  upsertSettings,
  getSetupStatus,
  checkSlugAvailability,
  getListings,
  createListing,
  updateListing,
  deleteListing,
  publishListing,
  unpublishListing,
  uploadListingImages,
  getStoreOrders,
  getStoreOrderStats,
  getStoreOrder,
  updateStoreOrderStatus,
} = require('../controllers/storeController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { shopContext } = require('../middleware/shopContext');
const { productImageUploader, checkStorageLimit } = require('../middleware/upload');

const router = express.Router();

router.use(protect);
router.use(tenantContext);
router.use(shopContext);

router.route('/settings')
  .get(getSettings)
  .put(authorize('admin', 'manager'), upsertSettings);

router.get('/setup-status', getSetupStatus);
router.get('/slug-availability', checkSlugAvailability);

router.get('/orders/stats', getStoreOrderStats);
router.route('/orders')
  .get(getStoreOrders);
router.route('/orders/:id')
  .get(getStoreOrder);
router.patch('/orders/:id/status', authorize('admin', 'manager', 'staff'), updateStoreOrderStatus);

router.post(
  '/listings/upload-images',
  authorize('admin', 'manager', 'staff'),
  checkStorageLimit,
  productImageUploader.array('files', 5),
  uploadListingImages
);

router.route('/listings')
  .get(getListings)
  .post(authorize('admin', 'manager', 'staff'), createListing);

router.route('/listings/:id')
  .patch(authorize('admin', 'manager', 'staff'), updateListing)
  .delete(authorize('admin', 'manager'), deleteListing);

router.patch('/listings/:id/publish', authorize('admin', 'manager', 'staff'), publishListing);
router.patch('/listings/:id/unpublish', authorize('admin', 'manager', 'staff'), unpublishListing);

module.exports = router;
