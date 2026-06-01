const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { StudioLocation, User, UserStudioLocation, UserTenant } = require('../models');
const { applyTenantFilter, sanitizePayload } = require('../utils/tenantUtils');
const { getPagination } = require('../utils/paginationUtils');
const {
  isStudioTenant,
  hasWorkspaceWideStudioAccess,
  setUserStudioLocations,
  getUserStudioLocationIds,
} = require('../utils/studioLocationUtils');
const {
  validateManagerUserId,
  ensureManagerStudioAccess,
} = require('../utils/branchManagerUtils');
const { fileToDataUrl } = require('../utils/branchLogoUpload');
const { validateBranchLimit } = require('../utils/branchLimitHelper');

const managerInclude = {
  model: User,
  as: 'manager',
  attributes: ['id', 'name', 'email', 'role'],
  required: false,
};

const WRITABLE_STUDIO_FIELDS = [
  'name',
  'code',
  'address',
  'city',
  'state',
  'country',
  'postalCode',
  'phone',
  'email',
  'managerUserId',
  'logoUrl',
  'isActive',
  'isDefault',
  'metadata',
];

let studioTypeColumnExists;

/**
 * Whether studio_locations has the studioType column (migration may not have run yet).
 * @returns {Promise<boolean>}
 */
const hasStudioTypeColumn = async () => {
  if (studioTypeColumnExists !== undefined) return studioTypeColumnExists;
  try {
    const table = await sequelize.getQueryInterface().describeTable('studio_locations');
    studioTypeColumnExists = Object.prototype.hasOwnProperty.call(table, 'studioType');
  } catch {
    studioTypeColumnExists = false;
  }
  return studioTypeColumnExists;
};

/**
 * Keep only attributes that exist on StudioLocation (avoids failed updates when migrations lag).
 * @param {object} payload
 * @returns {Promise<object>}
 */
const pickStudioLocationFields = async (payload) => {
  const allowed = [...WRITABLE_STUDIO_FIELDS];
  if (await hasStudioTypeColumn()) allowed.push('studioType');

  const picked = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      picked[key] = payload[key];
    }
  }
  return picked;
};

/**
 * Empty code must be NULL — partial unique index treats '' as a value and blocks duplicates.
 * @param {string|null|undefined} code
 * @returns {string|null}
 */
const normalizeStudioCode = (code) => {
  if (code == null) return null;
  const trimmed = String(code).trim();
  return trimmed || null;
};

/**
 * @param {string} tenantId
 * @param {string|null} code
 * @param {string} [excludeId]
 */
const assertUniqueStudioCode = async (tenantId, code, excludeId) => {
  if (!code) return;

  const where = applyTenantFilter(tenantId, { code });
  if (excludeId) where.id = { [Op.ne]: excludeId };

  const existing = await StudioLocation.findOne({
    where,
    attributes: ['id', 'name'],
  });

  if (existing) {
    const err = new Error(
      `Location code "${code}" is already used by "${existing.name}". Choose a different code or leave it blank.`
    );
    err.statusCode = 400;
    throw err;
  }
};

const mapStudioUniqueConstraintError = (error) => {
  if (error?.name !== 'SequelizeUniqueConstraintError') return null;

  const constraint = String(
    error.parent?.constraint || error.errors?.[0]?.path || ''
  ).toLowerCase();

  if (constraint.includes('code') || constraint.includes('tenant_code')) {
    const err = new Error(
      'Another studio location in this workspace already uses that code. Use a unique code or leave it blank.'
    );
    err.statusCode = 400;
    return err;
  }

  return null;
};

const prepareStudioPayload = async (tenantId, payload) => {
  const next = await pickStudioLocationFields(payload);

  if (Object.prototype.hasOwnProperty.call(next, 'name')) {
    next.name = String(next.name ?? '').trim();
    if (!next.name) {
      const err = new Error('Studio name is required');
      err.statusCode = 400;
      throw err;
    }
  }

  if (Object.prototype.hasOwnProperty.call(next, 'code')) {
    next.code = normalizeStudioCode(next.code);
  }

  if (Object.prototype.hasOwnProperty.call(next, 'studioType')) {
    next.studioType = next.studioType ? String(next.studioType).trim() : null;
  }

  if (Object.prototype.hasOwnProperty.call(next, 'managerUserId')) {
    const check = await validateManagerUserId({
      tenantId,
      managerUserId: next.managerUserId,
    });
    if (!check.ok) {
      const err = new Error(check.message);
      err.statusCode = 400;
      throw err;
    }
    next.managerUserId = check.managerUserId;
  }
  return next;
};

