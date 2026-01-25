const express = require('express');
const { signupTenant, completeOnboarding } = require('../controllers/tenantController');
const { protect } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { createUploader } = require('../middleware/upload');
const multer = require('multer');

const router = express.Router();

// Public route
router.post('/signup', signupTenant);

// Protected routes - handle file upload for logo
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit
router.post('/onboarding', protect, tenantContext, upload.single('companyLogo'), completeOnboarding);

module.exports = router;



