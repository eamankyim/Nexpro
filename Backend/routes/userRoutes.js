const express = require('express');
const {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus
} = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

const router = express.Router();

router.use(protect);
router.use(tenantContext);

// List / read: managers and workspace admins. Mutations: workspace admins only.
router.get('/', authorize('admin', 'manager'), getUsers);
router.post('/', authorize('admin'), createUser);

// Specific path before /:id to avoid param collisions
router.put('/:id/toggle-status', authorize('admin'), toggleUserStatus);

router.get('/:id', authorize('admin', 'manager'), getUser);
router.put('/:id', authorize('admin'), updateUser);
router.delete('/:id', authorize('admin'), deleteUser);

module.exports = router;
