const path = require('path');
const fs = require('fs');
const { Setting, User } = require('../models');
const { baseUploadDir } = require('../middleware/upload');

const getSettingValue = async (key, fallback = {}) => {
  const setting = await Setting.findOne({ where: { key } });
  return setting ? setting.value : fallback;
};

const upsertSettingValue = async (key, value, description = null) => {
  const [setting, created] = await Setting.findOrCreate({
    where: { key },
    defaults: {
      key,
      value,
      description
    }
  });

  if (!created) {
    setting.value = value;
    if (description !== null) {
      setting.description = description;
    }
    await setting.save();
  }

  return setting.value;
};

const deleteFileIfExists = async (fileUrl) => {
  if (!fileUrl || !fileUrl.startsWith('/uploads/')) {
    return;
  }

  const relativePath = fileUrl.replace('/uploads/', '').split('/').join(path.sep);
  const absolutePath = path.join(baseUploadDir, relativePath);
  try {
    await fs.promises.unlink(absolutePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Failed to delete file:', absolutePath, error);
    }
  }
};

const buildPublicUrl = (storagePath) => `/uploads/${storagePath.replace(/\\/g, '/')}`;

exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const { name, profilePicture, password, currentPassword } = req.body;

    if (name !== undefined) {
      user.name = name;
    }

    if (profilePicture !== undefined) {
      if (!profilePicture && user.profilePicture) {
        await deleteFileIfExists(user.profilePicture);
      }
      user.profilePicture = profilePicture;
    }

    if (password) {
      if (!currentPassword) {
        return res.status(400).json({ success: false, message: 'Current password is required to set a new password' });
      }

      const matches = await user.comparePassword(currentPassword);
      if (!matches) {
        return res.status(400).json({ success: false, message: 'Current password is incorrect' });
      }

      user.password = password;
    }

    await user.save();

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

exports.uploadProfilePicture = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const storagePath = path.relative(baseUploadDir, req.file.path);
    const publicUrl = buildPublicUrl(storagePath);

    if (user.profilePicture && user.profilePicture !== publicUrl) {
      await deleteFileIfExists(user.profilePicture);
    }

    user.profilePicture = publicUrl;
    await user.save();

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

exports.getOrganizationSettings = async (req, res, next) => {
  try {
    const organization = await getSettingValue('organization', {});
    res.status(200).json({ success: true, data: organization });
  } catch (error) {
    next(error);
  }
};

exports.updateOrganizationSettings = async (req, res, next) => {
  try {
    const existing = await getSettingValue('organization', {});
    const incoming = req.body || {};

    if (!incoming.logoUrl && existing.logoUrl && existing.logoUrl !== incoming.logoUrl) {
      await deleteFileIfExists(existing.logoUrl);
    }

    const updated = await upsertSettingValue('organization', incoming);
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

exports.uploadOrganizationLogo = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const organization = await getSettingValue('organization', {});
    const storagePath = path.relative(baseUploadDir, req.file.path);
    const publicUrl = buildPublicUrl(storagePath);

    if (organization.logoUrl && organization.logoUrl !== publicUrl) {
      await deleteFileIfExists(organization.logoUrl);
    }

    organization.logoUrl = publicUrl;
    const updated = await upsertSettingValue('organization', organization);

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

exports.getSubscriptionSettings = async (req, res, next) => {
  try {
    const subscription = await getSettingValue('subscription', {
      plan: 'free',
      seats: 5,
      status: 'active',
      currentPeriodEnd: null,
      paymentMethod: null,
      history: []
    });
    res.status(200).json({ success: true, data: subscription });
  } catch (error) {
    next(error);
  }
};

exports.updateSubscriptionSettings = async (req, res, next) => {
  try {
    const updated = await upsertSettingValue('subscription', req.body || {});
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

