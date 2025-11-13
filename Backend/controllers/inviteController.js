const crypto = require('crypto');
const { InviteToken, User, Tenant } = require('../models');
const { Op } = require('sequelize');
const { applyTenantFilter, sanitizePayload } = require('../utils/tenantUtils');
const { validateSeatLimit, getSeatUsageSummary } = require('../utils/seatLimitHelper');
const { getStorageUsageSummary } = require('../utils/storageLimitHelper');

// Generate a random 32-character token
const generateToken = () => {
  return crypto.randomBytes(16).toString('hex');
};

// @desc    Generate invite token
// @route   POST /api/invites
// @access  Private/Admin
exports.generateInvite = async (req, res, next) => {
  try {
    const { email, role, name, expiresInDays } = req.body;
    console.log('[Invite] Generating invite for:', { email, role, name, expiresInDays });

    // Validate required fields
    if (!email || !role) {
      console.log('[Invite] Missing required fields:', { email, role });
      return res.status(400).json({
        success: false,
        message: 'Email and role are required'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      where: { email }
    });
    if (existingUser) {
      console.log('[Invite] User already exists:', email);
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Check for existing unused invite
    const existingInvite = await InviteToken.findOne({
      where: applyTenantFilter(req.tenantId, {
        email,
        used: false,
        expiresAt: {
          [Op.gt]: new Date()
        }
      })
    });

    if (existingInvite) {
      console.log('[Invite] Active invite already exists:', email);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const existingInviteUrl = `${frontendUrl}/signup?token=${existingInvite.token}`;
      return res.status(400).json({
        success: false,
        message: 'An active invite already exists for this email. You can revoke it or use the existing link.',
        data: {
          invite: existingInvite,
          inviteUrl: existingInviteUrl
        }
      });
    }

    console.log('[Invite] No existing invite found, creating new one...');

    // Check seat limit before creating invite
    try {
      await validateSeatLimit(req.tenantId);
    } catch (error) {
      if (error.code === 'SEAT_LIMIT_EXCEEDED') {
        console.log('[Invite] Seat limit exceeded:', error.message);
        return res.status(403).json({
          success: false,
          message: error.message,
          code: 'SEAT_LIMIT_EXCEEDED',
          details: error.details
        });
      }
      throw error;
    }

    // Generate token
    const token = generateToken();

    // Calculate expiration (default 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (expiresInDays || 7));

    // Create invite
    const invitePayload = sanitizePayload({
      token,
      email,
      role,
      name,
      createdBy: req.user.id,
      expiresAt
    });

    const invite = await InviteToken.create({
      ...invitePayload,
      tenantId: req.tenantId
    });

    // Generate invite URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const inviteUrl = `${frontendUrl}/signup?token=${token}`;

    res.status(201).json({
      success: true,
      data: {
        invite,
        inviteUrl
      }
    });
  } catch (error) {
    console.error('[Invite] Error generating invite:', error.message);
    console.error('Full error:', error);
    next(error);
  }
};

// @desc    Validate invite token
// @route   GET /api/invites/validate/:token
// @access  Public
exports.validateInvite = async (req, res, next) => {
  try {
    const { token } = req.params;

    const invite = await InviteToken.findOne({
      where: { token },
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name', 'email']
        },
        {
          model: Tenant,
          as: 'tenant'
        }
      ]
    });

    if (!invite) {
      return res.status(404).json({
        success: false,
        message: 'Invalid invite token'
      });
    }

    if (invite.used) {
      return res.status(400).json({
        success: false,
        message: 'This invite has already been used'
      });
    }

    if (invite.expiresAt && new Date() > invite.expiresAt) {
      return res.status(400).json({
        success: false,
        message: 'This invite has expired'
      });
    }

    res.status(200).json({
      success: true,
      data: invite
    });
  } catch (error) {
    console.error('[Invite] Error generating invite:', error.message);
    console.error('Full error:', error);
    next(error);
  }
};

// @desc    Get seat usage for current tenant
// @route   GET /api/invites/seat-usage
// @access  Private
exports.getSeatUsage = async (req, res, next) => {
  try {
    const seatUsage = await getSeatUsageSummary(req.tenantId);

    res.status(200).json({
      success: true,
      data: seatUsage
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get storage usage for current tenant
// @route   GET /api/invites/storage-usage
// @access  Private
exports.getStorageUsage = async (req, res, next) => {
  try {
    const storageUsage = await getStorageUsageSummary(req.tenantId);

    res.status(200).json({
      success: true,
      data: storageUsage
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all invites
// @route   GET /api/invites
// @access  Private/Admin
exports.getInvites = async (req, res, next) => {
  try {
    const { used, search } = req.query;
    
    // Get seat usage to include in response
    const seatUsage = await getSeatUsageSummary(req.tenantId).catch(() => null);

    const where = {};
    if (used === 'true') {
      where.used = true;
    } else if (used === 'false') {
      where.used = false;
    }

    if (search) {
      where[Op.or] = [
        { email: { [Op.iLike]: `%${search}%` } },
        { name: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const invites = await InviteToken.findAll({
      where: applyTenantFilter(req.tenantId, where),
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name', 'email']
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email']
        },
        {
          model: Tenant,
          as: 'tenant'
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
      success: true,
      count: invites.length,
      data: invites,
      seatUsage // Include seat usage info for UI display
    });
  } catch (error) {
    console.error('[Invite] Error generating invite:', error.message);
    console.error('Full error:', error);
    next(error);
  }
};

// @desc    Revoke invite
// @route   DELETE /api/invites/:id
// @access  Private/Admin
exports.revokeInvite = async (req, res, next) => {
  try {
    const { id } = req.params;

    const invite = await InviteToken.findOne({
      where: applyTenantFilter(req.tenantId, { id })
    });

    if (!invite) {
      return res.status(404).json({
        success: false,
        message: 'Invite not found'
      });
    }

    if (invite.tenantId !== req.tenantId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to revoke this invite'
      });
    }

    if (invite.used) {
      return res.status(400).json({
        success: false,
        message: 'Cannot revoke an already used invite'
      });
    }

    await invite.destroy();

    res.status(200).json({
      success: true,
      message: 'Invite revoked successfully',
      data: {}
    });
  } catch (error) {
    console.error('[Invite] Error generating invite:', error.message);
    console.error('Full error:', error);
    next(error);
  }
};

// @desc    Use invite token (mark as used)
// @route   PUT /api/invites/:token/use
// @access  Private
exports.useInvite = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { userId } = req.body;

    const invite = await InviteToken.findOne({
      where: applyTenantFilter(req.tenantId, { token })
    });

    if (!invite) {
      return res.status(404).json({
        success: false,
        message: 'Invalid invite token'
      });
    }

    if (invite.tenantId !== req.tenantId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to use this invite'
      });
    }

    if (invite.used) {
      return res.status(400).json({
        success: false,
        message: 'Invite already used'
      });
    }

    await invite.update({
      used: true,
      usedAt: new Date(),
      usedBy: userId
    });

    res.status(200).json({
      success: true,
      message: 'Invite marked as used'
    });
  } catch (error) {
    console.error('[Invite] Error generating invite:', error.message);
    console.error('Full error:', error);
    next(error);
  }
};

