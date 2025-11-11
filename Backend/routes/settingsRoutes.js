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
  uploadProfilePicture,
  uploadOrganizationLogo
} = require('../controllers/settingsController');
const { protect, authorize } = require('../middleware/auth');
const { createUploader } = require('../middleware/upload');

const router = express.Router();

router.use(protect);

const profileUploader = createUploader((req) => path.join('users', req.user.id));
const organizationUploader = createUploader(() => path.join('settings', 'organization'));

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

module.exports = router;

