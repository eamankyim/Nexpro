const express = require('express');
const {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer
} = require('../controllers/customerController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getCustomers)
  .post(authorize('admin', 'manager', 'staff'), createCustomer);

router.route('/:id')
  .get(getCustomer)
  .put(authorize('admin', 'manager', 'staff'), updateCustomer)
  .delete(authorize('admin', 'manager', 'staff'), deleteCustomer);

module.exports = router;


