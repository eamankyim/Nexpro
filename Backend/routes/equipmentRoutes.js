const express = require('express');
const {
  getEquipmentCategories,
  createEquipmentCategory,
  updateEquipmentCategory,
  getEquipmentItems,
  getEquipmentItem,
  createEquipmentItem,
  updateEquipmentItem,
  deleteEquipmentItem
} = require('../controllers/equipmentController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

const router = express.Router();

router.use(protect);
router.use(tenantContext);

router
  .route('/categories')
  .get(getEquipmentCategories)
  .post(authorize('admin', 'manager'), createEquipmentCategory);

router
  .route('/categories/:id')
  .put(authorize('admin', 'manager'), updateEquipmentCategory);

router
  .route('/items')
  .get(getEquipmentItems)
  .post(authorize('admin', 'manager'), createEquipmentItem);

router
  .route('/items/:id')
  .get(getEquipmentItem)
  .put(authorize('admin', 'manager'), updateEquipmentItem)
  .delete(authorize('admin', 'manager'), deleteEquipmentItem);

module.exports = router;