const assertStudioTenant = (req, res) => {
  if (!isStudioTenant(req.tenant)) {
    res.status(400).json({
      success: false,
      message: 'Studio locations are only available for studio workspaces',
    });
    return false;
  }
  return true;
};

// @desc    List studio locations
// @route   GET /api/studio-locations
exports.getStudioLocations = async (req, res, next) => {
  try {
    if (!assertStudioTenant(req, res)) return;

    const { page, limit, offset } = getPagination(req);
    const search = req.query.search || '';

    const where = applyTenantFilter(req.tenantId, { isActive: true });
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { code: { [Op.iLike]: `%${search}%` } },
        { city: { [Op.iLike]: `%${search}%` } },
      ];
    }

    if (!req.canAccessAllStudioLocations && req.allowedStudioLocationIds?.length) {
      where.id = { [Op.in]: req.allowedStudioLocationIds };
    }

    const { count, rows } = await StudioLocation.findAndCountAll({
      where,
      limit,
      offset,
      order: [
        ['isDefault', 'DESC'],
        ['name', 'ASC'],
      ],
      include: [managerInclude],
    });

    res.status(200).json({
      success: true,
      count,
      pagination: { page, limit, totalPages: Math.ceil(count / limit) },
      data: rows,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Accessible locations for current user (switcher)
// @route   GET /api/studio-locations/access
exports.getStudioLocationAccess = async (req, res, next) => {
  try {
    if (!assertStudioTenant(req, res)) return;

    const where = applyTenantFilter(req.tenantId, { isActive: true });
    if (!req.canAccessAllStudioLocations && req.allowedStudioLocationIds?.length) {
      where.id = { [Op.in]: req.allowedStudioLocationIds };
    }

    const locations = await StudioLocation.findAll({
      where,
      order: [
        ['isDefault', 'DESC'],
        ['name', 'ASC'],
      ],
    });

    res.status(200).json({
      success: true,
      data: {
        locations,
        canAccessAll: !!req.canAccessAllStudioLocations,
        activeStudioLocationId: req.studioLocationFilterId || null,
        defaultStudioLocationId: req.defaultStudioLocationId,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single studio location
// @route   GET /api/studio-locations/:id
exports.getStudioLocation = async (req, res, next) => {
  try {
    if (!assertStudioTenant(req, res)) return;

    const location = await StudioLocation.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id }),
      include: [managerInclude],
    });

    if (!location) {
      return res.status(404).json({ success: false, message: 'Studio location not found' });
    }

    if (
      !req.canAccessAllStudioLocations &&
      !req.allowedStudioLocationIds?.includes(location.id)
    ) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.status(200).json({ success: true, data: location });
  } catch (error) {
    next(error);
  }
};

// @desc    Create studio location
// @route   POST /api/studio-locations
exports.createStudioLocation = async (req, res, next) => {
  try {
    if (!assertStudioTenant(req, res)) return;

    const payload = await prepareStudioPayload(req.tenantId, sanitizePayload(req.body));
    await assertUniqueStudioCode(req.tenantId, payload.code);

    const isFirst =
      (await StudioLocation.count({ where: { tenantId: req.tenantId } })) === 0;
    if (!isFirst) {
      await validateBranchLimit(req.tenantId, 'studioLocation');
    }

    const location = await StudioLocation.create({
      ...payload,
      tenantId: req.tenantId,
      isDefault: isFirst ? true : Boolean(payload.isDefault),
    });

    if (location.isDefault && !isFirst) {
      await StudioLocation.update(
        { isDefault: false },
        {
          where: {
            tenantId: req.tenantId,
            id: { [Op.ne]: location.id },
          },
        }
      );
    }

    if (hasWorkspaceWideStudioAccess(req.tenantRole)) {
      await UserStudioLocation.findOrCreate({
        where: {
          userId: req.user.id,
          studioLocationId: location.id,
        },
        defaults: { tenantId: req.tenantId },
      });
    }

    if (location.managerUserId) {
      await ensureManagerStudioAccess(location.managerUserId, req.tenantId, location.id);
    }

    await location.reload({ include: [managerInclude] });

    res.status(201).json({ success: true, data: location });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.statusCode === 403 && error.code === 'BRANCH_LIMIT_EXCEEDED') {
      return res.status(403).json({ success: false, message: error.message, details: error.details });
    }
    const mapped = mapStudioUniqueConstraintError(error);
    if (mapped) {
      return res.status(400).json({ success: false, message: mapped.message });
    }
    next(error);
  }
};

// @desc    Update studio location
// @route   PUT /api/studio-locations/:id
exports.updateStudioLocation = async (req, res, next) => {
  try {
    if (!assertStudioTenant(req, res)) return;

    const location = await StudioLocation.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id }),
      include: [managerInclude],
    });

    if (!location) {
      return res.status(404).json({ success: false, message: 'Studio location not found' });
    }

    const payload = await prepareStudioPayload(req.tenantId, sanitizePayload(req.body));
    await assertUniqueStudioCode(req.tenantId, payload.code, location.id);
    await location.update(payload);

    if (payload.isDefault) {
      await StudioLocation.update(
        { isDefault: false },
        {
          where: {
            tenantId: req.tenantId,
            id: { [Op.ne]: location.id },
          },
        }
      );
    }

    if (location.managerUserId) {
      await ensureManagerStudioAccess(location.managerUserId, req.tenantId, location.id);
    }

    await location.reload({ include: [managerInclude] });

    res.status(200).json({ success: true, data: location });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }
    const mapped = mapStudioUniqueConstraintError(error);
    if (mapped) {
      return res.status(400).json({ success: false, message: mapped.message });
    }
    next(error);
  }
};

