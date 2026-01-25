const express = require('express');
const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductByBarcode
} = require('../controllers/productController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

const router = express.Router();

router.use(protect);
router.use(tenantContext);

router.route('/')
  .get(getProducts)
  .post(authorize('admin', 'manager', 'staff'), createProduct);

router.route('/barcode/:barcode')
  .get(getProductByBarcode);

router.route('/:id')
  .get(getProduct)
  .put(authorize('admin', 'manager', 'staff'), updateProduct)
  .delete(authorize('admin', 'manager', 'staff'), deleteProduct);

module.exports = router;
