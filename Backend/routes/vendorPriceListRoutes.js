const express = require('express');
const router = express.Router({ mergeParams: true }); // mergeParams to access vendorId from parent route
const {
  getVendorPriceList,
  createPriceListItem,
  updatePriceListItem,
  deletePriceListItem
} = require('../controllers/vendorPriceListController');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

router.route('/')
  .get(getVendorPriceList)
  .post(authorize('manager', 'admin'), createPriceListItem);

router.route('/:id')
  .put(authorize('manager', 'admin'), updatePriceListItem)
  .delete(authorize('manager', 'admin'), deletePriceListItem);

module.exports = router;









