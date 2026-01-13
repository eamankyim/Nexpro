const express = require('express');
const {
  register,
  login,
  getMe,
  updateDetails,
  updatePassword,
  sabitoSSO,
  verifyNexproToken
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/sso/sabito', sabitoSSO);
console.log('[AUTH ROUTES] ✅ POST /api/auth/sso/sabito route registered');
// Endpoint for Sabito to verify NEXPro tokens (for reverse SSO)
router.get('/verify-token', verifyNexproToken);
router.get('/me', protect, getMe);
router.put('/updatedetails', protect, updateDetails);
router.put('/updatepassword', protect, updatePassword);

module.exports = router;


