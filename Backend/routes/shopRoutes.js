const express = require('express');
const {
  getShops,
  getShop,
  createShop,
  updateShop,
  deleteShop
} = require('../controllers/shopController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

const router = express.Router();

router.use(protect);
router.use(tenantContext);

router.route('/')
  .get(getShops)
  .post(authorize('admin', 'manager', 'staff'), createShop);

router.route('/:id')
  .get(getShop)
  .put(authorize('admin', 'manager', 'staff'), updateShop)
  .delete(authorize('admin', 'manager', 'staff'), deleteShop);

module.exports = router;
