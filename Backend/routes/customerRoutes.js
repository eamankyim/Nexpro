const express = require('express');
const {
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
const { bulkOperationLimiter, exportLimiter } = require('../middleware/rateLimiter');
const { cacheMiddleware, generateCustomerListKey } = require('../middleware/cache');

const router = express.Router();

router.use(protect);
router.use(tenantContext);

router.route('/')
  .get(cacheMiddleware(60, generateCustomerListKey), getCustomers)
  .post(authorize('admin', 'manager', 'staff'), createCustomer);

// Export endpoint - must be before /:id to avoid route conflict
router.route('/export')
  .get(exportLimiter, authorize('admin', 'manager'), exportCustomers);

// Bulk operations - must be before /:id to avoid route conflict
router.route('/bulk')
  .post(bulkOperationLimiter, authorize('admin', 'manager'), bulkCreateCustomers)
  .put(bulkOperationLimiter, authorize('admin', 'manager'), bulkUpdateCustomers)
  .delete(bulkOperationLimiter, authorize('admin'), bulkDeleteCustomers);

router.route('/bulk/status')
  .put(bulkOperationLimiter, authorize('admin', 'manager'), bulkUpdateCustomerStatus);

// Find or create customer by phone (for POS quick checkout)
// Must be before /:id to avoid route conflict
router.route('/find-or-create')
  .post(authorize('admin', 'manager', 'staff'), findOrCreateCustomer);

router.route('/:id')
  .get(getCustomer)
  .put(authorize('admin', 'manager', 'staff'), updateCustomer)
  .delete(authorize('admin', 'manager', 'staff'), deleteCustomer);

router
  .route('/:id/activities')
  .get(getCustomerActivities)
  .post(authorize('admin', 'manager', 'staff'), addCustomerActivity);

module.exports = router;


