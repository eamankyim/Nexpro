const express = require('express');
const {
  getProducts,
  getProduct,
  getProductSales,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductByBarcode,
  getProductVariants,
  createProductVariant,
  updateProductVariant,
  deleteProductVariant,
  bulkCreateProducts,
  bulkUpdateProducts,
  bulkDeleteProducts,
  bulkUpdateStock,
  exportProducts,
  uploadProductImage,
  getProductCategories,
  createProductCategory
} = require('../controllers/productController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { cacheMiddleware, generateProductListKey } = require('../middleware/cache');
const { bulkOperationLimiter, exportLimiter } = require('../middleware/rateLimiter');
const { productImageUploader } = require('../middleware/upload');

const router = express.Router();

router.use(protect);
router.use(tenantContext);

// Product routes - cache list for 90s to reduce repeated heavy queries
router.route('/')
  .get(cacheMiddleware(90, generateProductListKey), getProducts)
  .post(authorize('admin', 'manager', 'staff'), createProduct);

// Export endpoint - must be before /:id to avoid conflict
router.route('/export')
  .get(exportLimiter, authorize('admin', 'manager'), exportProducts);

// Bulk operations - must be before /:id to avoid conflict
router.route('/bulk')
  .post(bulkOperationLimiter, authorize('admin', 'manager'), bulkCreateProducts)
  .put(bulkOperationLimiter, authorize('admin', 'manager'), bulkUpdateProducts)
  .delete(bulkOperationLimiter, authorize('admin'), bulkDeleteProducts);

router.route('/bulk/stock')
  .put(bulkOperationLimiter, authorize('admin', 'manager', 'staff'), bulkUpdateStock);

router.route('/barcode/:barcode')
  .get(getProductByBarcode);

router.route('/upload-image')
  .post(authorize('admin', 'manager', 'staff'), productImageUploader.single('file'), uploadProductImage);

router.route('/categories')
  .get(getProductCategories)
  .post(authorize('admin', 'manager', 'staff'), createProductCategory);

// Variant routes (must be before /:id to avoid conflict)
router.route('/variants/:variantId')
  .put(authorize('admin', 'manager', 'staff'), updateProductVariant)
  .delete(authorize('admin', 'manager', 'staff'), deleteProductVariant);

// Product-specific variant routes
router.route('/:id/variants')
  .get(getProductVariants)
  .post(authorize('admin', 'manager', 'staff'), createProductVariant);

router.route('/:id/sales')
  .get(getProductSales);

router.route('/:id')
  .get(getProduct)
  .put(authorize('admin', 'manager', 'staff'), updateProduct)
  .delete(authorize('admin', 'manager', 'staff'), deleteProduct);

module.exports = router;
