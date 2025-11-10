const express = require('express');
const {
  getInventoryCategories,
  createInventoryCategory,
  updateInventoryCategory,
  getInventoryItems,
  getInventoryItem,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  restockInventoryItem,
  adjustInventoryItem,
  recordUsageForJob,
  getInventorySummary,
  getInventoryMovements
} = require('../controllers/inventoryController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router
  .route('/categories')
  .get(getInventoryCategories)
  .post(authorize('admin', 'manager'), createInventoryCategory);

router
  .route('/categories/:id')
  .put(authorize('admin', 'manager'), updateInventoryCategory);

router
  .route('/items')
  .get(getInventoryItems)
  .post(authorize('admin', 'manager'), createInventoryItem);

router
  .route('/items/summary')
  .get(getInventorySummary);

router
  .route('/items/movements')
  .get(getInventoryMovements);

router
  .route('/items/:id')
  .get(getInventoryItem)
  .put(authorize('admin', 'manager'), updateInventoryItem)
  .delete(authorize('admin', 'manager'), deleteInventoryItem);

router.post('/items/:id/restock', authorize('admin', 'manager'), restockInventoryItem);
router.post('/items/:id/adjust', authorize('admin', 'manager'), adjustInventoryItem);
router.post('/items/:id/usage', authorize('admin', 'manager', 'staff'), recordUsageForJob);

module.exports = router;




