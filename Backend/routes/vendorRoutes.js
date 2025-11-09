const express = require('express');
const {
  getVendors,
  getVendor,
  createVendor,
  updateVendor,
  deleteVendor
} = require('../controllers/vendorController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Import price list routes
const priceListRoutes = require('./vendorPriceListRoutes');

router.use(protect);

router.route('/')
  .get(getVendors)
  .post(authorize('admin', 'manager', 'staff'), createVendor);

router.route('/:id')
  .get(getVendor)
  .put(authorize('admin', 'manager', 'staff'), updateVendor)
  .delete(authorize('admin', 'manager', 'staff'), deleteVendor);

// Mount price list routes
router.use('/:vendorId/price-list', priceListRoutes);

module.exports = router;


