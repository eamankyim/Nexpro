const express = require('express');
const {
  getCustomerStats,
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  addCustomerActivity,
  getCustomerActivities,
  findOrCreateCustomer,
  bulkCreateCustomers,
  bulkUpdateCustomers,
  bulkDeleteCustomers,
  bulkUpdateCustomerStatus,
  exportCustomers
} = require('../controllers/customerController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { studioLocationContext } = require('../middleware/studioLocationContext');
const { shopContext } = require('../middleware/shopContext');
const { bulkOperationLimiter, exportLimiter } = require('../middleware/rateLimiter');
const { cacheMiddleware, generateCustomerListKey } = require('../middleware/cache');
const { timeCrudAction } = require('../middleware/crudTiming');

const router = express.Router();

router.use(protect);
router.use(tenantContext);
router.use(studioLocationContext);
router.use(shopContext);

router.route('/')
  .get(timeCrudAction('customers.list'), cacheMiddleware(60, generateCustomerListKey), getCustomers)
  .post(authorize('admin', 'manager', 'staff'), timeCrudAction('customers.create'), createCustomer);

// Stats endpoint - must be before /:id to avoid route conflict
router.route('/stats')
  .get(getCustomerStats);

// Export endpoint - must be before /:id to avoid route conflict
router.route('/export')
  .get(exportLimiter, authorize('admin', 'manager'), exportCustomers);

// Bulk operations - must be before /:id to avoid route conflict
router.route('/bulk')
  .post(bulkOperationLimiter, authorize('admin', 'manager'), timeCrudAction('customers.bulk_create'), bulkCreateCustomers)
  .put(bulkOperationLimiter, authorize('admin', 'manager'), timeCrudAction('customers.bulk_update'), bulkUpdateCustomers)
  .delete(bulkOperationLimiter, authorize('admin'), timeCrudAction('customers.bulk_delete'), bulkDeleteCustomers);

router.route('/bulk/status')
  .put(bulkOperationLimiter, authorize('admin', 'manager'), timeCrudAction('customers.bulk_update_status'), bulkUpdateCustomerStatus);

// Find or create customer by phone (for POS quick checkout)
// Must be before /:id to avoid route conflict
router.route('/find-or-create')
  .post(authorize('admin', 'manager', 'staff'), timeCrudAction('customers.find_or_create'), findOrCreateCustomer);

router.route('/:id')
  .get(timeCrudAction('customers.read'), getCustomer)
  .put(authorize('admin', 'manager', 'staff'), timeCrudAction('customers.update'), updateCustomer)
  .delete(authorize('admin', 'manager', 'staff'), timeCrudAction('customers.delete'), deleteCustomer);

router
  .route('/:id/activities')
  .get(getCustomerActivities)
  .post(authorize('admin', 'manager', 'staff'), addCustomerActivity);

module.exports = router;


