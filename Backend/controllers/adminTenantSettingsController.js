const {
  getTenantAdminSettings,
  updateTenantAdminSettings,
} = require('../services/tenantSettingsAdminService');

/**
 * @desc Get tenant settings editable by platform admins (invoice, sidebar defaults, etc.)
 * @route GET /api/admin/tenants/:id/settings
 * @access Platform admin (tenants.update)
 */
exports.getTenantSettings = async (req, res, next) => {
  try {
    const tenantId = req.params.id;
    const settings = await getTenantAdminSettings(tenantId);
    if (!settings) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Update tenant settings on behalf of a tenant
 * @route PATCH /api/admin/tenants/:id/settings
 * @access Platform admin (tenants.update)
 */
exports.updateTenantSettings = async (req, res, next) => {
  try {
    const tenantId = req.params.id;
    const { reason, ...settingsPayload } = req.body || {};

    const updated = await updateTenantAdminSettings({
      tenantId,
      actorUserId: req.user.id,
      payload: settingsPayload,
      reason: reason ? String(reason).trim().slice(0, 500) : '',
    });

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};
