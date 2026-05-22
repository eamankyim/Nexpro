const express = require('express');
const multer = require('multer');
const {
  getShops,
  getShop,
  getShopAccess,
  createShop,
  updateShop,
  deleteShop,
  uploadShopLogo,
  setUserShopAssignments,
  getUserShopAssignments,
} = require('../controllers/shopController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { shopContext } = require('../middleware/shopContext');

const branchLogoUploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: parseInt(process.env.UPLOAD_MAX_SIZE_MB || '5', 10) * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype?.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'), false);
  },
});

const router = express.Router();

router.use(protect);
router.use(tenantContext);
router.use(shopContext);

router.get('/access', getShopAccess);

router
  .route('/users/:userId/assignments')
  .get(authorize('admin'), getUserShopAssignments)
  .put(authorize('admin'), setUserShopAssignments);

router.route('/')
  .get(getShops)
  .post(authorize('admin', 'manager', 'staff'), createShop);

router.post(
  '/:id/logo',
  authorize('admin', 'manager'),
  branchLogoUploader.single('file'),
  uploadShopLogo
);

router.route('/:id')
  .get(getShop)
  .put(authorize('admin', 'manager', 'staff'), updateShop)
  .delete(authorize('admin', 'manager', 'staff'), deleteShop);

module.exports = router;
