const express = require('express');
const { protect, requirePlatformAdmin } = require('../middleware/auth');
const { loadPlatformAdminPermissions, requirePlatformAdminPermission } = require('../middleware/platformAdminPermissions');
const {
  getRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  assignPermissionsToRole,
  getPermissions,
  getUserRoles,
  assignRoleToUser,
  removeRoleFromUser,
  getUserPermissions,
  getMyPermissions
} = require('../controllers/platformAdminRoleController');

const router = express.Router();

// All routes require platform admin and load permissions
router.use(protect);
router.use(requirePlatformAdmin);
router.use(loadPlatformAdminPermissions);

// Role management routes (require roles.manage permission)
router.get('/roles', requirePlatformAdminPermission('roles.view'), getRoles);
router.get('/roles/:id', requirePlatformAdminPermission('roles.view'), getRole);
router.post('/roles', requirePlatformAdminPermission('roles.manage'), createRole);
router.put('/roles/:id', requirePlatformAdminPermission('roles.manage'), updateRole);
router.delete('/roles/:id', requirePlatformAdminPermission('roles.manage'), deleteRole);
router.post('/roles/:id/permissions', requirePlatformAdminPermission('roles.manage'), assignPermissionsToRole);

// Permission routes
router.get('/permissions', requirePlatformAdminPermission('roles.view'), getPermissions);

// User role assignment routes (require roles.manage permission)
router.get('/users/:userId/roles', requirePlatformAdminPermission('roles.view'), getUserRoles);
router.post('/users/:userId/roles', requirePlatformAdminPermission('roles.manage'), assignRoleToUser);
router.delete('/users/:userId/roles/:roleId', requirePlatformAdminPermission('roles.manage'), removeRoleFromUser);
/** Platform admins can always read their own effective permissions (needed to render the Control Center). */
const requireRolesViewUnlessSelf = (req, res, next) => {
  if (req.user?.id && req.params.userId === req.user.id) {
    return next();
  }
  return requirePlatformAdminPermission('roles.view')(req, res, next);
};

router.get('/me/permissions', getMyPermissions);
router.get('/users/:userId/permissions', requireRolesViewUnlessSelf, getUserPermissions);

module.exports = router;
