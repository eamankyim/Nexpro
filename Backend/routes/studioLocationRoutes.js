const express = require('express');
const multer = require('multer');
const {
  getStudioLocations,
  getStudioLocationAccess,
  getStudioLocation,
  createStudioLocation,
  updateStudioLocation,
  deleteStudioLocation,
  uploadStudioLocationLogo,
  setUserStudioLocationAssignments,
  getUserStudioLocationAssignments,
} = require('../controllers/studioLocationController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { studioLocationContext } = require('../middleware/studioLocationContext');

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
router.use(studioLocationContext);

router.get('/access', getStudioLocationAccess);

router
  .route('/users/:userId/assignments')
  .get(authorize('admin'), getUserStudioLocationAssignments)
  .put(authorize('admin'), setUserStudioLocationAssignments);

router
  .route('/')
  .get(getStudioLocations)
  .post(authorize('admin', 'manager'), createStudioLocation);

router.post(
  '/:id/logo',
  authorize('admin', 'manager'),
  branchLogoUploader.single('file'),
  uploadStudioLocationLogo
);

router
  .route('/:id')
  .get(getStudioLocation)
  .put(authorize('admin', 'manager'), updateStudioLocation)
  .delete(authorize('admin'), deleteStudioLocation);

module.exports = router;
