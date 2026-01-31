const express = require('express');
const {
  register,
  login,
  getMe,
  updateDetails,
  updatePassword,
  setInitialPassword,
  sabitoSSO,
  verifyNexproToken
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { authLimiter, registrationLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Apply stricter rate limiting to auth endpoints
router.post('/register', registrationLimiter, register);
router.post('/login', authLimiter, login);
router.post('/sso/sabito', authLimiter, sabitoSSO);
console.log('[AUTH ROUTES] ✅ POST /api/auth/sso/sabito route registered');
// Endpoint for Sabito to verify ShopWISE tokens (for reverse SSO)
router.get('/verify-token', verifyNexproToken);
router.get('/me', protect, getMe);
router.put('/updatedetails', protect, updateDetails);
router.put('/updatepassword', protect, updatePassword);
router.put('/set-initial-password', protect, setInitialPassword);

module.exports = router;


