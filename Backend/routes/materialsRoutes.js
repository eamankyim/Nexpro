const express = require('express');
const {
  getMaterialsCategories,
  createMaterialsCategory,
  updateMaterialsCategory,
  getMaterialsItems,
  getMaterialItem,
  createMaterialItem,
  updateMaterialItem,
  deleteMaterialItem,
  restockMaterialItem,
  adjustMaterialItem,
  recordUsageForJob,
  getMaterialsSummary,
  getMaterialsMovements,
  bulkCreateMaterials,
  getMaterialsImportTemplate,
  importMaterials,
  exportMaterialsItems
} = require('../controllers/materialsController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { bulkOperationLimiter, exportLimiter } = require('../middleware/rateLimiter');
const { importFileUploader } = require('../middleware/upload');

const router = express.Router();

router.use(protect);
router.use(tenantContext);

router
  .route('/categories')
  .get(getMaterialsCategories)
  .post(authorize('admin', 'manager'), createMaterialsCategory);

router
  .route('/categories/:id')
  .put(authorize('admin', 'manager'), updateMaterialsCategory);

router
  .route('/items')
  .get(getMaterialsItems)
  .post(authorize('admin', 'manager'), createMaterialItem);

router.get('/items/export', exportLimiter, authorize('admin', 'manager'), exportMaterialsItems);

router.post('/items/bulk', bulkOperationLimiter, authorize('admin', 'manager'), bulkCreateMaterials);
router.get('/items/import/template', exportLimiter, authorize('admin', 'manager'), getMaterialsImportTemplate);
router.post('/items/import', bulkOperationLimiter, authorize('admin', 'manager'), importFileUploader.single('file'), importMaterials);

router
  .route('/items/summary')
  .get(getMaterialsSummary);

router
  .route('/items/movements')
  .get(getMaterialsMovements);

router
  .route('/items/:id')
  .get(getMaterialItem)
  .put(authorize('admin', 'manager'), updateMaterialItem)
  .delete(authorize('admin', 'manager'), deleteMaterialItem);

router.post('/items/:id/restock', authorize('admin', 'manager'), restockMaterialItem);
router.post('/items/:id/adjust', authorize('admin', 'manager'), adjustMaterialItem);
router.post('/items/:id/usage', authorize('admin', 'manager', 'staff'), recordUsageForJob);

module.exports = router;
