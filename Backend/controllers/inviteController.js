const crypto = require('crypto');
const { InviteToken, User } = require('../models');
const { Op } = require('sequelize');

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
    console.log('📧 Generating invite for:', { email, role, name, expiresInDays });

    // Validate required fields
    if (!email || !role) {
      console.log('❌ Missing required fields:', { email, role });
      return res.status(400).json({
        success: false,
        message: 'Email and role are required'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      console.log('❌ User already exists:', email);
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Check for existing unused invite
    const existingInvite = await InviteToken.findOne({
      where: {
        email,
        used: false,
        expiresAt: {
          [Op.gt]: new Date()
        }
      }
    });

    if (existingInvite) {
      console.log('❌ Active invite already exists:', email);
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

    console.log('✅ No existing invite found, creating new one...');

    // Generate token
    const token = generateToken();

    // Calculate expiration (default 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (expiresInDays || 7));

    // Create invite
    const invite = await InviteToken.create({
      token,
      email,
      role,
      name,
      createdBy: req.user.id,
      expiresAt
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
    console.error('💥 Error generating invite:', error.message);
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
    console.error('💥 Error generating invite:', error.message);
    console.error('Full error:', error);
    next(error);
  }
};

// @desc    Get all invites
// @route   GET /api/invites
// @access  Private/Admin
exports.getInvites = async (req, res, next) => {
  try {
    const { used, search } = req.query;

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
      where,
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
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
      success: true,
      count: invites.length,
      data: invites
    });
  } catch (error) {
    console.error('💥 Error generating invite:', error.message);
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

    const invite = await InviteToken.findByPk(id);

    if (!invite) {
      return res.status(404).json({
        success: false,
        message: 'Invite not found'
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
    console.error('💥 Error generating invite:', error.message);
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

    const invite = await InviteToken.findOne({ where: { token } });

    if (!invite) {
      return res.status(404).json({
        success: false,
        message: 'Invalid invite token'
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
    console.error('💥 Error generating invite:', error.message);
    console.error('Full error:', error);
    next(error);
  }
};

