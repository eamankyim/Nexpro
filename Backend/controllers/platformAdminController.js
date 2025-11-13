const { User } = require('../models');

exports.listPlatformAdmins = async (req, res, next) => {
  try {
    const admins = await User.findAll({
      where: { isPlatformAdmin: true },
      attributes: ['id', 'name', 'email', 'isActive', 'lastLogin', 'createdAt', 'updatedAt'],
      order: [['createdAt', 'ASC']]
    });

    res.status(200).json({
      success: true,
      data: admins
    });
  } catch (error) {
    next(error);
  }
};

exports.createPlatformAdmin = async (req, res, next) => {
  try {
    const { name, email, password, isActive = true } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ where: { email: normalizedEmail } });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'A user with this email already exists'
      });
    }

    const admin = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: 'admin',
      isPlatformAdmin: true,
      isActive
    });

    res.status(201).json({
      success: true,
      data: admin
    });
  } catch (error) {
    next(error);
  }
};

exports.updatePlatformAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, password, isActive } = req.body || {};

    const admin = await User.findOne({
      where: { id, isPlatformAdmin: true }
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Platform admin not found'
      });
    }

    if (name !== undefined) {
      admin.name = name;
    }
    if (isActive !== undefined) {
      admin.isActive = Boolean(isActive);
    }
    if (password) {
      admin.password = password;
    }

    await admin.save();

    res.status(200).json({
      success: true,
      data: admin
    });
  } catch (error) {
    next(error);
  }
};


