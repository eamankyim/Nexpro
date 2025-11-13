const express = require('express');
const {
  generateInvite,
  validateInvite,
  getInvites,
  revokeInvite,
  useInvite,
  getSeatUsage,
  getStorageUsage
} = require('../controllers/inviteController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

const router = express.Router();

// Public routes
router.get('/validate/:token', validateInvite);

// Protected routes
router.use(protect);
router.use(tenantContext);

// Usage endpoints (available to all authenticated users)
router.get('/seat-usage', getSeatUsage);
router.get('/storage-usage', getStorageUsage);

router.use(authorize('admin'));

router.route('/')
  .get(getInvites)
  .post(generateInvite);

router.delete('/:id', revokeInvite);

// Separate route for using invite (called during registration)
router.put('/:token/use', useInvite);

module.exports = router;

