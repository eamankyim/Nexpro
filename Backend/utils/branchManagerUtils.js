const { UserTenant, UserShop, UserStudioLocation } = require('../models');
const { setUserShops } = require('./shopUtils');
const { setUserStudioLocations } = require('./studioLocationUtils');

/**
 * Verify user is an active member of the workspace.
 * @param {string} userId
 * @param {string} tenantId
 * @returns {Promise<import('../models').UserTenant|null>}
 */
const getActiveTenantMembership = async (userId, tenantId) => {
  if (!userId || !tenantId) return null;
  return UserTenant.findOne({
    where: { userId, tenantId, status: 'active' },
  });
};

/**
 * Ensure manager has shop access when assigned as shop manager.
 * @param {string} userId
 * @param {string} tenantId
 * @param {string} shopId
 */
const ensureManagerShopAccess = async (userId, tenantId, shopId) => {
  if (!userId || !shopId) return;
  const membership = await getActiveTenantMembership(userId, tenantId);
  if (!membership) return;

  const existing = await UserShop.findOne({
    where: { userId, tenantId, shopId },
  });
  if (existing) return;

  const current = await UserShop.findAll({
    where: { userId, tenantId },
    attributes: ['shopId'],
  });
  const shopIds = [...new Set([...current.map((r) => r.shopId), shopId])];
  await setUserShops(userId, tenantId, shopIds);
};

/**
 * Ensure manager has studio location access when assigned as location manager.
 * @param {string} userId
 * @param {string} tenantId
 * @param {string} studioLocationId
 */
const ensureManagerStudioAccess = async (userId, tenantId, studioLocationId) => {
  if (!userId || !studioLocationId) return;
  const membership = await getActiveTenantMembership(userId, tenantId);
  if (!membership) return;

  const existing = await UserStudioLocation.findOne({
    where: { userId, tenantId, studioLocationId },
  });
  if (existing) return;

  const current = await UserStudioLocation.findAll({
    where: { userId, tenantId },
    attributes: ['studioLocationId'],
  });
  const ids = [...new Set([...current.map((r) => r.studioLocationId), studioLocationId])];
  await setUserStudioLocations(userId, tenantId, ids);
};

/**
 * Validate managerUserId for shop/studio update payloads.
 * @param {object} options
 * @param {string} options.tenantId
 * @param {string|null|undefined} options.managerUserId
 * @returns {Promise<{ ok: true, managerUserId: string|null }|{ ok: false, message: string }>}
 */
const validateManagerUserId = async ({ tenantId, managerUserId }) => {
  if (managerUserId === undefined) {
    return { ok: true, managerUserId: undefined };
  }
  if (managerUserId === null || managerUserId === '') {
    return { ok: true, managerUserId: null };
  }

  const membership = await getActiveTenantMembership(managerUserId, tenantId);
  if (!membership) {
    return {
      ok: false,
      message: 'Selected manager must be an active member of this workspace',
    };
  }
  return { ok: true, managerUserId };
};

module.exports = {
  getActiveTenantMembership,
  ensureManagerShopAccess,
  ensureManagerStudioAccess,
  validateManagerUserId,
};
