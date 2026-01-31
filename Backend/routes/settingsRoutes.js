const express = require('express');
const path = require('path');
const {
  getProfile,
  updateProfile,
  getOrganizationSettings,
  updateOrganizationSettings,
  getSubscriptionSettings,
  updateSubscriptionSettings,
  getPayrollSettings,
  updatePayrollSettings,
  getWhatsAppSettings,
  updateWhatsAppSettings,
  testWhatsAppConnection,
  getSMSSettings,
  updateSMSSettings,
  testSMSConnection,
  getEmailSettings,
  updateEmailSettings,
  testEmailConnection,
  uploadProfilePicture,
  uploadOrganizationLogo
} = require('../controllers/settingsController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { createUploader } = require('../middleware/upload');

const router = express.Router();

router.use(protect);
router.use(tenantContext);

// Use memory storage for images since we store base64 in database
const multer = require('multer');
const profileUploader = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.UPLOAD_MAX_SIZE_MB || '10', 10) * 1024 * 1024 // 10MB for images
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

const organizationUploader = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.UPLOAD_MAX_SIZE_MB || '10', 10) * 1024 * 1024 // 10MB for images
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

router
  .route('/profile')
  .get(getProfile)
  .put(updateProfile);

router.post('/profile/avatar', profileUploader.single('file'), uploadProfilePicture);

router
  .route('/organization')
  .get(getOrganizationSettings)
  .put(authorize('admin', 'manager'), updateOrganizationSettings);

router.post(
  '/organization/logo',
  authorize('admin', 'manager'),
  organizationUploader.single('file'),
  uploadOrganizationLogo
);

router
  .route('/subscription')
  .get(getSubscriptionSettings)
  .put(authorize('admin', 'manager'), updateSubscriptionSettings);

router
  .route('/payroll')
  .get(getPayrollSettings)
  .put(authorize('admin', 'manager'), updatePayrollSettings);

router
  .route('/whatsapp')
  .get(getWhatsAppSettings)
  .put(authorize('admin', 'manager'), updateWhatsAppSettings);

router.post(
  '/whatsapp/test',
  authorize('admin', 'manager'),
  testWhatsAppConnection
);

router
  .route('/sms')
  .get(getSMSSettings)
  .put(authorize('admin', 'manager'), updateSMSSettings);

router.post(
  '/sms/test',
  authorize('admin', 'manager'),
  testSMSConnection
);

router
  .route('/email')
  .get(getEmailSettings)
  .put(authorize('admin', 'manager'), updateEmailSettings);

router.post(
  '/email/test',
  authorize('admin', 'manager'),
  testEmailConnection
);

module.exports = router;

