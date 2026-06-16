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
const { timeCrudAction } = require('../middleware/crudTiming');

const router = express.Router();

router.use(protect);
router.use(tenantContext);

// List / read: managers and workspace admins. Mutations: workspace admins only.
router.get('/', authorize('admin', 'manager'), timeCrudAction('users.list'), getUsers);
router.post('/', authorize('admin'), timeCrudAction('users.create'), createUser);

// Specific path before /:id to avoid param collisions
router.put('/:id/toggle-status', authorize('admin'), timeCrudAction('users.toggle_status'), toggleUserStatus);

router.get('/:id', authorize('admin', 'manager'), timeCrudAction('users.read'), getUser);
router.put('/:id', authorize('admin'), timeCrudAction('users.update'), updateUser);
router.delete('/:id', authorize('admin'), timeCrudAction('users.delete'), deleteUser);

module.exports = router;
