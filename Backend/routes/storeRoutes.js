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
  generateBanner,
  getStoreOrders,
  getStoreOrderStats,
  getStoreOrder,
  updateStoreOrderStatus,
  exportStoreOrders,
  getTradeAssuranceDashboard,
  getTradeAssurancePayments,
  getTradeAssuranceDisputes,
  getTradeAssurancePayouts,
  refundTradeAssuranceOrder,
} = require('../controllers/storeController');
const {
  getServiceListings,
  createServiceListing,
  updateServiceListing,
  deleteServiceListing,
  publishServiceListing,
  unpublishServiceListing,
  importServiceListingFromPricingTemplate,
  uploadServiceListingImages,
} = require('../controllers/studioStoreController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { shopContext } = require('../middleware/shopContext');
const { studioLocationContext } = require('../middleware/studioLocationContext');
const { productImageUploader, checkStorageLimit } = require('../middleware/upload');
const { bulkOperationLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.use(protect);
router.use(tenantContext);
router.use(shopContext);
router.use(studioLocationContext);

router.route('/settings')
  .get(getSettings)
  .put(authorize('admin', 'manager'), upsertSettings);

router.get('/setup-status', getSetupStatus);
router.get('/slug-availability', checkSlugAvailability);

router.get('/orders/stats', getStoreOrderStats);
router.get('/orders/export', authorize('admin', 'manager', 'staff'), exportStoreOrders);
router.get('/trade-assurance/dashboard', authorize('admin', 'manager', 'staff'), getTradeAssuranceDashboard);
router.get('/trade-assurance/payments', authorize('admin', 'manager'), getTradeAssurancePayments);
router.get('/trade-assurance/disputes', authorize('admin', 'manager'), getTradeAssuranceDisputes);
router.get('/trade-assurance/payouts', authorize('admin', 'manager'), getTradeAssurancePayouts);
router.post('/trade-assurance/orders/:id/refund', authorize('admin', 'manager'), refundTradeAssuranceOrder);
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

router.post(
  '/banner/generate',
  bulkOperationLimiter,
  authorize('admin', 'manager'),
  generateBanner
);

router.route('/listings')
  .get(getListings)
  .post(authorize('admin', 'manager', 'staff'), createListing);

router.route('/listings/:id')
  .patch(authorize('admin', 'manager', 'staff'), updateListing)
  .delete(authorize('admin', 'manager'), deleteListing);

router.patch('/listings/:id/publish', authorize('admin', 'manager', 'staff'), publishListing);
router.patch('/listings/:id/unpublish', authorize('admin', 'manager', 'staff'), unpublishListing);

router.post(
  '/service-listings/upload-images',
  authorize('admin', 'manager', 'staff'),
  checkStorageLimit,
  productImageUploader.array('files', 5),
  uploadServiceListingImages
);

router.route('/service-listings')
  .get(getServiceListings)
  .post(authorize('admin', 'manager', 'staff'), createServiceListing);

router.route('/service-listings/:id')
  .patch(authorize('admin', 'manager', 'staff'), updateServiceListing)
  .delete(authorize('admin', 'manager'), deleteServiceListing);

router.patch('/service-listings/:id/publish', authorize('admin', 'manager', 'staff'), publishServiceListing);
router.patch('/service-listings/:id/unpublish', authorize('admin', 'manager', 'staff'), unpublishServiceListing);
router.post(
  '/service-listings/import/pricing-template/:templateId',
  authorize('admin', 'manager', 'staff'),
  importServiceListingFromPricingTemplate
);

module.exports = router;
