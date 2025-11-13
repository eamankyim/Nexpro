const express = require('express');
const router = express.Router({ mergeParams: true }); // mergeParams to access vendorId from parent route
const {
  getVendorPriceList,
  createPriceListItem,
  updatePriceListItem,
  deletePriceListItem
} = require('../controllers/vendorPriceListController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

// All routes require authentication
router.use(protect);
router.use(tenantContext);

router.route('/')
  .get(getVendorPriceList)
  .post(authorize('admin', 'manager', 'staff'), createPriceListItem);

router.route('/:id')
  .put(authorize('admin', 'manager', 'staff'), updatePriceListItem)
  .delete(authorize('admin', 'manager', 'staff'), deletePriceListItem);

module.exports = router;









