const {
  PlatformAdminRole,
  PlatformAdminPermission,
  PlatformAdminRolePermission,
  PlatformAdminUserRole,
  User
} = require('../models');
const { Op } = require('sequelize');
const { getPagination } = require('../utils/paginationUtils');

/**
 * Get all platform admin roles
 */
exports.getRoles = async (req, res, next) => {
  try {
    const roles = await PlatformAdminRole.findAll({
      include: [{
        model: PlatformAdminPermission,
        as: 'permissions',
        attributes: ['id', 'key', 'name', 'category'],
        through: { attributes: [] }
      }],
      order: [['department', 'ASC'], ['name', 'ASC']]
    });

    res.status(200).json({
      success: true,
      data: roles
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single platform admin role
 */
exports.getRole = async (req, res, next) => {
  try {
    const role = await PlatformAdminRole.findByPk(req.params.id, {
      include: [{
        model: PlatformAdminPermission,
        as: 'permissions',
        attributes: ['id', 'key', 'name', 'description', 'category'],
        through: { attributes: [] }
      }]
    });

    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    res.status(200).json({
      success: true,
      data: role
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create new platform admin role
 */
exports.createRole = async (req, res, next) => {
  try {
    const { name, department, description, permissionIds } = req.body;

    if (!name || !department) {
      return res.status(400).json({
        success: false,
        message: 'Name and department are required'
      });
    }

    // Check if role name already exists
    const existing = await PlatformAdminRole.findOne({ where: { name } });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Role with this name already exists'
      });
    }

    const role = await PlatformAdminRole.create({
      name,
      department,
      description: description || null,
      isDefault: false
    });

    // Assign permissions if provided
    if (permissionIds && Array.isArray(permissionIds) && permissionIds.length > 0) {
      await role.setPermissions(permissionIds);
    }

    const createdRole = await PlatformAdminRole.findByPk(role.id, {
      include: [{
        model: PlatformAdminPermission,
        as: 'permissions',
        attributes: ['id', 'key', 'name', 'category'],
        through: { attributes: [] }
      }]
    });

    res.status(201).json({
      success: true,
      data: createdRole
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update platform admin role
 */
exports.updateRole = async (req, res, next) => {
  try {
    const role = await PlatformAdminRole.findByPk(req.params.id);
    
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    // Prevent updating default roles
    if (role.isDefault) {
      return res.status(400).json({
        success: false,
        message: 'Cannot update default roles'
      });
    }

    const { name, department, description } = req.body;

    // Check if new name conflicts with existing role
    if (name && name !== role.name) {
      const existing = await PlatformAdminRole.findOne({ where: { name } });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'Role with this name already exists'
        });
      }
    }

    await role.update({
      name: name || role.name,
      department: department || role.department,
      description: description !== undefined ? description : role.description
    });

    const updatedRole = await PlatformAdminRole.findByPk(role.id, {
      include: [{
        model: PlatformAdminPermission,
        as: 'permissions',
        attributes: ['id', 'key', 'name', 'category'],
        through: { attributes: [] }
      }]
    });

    res.status(200).json({
      success: true,
      data: updatedRole
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete platform admin role
 */
exports.deleteRole = async (req, res, next) => {
  try {
    const role = await PlatformAdminRole.findByPk(req.params.id);
    
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    // Prevent deleting default roles
    if (role.isDefault) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete default roles'
      });
    }

    // Check if role is assigned to any users
    const userCount = await PlatformAdminUserRole.count({
      where: { roleId: role.id }
    });

    if (userCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete role. It is assigned to ${userCount} user(s)`
      });
    }

    await role.destroy();

    res.status(200).json({
      success: true,
      message: 'Role deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Assign permissions to role
 */
exports.assignPermissionsToRole = async (req, res, next) => {
  try {
    const role = await PlatformAdminRole.findByPk(req.params.id);
    
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    const { permissionIds } = req.body;

    if (!Array.isArray(permissionIds)) {
      return res.status(400).json({
        success: false,
        message: 'permissionIds must be an array'
      });
    }

    // Verify all permission IDs exist
    const permissions = await PlatformAdminPermission.findAll({
      where: { id: { [Op.in]: permissionIds } }
    });

    if (permissions.length !== permissionIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Some permission IDs are invalid'
      });
    }

    await role.setPermissions(permissionIds);

    const updatedRole = await PlatformAdminRole.findByPk(role.id, {
      include: [{
        model: PlatformAdminPermission,
        as: 'permissions',
        attributes: ['id', 'key', 'name', 'category'],
        through: { attributes: [] }
      }]
    });

    res.status(200).json({
      success: true,
      data: updatedRole
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all platform admin permissions
 */
exports.getPermissions = async (req, res, next) => {
  try {
    const permissions = await PlatformAdminPermission.findAll({
      order: [['category', 'ASC'], ['name', 'ASC']]
    });

    // Group by category
    const grouped = permissions.reduce((acc, perm) => {
      if (!acc[perm.category]) {
        acc[perm.category] = [];
      }
      acc[perm.category].push(perm);
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      data: permissions,
      grouped
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get roles for a platform admin user
 */
exports.getUserRoles = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.userId, {
      where: { isPlatformAdmin: true }
    });

    if (!user || !user.isPlatformAdmin) {
      return res.status(404).json({
        success: false,
        message: 'Platform admin user not found'
      });
    }

    const userRoles = await PlatformAdminUserRole.findAll({
      where: { userId: user.id },
      include: [{
        model: PlatformAdminRole,
        as: 'role',
        include: [{
          model: PlatformAdminPermission,
          as: 'permissions',
          attributes: ['id', 'key', 'name', 'category'],
          through: { attributes: [] }
        }]
      }]
    });

    res.status(200).json({
      success: true,
      data: userRoles.map(ur => ur.role)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Assign role to user
 */
exports.assignRoleToUser = async (req, res, next) => {
  try {
    const { roleId } = req.body;
    const userId = req.params.userId;

    const user = await User.findByPk(userId);
    if (!user || !user.isPlatformAdmin) {
      return res.status(404).json({
        success: false,
        message: 'Platform admin user not found'
      });
    }

    const role = await PlatformAdminRole.findByPk(roleId);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    // Check if already assigned
    const existing = await PlatformAdminUserRole.findOne({
      where: { userId, roleId }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Role already assigned to user'
      });
    }

    await PlatformAdminUserRole.create({ userId, roleId });

    const userRoles = await PlatformAdminUserRole.findAll({
      where: { userId },
      include: [{
        model: PlatformAdminRole,
        as: 'role',
        include: [{
          model: PlatformAdminPermission,
          as: 'permissions',
          attributes: ['id', 'key', 'name', 'category'],
          through: { attributes: [] }
        }]
      }]
    });

    res.status(201).json({
      success: true,
      data: userRoles.map(ur => ur.role)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove role from user
 */
exports.removeRoleFromUser = async (req, res, next) => {
  try {
    const { userId, roleId } = req.params;

    const userRole = await PlatformAdminUserRole.findOne({
      where: { userId, roleId }
    });

    if (!userRole) {
      return res.status(404).json({
        success: false,
        message: 'Role assignment not found'
      });
    }

    // Prevent removing last role if it's the only one
    const userRoleCount = await PlatformAdminUserRole.count({
      where: { userId }
    });

    if (userRoleCount === 1) {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove the last role from a user'
      });
    }

    await userRole.destroy();

    res.status(200).json({
      success: true,
      message: 'Role removed from user successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get effective permissions for a user (union of all role permissions)
 */
exports.getUserPermissions = async (req, res, next) => {
  try {
    const userId = req.params.userId;

    const user = await User.findByPk(userId);
    if (!user || !user.isPlatformAdmin) {
      return res.status(404).json({
        success: false,
        message: 'Platform admin user not found'
      });
    }

    const userRoles = await PlatformAdminUserRole.findAll({
      where: { userId },
      include: [{
        model: PlatformAdminRole,
        as: 'role',
        include: [{
          model: PlatformAdminPermission,
          as: 'permissions',
          attributes: ['id', 'key', 'name', 'description', 'category'],
          through: { attributes: [] }
        }]
      }]
    });

    // Union all permissions from all roles
    const permissionMap = new Map();
    userRoles.forEach(userRole => {
      if (userRole.role && userRole.role.permissions) {
        userRole.role.permissions.forEach(perm => {
          if (!permissionMap.has(perm.key)) {
            permissionMap.set(perm.key, perm);
          }
        });
      }
    });

    const permissions = Array.from(permissionMap.values());

    // Group by category
    const grouped = permissions.reduce((acc, perm) => {
      if (!acc[perm.category]) {
        acc[perm.category] = [];
      }
      acc[perm.category].push(perm);
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      data: permissions,
      grouped,
      roles: userRoles.map(ur => ({
        id: ur.role.id,
        name: ur.role.name,
        department: ur.role.department
      }))
    });
  } catch (error) {
    next(error);
  }
};
