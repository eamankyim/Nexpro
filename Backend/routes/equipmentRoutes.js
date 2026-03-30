const express = require('express');
const {
  getEquipmentCategories,
  createEquipmentCategory,
  updateEquipmentCategory,
  getEquipmentItems,
  getEquipmentItem,
  createEquipmentItem,
  updateEquipmentItem,
  deleteEquipmentItem,
  bulkCreateEquipment,
  getEquipmentImportTemplate,
  importEquipment,
  exportEquipmentItems
} = require('../controllers/equipmentController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { bulkOperationLimiter, exportLimiter } = require('../middleware/rateLimiter');
const { importFileUploader } = require('../middleware/upload');

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

router.get('/items/export', exportLimiter, authorize('admin', 'manager'), exportEquipmentItems);

router.post('/items/bulk', bulkOperationLimiter, authorize('admin', 'manager'), bulkCreateEquipment);
router.get('/items/import/template', exportLimiter, authorize('admin', 'manager'), getEquipmentImportTemplate);
router.post('/items/import', bulkOperationLimiter, authorize('admin', 'manager'), importFileUploader.single('file'), importEquipment);

router
  .route('/items/:id')
  .get(getEquipmentItem)
  .put(authorize('admin', 'manager'), updateEquipmentItem)
  .delete(authorize('admin', 'manager'), deleteEquipmentItem);

module.exports = router;
