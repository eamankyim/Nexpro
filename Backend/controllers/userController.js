const { User, UserTenant } = require('../models');
const { Op } = require('sequelize');
const config = require('../config/config');

// @desc    Get all users for the current tenant
// @route   GET /api/users
// @access  Private/Admin
exports.getUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || config.pagination.defaultPageSize;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const role = req.query.role;
    const isActive = req.query.isActive;

    // Ensure tenantId is available (set by tenantContext middleware)
    if (!req.tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant context is required'
      });
    }

    // Build where clause for user search
    const userWhere = {};
    if (search) {
      userWhere[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } }
      ];
    }
    if (role && role !== 'null') {
      userWhere.role = role;
    }
    if (isActive && isActive !== 'null') {
      userWhere.isActive = isActive === 'true';
    }

    // Get users that belong to the current tenant through UserTenant relationship
    const { count, rows } = await User.findAndCountAll({
      where: userWhere,
      include: [
        {
          model: UserTenant,
          as: 'tenantMemberships',
          where: {
            tenantId: req.tenantId
          },
          required: true, // Inner join - only users with membership in this tenant
          attributes: ['role', 'status', 'isDefault', 'joinedAt']
        }
      ],
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      distinct: true // Important for count with includes
    });

    res.status(200).json({
      success: true,
      count,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(count / limit)
      },
      data: rows
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private/Admin
exports.getUser = async (req, res, next) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant context is required'
      });
    }

    // Verify user belongs to the current tenant
    const membership = await UserTenant.findOne({
      where: {
        userId: req.params.id,
        tenantId: req.tenantId
      }
    });

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: 'User not found in this tenant'
      });
    }

    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create user and add to tenant
// @route   POST /api/users
// @access  Private/Admin
exports.createUser = async (req, res, next) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant context is required'
      });
    }

    const { password, ...userData } = req.body;
    
    // Create user
    const user = await User.create({
      ...userData,
      password: password // Will be hashed by User model hook
    });

    // Add user to current tenant
    await UserTenant.create({
      userId: user.id,
      tenantId: req.tenantId,
      role: userData.role || 'staff',
      status: 'active',
      isDefault: true,
      joinedAt: new Date()
    });

    res.status(201).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private/Admin
exports.updateUser = async (req, res, next) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant context is required'
      });
    }

    // Verify user belongs to the current tenant
    const membership = await UserTenant.findOne({
      where: {
        userId: req.params.id,
        tenantId: req.tenantId
      }
    });

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: 'User not found in this tenant'
      });
    }

    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Don't allow updating password through this route
    const { password, ...updateData } = req.body;

    await user.update(updateData);

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user (remove from tenant, not delete user account)
// @route   DELETE /api/users/:id
// @access  Private/Admin
exports.deleteUser = async (req, res, next) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant context is required'
      });
    }

    // Verify user belongs to the current tenant
    const membership = await UserTenant.findOne({
      where: {
        userId: req.params.id,
        tenantId: req.tenantId
      }
    });

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: 'User not found in this tenant'
      });
    }

    // Remove user from tenant (don't delete the user account)
    await membership.destroy();

    res.status(200).json({
      success: true,
      message: 'User removed from tenant successfully',
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle user status
// @route   PUT /api/users/:id/toggle-status
// @access  Private/Admin
exports.toggleUserStatus = async (req, res, next) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant context is required'
      });
    }

    // Verify user belongs to the current tenant
    const membership = await UserTenant.findOne({
      where: {
        userId: req.params.id,
        tenantId: req.tenantId
      }
    });

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: 'User not found in this tenant'
      });
    }

    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await user.update({ isActive: !user.isActive });

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};


