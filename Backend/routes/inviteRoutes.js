const express = require('express');
const {
  generateInvite,
  validateInvite,
  getInvites,
  revokeInvite,
  useInvite
} = require('../controllers/inviteController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.get('/validate/:token', validateInvite);

// Protected routes
router.use(protect);
router.use(authorize('admin'));

router.route('/')
  .get(getInvites)
  .post(generateInvite);

router.delete('/:id', revokeInvite);

// Separate route for using invite (called during registration)
router.put('/:token/use', useInvite);

module.exports = router;