// @desc    Upload studio location logo
// @route   POST /api/studio-locations/:id/logo
exports.uploadStudioLocationLogo = async (req, res, next) => {
  try {
    if (!assertStudioTenant(req, res)) return;

    const location = await StudioLocation.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id }),
    });

    if (!location) {
      return res.status(404).json({ success: false, message: 'Studio location not found' });
    }

    if (
      !req.canAccessAllStudioLocations &&
      !req.allowedStudioLocationIds?.includes(location.id)
    ) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const logoUrl = await fileToDataUrl(req.file);
    await location.update({ logoUrl });
    await location.reload({ include: [managerInclude] });

    res.status(200).json({ success: true, data: location });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

// @desc    Delete studio location
// @route   DELETE /api/studio-locations/:id
exports.deleteStudioLocation = async (req, res, next) => {
  try {
    if (!assertStudioTenant(req, res)) return;

    const location = await StudioLocation.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id }),
      include: [managerInclude],
    });

    if (!location) {
      return res.status(404).json({ success: false, message: 'Studio location not found' });
    }

    const total = await StudioLocation.count({ where: { tenantId: req.tenantId } });
    if (total <= 1) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete the only studio location for this workspace',
      });
    }

    await location.destroy();

    if (location.isDefault) {
      const fallback = await StudioLocation.findOne({
        where: { tenantId: req.tenantId },
        order: [['createdAt', 'ASC']],
      });
      if (fallback) await fallback.update({ isDefault: true });
    }

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};

// @desc    Assign studio locations to a workspace user
// @route   PUT /api/studio-locations/users/:userId/assignments
exports.setUserStudioLocationAssignments = async (req, res, next) => {
  try {
    if (!assertStudioTenant(req, res)) return;

    if (!hasWorkspaceWideStudioAccess(req.tenantRole)) {
      return res.status(403).json({
        success: false,
        message: 'Only workspace administrators can assign studio locations',
      });
    }

    const { userId } = req.params;
    const { studioLocationIds = [] } = req.body || {};

    const membership = await UserTenant.findOne({
      where: { userId, tenantId: req.tenantId, status: 'active' },
    });

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: 'User is not an active member of this workspace',
      });
    }

    if (hasWorkspaceWideStudioAccess(membership.role)) {
      return res.status(400).json({
        success: false,
        message: 'Workspace owners and admins have access to all studio locations',
      });
    }

    await setUserStudioLocations(userId, req.tenantId, studioLocationIds);

    const ids = await getUserStudioLocationIds(userId, req.tenantId, membership.role);

    res.status(200).json({
      success: true,
      data: { userId, studioLocationIds: ids },
    });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

// @desc    Get studio location assignments for a user
// @route   GET /api/studio-locations/users/:userId/assignments
exports.getUserStudioLocationAssignments = async (req, res, next) => {
  try {
    if (!assertStudioTenant(req, res)) return;

    if (!hasWorkspaceWideStudioAccess(req.tenantRole)) {
      return res.status(403).json({
        success: false,
        message: 'Only workspace administrators can view studio location assignments',
      });
    }

    const { userId } = req.params;
    const membership = await UserTenant.findOne({
      where: { userId, tenantId: req.tenantId, status: 'active' },
      include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }],
    });

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: 'User is not an active member of this workspace',
      });
    }

    const assignments = await UserStudioLocation.findAll({
      where: { userId, tenantId: req.tenantId },
      include: [{ model: StudioLocation, as: 'studioLocation' }],
    });

    res.status(200).json({
      success: true,
      data: {
        user: membership.user,
        role: membership.role,
        studioLocationIds: assignments.map((a) => a.studioLocationId),
        locations: assignments.map((a) => a.studioLocation).filter(Boolean),
      },
    });
  } catch (error) {
    next(error);
  }
};
