const {
  PlatformAdminUserRole,
  PlatformAdminRole,
  PlatformAdminPermission
} = require('../models');
const { cache } = require('./cache');

const PERMISSION_CACHE_TTL = 5 * 60; // 5 minutes

/**
 * Load platform admin permissions for a user and attach to request
 */
const loadPlatformAdminPermissions = async (req, res, next) => {
  try {
    if (!req.user || !req.user.isPlatformAdmin) {
      req.platformAdminPermissions = [];
      req.platformAdminPermissionKeys = [];
      return next();
    }

    const cacheKey = `platform_admin_permissions:${req.user.id}`;
    let permissionKeys = cache.get(cacheKey);

    if (!permissionKeys) {
      // Load user's roles and permissions
      const userRoles = await PlatformAdminUserRole.findAll({
        where: { userId: req.user.id },
        include: [{
          model: PlatformAdminRole,
          as: 'role',
          include: [{
            model: PlatformAdminPermission,
            as: 'permissions',
            attributes: ['key'],
            through: { attributes: [] }
          }]
        }]
      });

      // Union all permissions from all roles
      const permissionSet = new Set();
      userRoles.forEach(userRole => {
        if (userRole.role && userRole.role.permissions) {
          userRole.role.permissions.forEach(perm => {
            permissionSet.add(perm.key);
          });
        }
      });

      permissionKeys = Array.from(permissionSet);
      cache.set(cacheKey, permissionKeys, PERMISSION_CACHE_TTL);
    }

    req.platformAdminPermissions = permissionKeys;
    req.platformAdminPermissionKeys = permissionKeys;
    next();
  } catch (error) {
    console.error('Error loading platform admin permissions:', error);
    req.platformAdminPermissions = [];
    req.platformAdminPermissionKeys = [];
    next();
  }
};

/**
 * Middleware to require a specific platform admin permission
 */
const requirePlatformAdminPermission = (permissionKey) => {
  return async (req, res, next) => {
    // Ensure permissions are loaded
    if (!req.platformAdminPermissionKeys) {
      await loadPlatformAdminPermissions(req, res, () => {});
    }

    if (!req.user || !req.user.isPlatformAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Platform administrator access required'
      });
    }

    if (!req.platformAdminPermissionKeys.includes(permissionKey)) {
      return res.status(403).json({
        success: false,
        message: `Permission '${permissionKey}' required`
      });
    }

    next();
  };
};

/**
 * Middleware to require any of the specified permissions
 */
const requireAnyPlatformAdminPermission = (...permissionKeys) => {
  return async (req, res, next) => {
    // Ensure permissions are loaded
    if (!req.platformAdminPermissionKeys) {
      await loadPlatformAdminPermissions(req, res, () => {});
    }

    if (!req.user || !req.user.isPlatformAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Platform administrator access required'
      });
    }

    const hasPermission = permissionKeys.some(key =>
      req.platformAdminPermissionKeys.includes(key)
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: `One of the following permissions required: ${permissionKeys.join(', ')}`
      });
    }

    next();
  };
};

/**
 * Middleware to require all of the specified permissions
 */
const requireAllPlatformAdminPermissions = (...permissionKeys) => {
  return async (req, res, next) => {
    // Ensure permissions are loaded
    if (!req.platformAdminPermissionKeys) {
      await loadPlatformAdminPermissions(req, res, () => {});
    }

    if (!req.user || !req.user.isPlatformAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Platform administrator access required'
      });
    }

    const hasAllPermissions = permissionKeys.every(key =>
      req.platformAdminPermissionKeys.includes(key)
    );

    if (!hasAllPermissions) {
      return res.status(403).json({
        success: false,
        message: `All of the following permissions required: ${permissionKeys.join(', ')}`
      });
    }

    next();
  };
};

/**
 * Helper function to check if user has permission (for use in controllers)
 */
const hasPlatformAdminPermission = (req, permissionKey) => {
  if (!req.platformAdminPermissionKeys) {
    return false;
  }
  return req.platformAdminPermissionKeys.includes(permissionKey);
};

/**
 * Helper function to check if user has any of the permissions
 */
const hasAnyPlatformAdminPermission = (req, ...permissionKeys) => {
  if (!req.platformAdminPermissionKeys) {
    return false;
  }
  return permissionKeys.some(key => req.platformAdminPermissionKeys.includes(key));
};

/**
 * Helper function to check if user has all of the permissions
 */
const hasAllPlatformAdminPermissions = (req, ...permissionKeys) => {
  if (!req.platformAdminPermissionKeys) {
    return false;
  }
  return permissionKeys.every(key => req.platformAdminPermissionKeys.includes(key));
};

module.exports = {
  loadPlatformAdminPermissions,
  requirePlatformAdminPermission,
  requireAnyPlatformAdminPermission,
  requireAllPlatformAdminPermissions,
  hasPlatformAdminPermission,
  hasAnyPlatformAdminPermission,
  hasAllPlatformAdminPermissions
};
