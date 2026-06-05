const express = require('express');
const path = require('path');
const {
  getProfile,
  updateProfile,
  getCustomerSources,
  getLeadSources,
  getOrganizationSettings,
  updateOrganizationSettings,
  getSubscriptionSettings,
  updateSubscriptionSettings,
  getPayrollSettings,
  updatePayrollSettings,
  getAISettings,
  updateAISettings,
  deleteAISettings,
  getWhatsAppSettings,
  updateWhatsAppSettings,
  testWhatsAppConnection,
  getSMSSettings,
  updateSMSSettings,
  testSMSConnection,
  getEmailSettings,
  updateEmailSettings,
  testEmailConnection,
  getNotificationChannels,
  getMessageDeliveryRules,
  updateMessageDeliveryRules,
  getDeliverySettings,
  updateDeliverySettings,
  updateCustomerNotificationPreferences,
  getQuoteWorkflow,
  updateQuoteWorkflow,
  getJobInvoiceSettings,
  updateJobInvoiceSettings,
  getPOSConfig,
  updatePOSConfig,
  uploadProfilePicture,
  uploadOrganizationLogo,
  requestDataDeletion,
  getPaymentCollectionBanks,
  getPaymentCollectionSettings,
  getPaystackWorkspaceTransactions,
  updatePaymentCollectionSettings,
  verifyPaymentCollectionPassword,
  sendPaymentCollectionOtp,
  verifyPaymentCollectionOtp,
  updateMtnCollectionCredentials,
  testMtnCollectionCredentials,
  disconnectMtnCollectionCredentials
} = require('../controllers/settingsController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { createUploader, checkStorageLimit } = require('../middleware/upload');

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

router.get('/customer-sources', getCustomerSources);
router.get('/lead-sources', getLeadSources);

router
  .route('/profile')
  .get(getProfile)
  .put(updateProfile);

router.post('/profile/avatar', checkStorageLimit, profileUploader.single('file'), uploadProfilePicture);
router.post('/data-deletion-request', requestDataDeletion);

router
  .route('/organization')
  .get(getOrganizationSettings)
  .put(authorize('admin', 'manager'), updateOrganizationSettings);

router.post(
  '/organization/logo',
  authorize('admin', 'manager'),
  checkStorageLimit,
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
  .route('/ai')
  .get(authorize('admin', 'manager'), getAISettings)
  .put(authorize('admin', 'manager'), updateAISettings)
  .delete(authorize('admin', 'manager'), deleteAISettings);

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

router.get('/notification-channels', getNotificationChannels);
router
  .route('/message-delivery-rules')
  .get(authorize('admin', 'manager'), getMessageDeliveryRules)
  .put(authorize('admin', 'manager'), updateMessageDeliveryRules);
router
  .route('/delivery')
  .get(getDeliverySettings)
  .put(authorize('admin', 'manager'), updateDeliverySettings);
router.put(
  '/customer-notification-preferences',
  authorize('admin', 'manager'),
  updateCustomerNotificationPreferences
);

router
  .route('/quote-workflow')
  .get(getQuoteWorkflow)
  .put(authorize('admin', 'manager'), updateQuoteWorkflow);

router
  .route('/job-invoice')
  .get(getJobInvoiceSettings)
  .put(authorize('admin', 'manager'), updateJobInvoiceSettings);

router
  .route('/pos-config')
  .get(getPOSConfig)
  .put(authorize('admin', 'manager'), updatePOSConfig);

router.get('/payment-collection/banks', getPaymentCollectionBanks);
router.get(
  '/payment-collection/paystack-transactions',
  authorize('admin', 'manager'),
  getPaystackWorkspaceTransactions
);
router.post(
  '/payment-collection/verify-password',
  authorize('admin', 'manager'),
  verifyPaymentCollectionPassword
);
router.post(
  '/payment-collection/send-otp',
  authorize('admin', 'manager'),
  sendPaymentCollectionOtp
);
router.post(
  '/payment-collection/verify-otp',
  authorize('admin', 'manager'),
  verifyPaymentCollectionOtp
);
router
  .route('/payment-collection')
  .get(getPaymentCollectionSettings)
  .put(authorize('admin', 'manager'), updatePaymentCollectionSettings);

router.put(
  '/mtn-collection-credentials',
  authorize('admin', 'manager'),
  updateMtnCollectionCredentials
);
router.post(
  '/mtn-collection-credentials/test',
  authorize('admin', 'manager'),
  testMtnCollectionCredentials
);
router.post(
  '/mtn-collection-credentials/disconnect',
  authorize('admin', 'manager'),
  disconnectMtnCollectionCredentials
);

module.exports = router;

