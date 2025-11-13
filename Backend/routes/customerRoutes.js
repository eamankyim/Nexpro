const express = require('express');
const {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer
} = require('../controllers/customerController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

const router = express.Router();

router.use(protect);
router.use(tenantContext);

router.route('/')
  .get(getCustomers)
  .post(authorize('admin', 'manager', 'staff'), createCustomer);

router.route('/:id')
  .get(getCustomer)
  .put(authorize('admin', 'manager', 'staff'), updateCustomer)
  .delete(authorize('admin', 'manager', 'staff'), deleteCustomer);

module.exports = router;


