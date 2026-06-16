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
const { timeCrudAction } = require('../middleware/crudTiming');

const router = express.Router();

router.use(protect);
router.use(tenantContext);
router.use(shopContext);
router.use(studioLocationContext);

router.route('/settings')
  .get(getSettings)
  .put(authorize('admin', 'manager'), timeCrudAction('store.settings.upsert'), upsertSettings);

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
  .get(timeCrudAction('store.orders.list'), getStoreOrders);
router.route('/orders/:id')
  .get(timeCrudAction('store.orders.read'), getStoreOrder);
router.patch('/orders/:id/status', authorize('admin', 'manager', 'staff'), timeCrudAction('store.orders.update_status'), updateStoreOrderStatus);

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
  .get(timeCrudAction('store.listings.list'), getListings)
  .post(authorize('admin', 'manager', 'staff'), timeCrudAction('store.listings.create'), createListing);

router.route('/listings/:id')
  .patch(authorize('admin', 'manager', 'staff'), timeCrudAction('store.listings.update'), updateListing)
  .delete(authorize('admin', 'manager'), timeCrudAction('store.listings.delete'), deleteListing);

router.patch('/listings/:id/publish', authorize('admin', 'manager', 'staff'), timeCrudAction('store.listings.publish'), publishListing);
router.patch('/listings/:id/unpublish', authorize('admin', 'manager', 'staff'), timeCrudAction('store.listings.unpublish'), unpublishListing);

router.post(
  '/service-listings/upload-images',
  authorize('admin', 'manager', 'staff'),
  checkStorageLimit,
  productImageUploader.array('files', 5),
  uploadServiceListingImages
);

router.route('/service-listings')
  .get(timeCrudAction('store.service_listings.list'), getServiceListings)
  .post(authorize('admin', 'manager', 'staff'), timeCrudAction('store.service_listings.create'), createServiceListing);

router.route('/service-listings/:id')
  .patch(authorize('admin', 'manager', 'staff'), timeCrudAction('store.service_listings.update'), updateServiceListing)
  .delete(authorize('admin', 'manager'), timeCrudAction('store.service_listings.delete'), deleteServiceListing);

router.patch('/service-listings/:id/publish', authorize('admin', 'manager', 'staff'), timeCrudAction('store.service_listings.publish'), publishServiceListing);
router.patch('/service-listings/:id/unpublish', authorize('admin', 'manager', 'staff'), timeCrudAction('store.service_listings.unpublish'), unpublishServiceListing);
router.post(
  '/service-listings/import/pricing-template/:templateId',
  authorize('admin', 'manager', 'staff'),
  timeCrudAction('store.service_listings.import_pricing_template'),
  importServiceListingFromPricingTemplate
);

module.exports = router;
