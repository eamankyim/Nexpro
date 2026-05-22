const { Op } = require('sequelize');
const { Shop, StudioLocation } = require('../models');

/**
 * Formats a list of names for invite copy (e.g. "Shop A", "Shop A and Shop B").
 * @param {string[]} names
 * @returns {string}
 */
const formatNameList = (names) => {
  const list = (names || []).map((n) => String(n || '').trim()).filter(Boolean);
  if (list.length === 0) return '';
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(', ')}, and ${list[list.length - 1]}`;
};

/**
 * Resolves the name shown on invite signup and emails.
 * Priority: assigned shop(s) → assigned studio location(s) → workspace (tenant) name.
 * @param {object} options
 * @param {string|null} options.tenantId
 * @param {string} [options.tenantName]
 * @param {object} [options.metadata] - invite metadata with shopIds / studioLocationIds
 * @returns {Promise<{ displayName: string, shops: Array<{id:string,name:string}>, studioLocations: Array<{id:string,name:string}> }>}
 */
const resolveInviteTargetDisplay = async ({ tenantId, tenantName, metadata = {} }) => {
  const fallback = tenantName || 'this business';
  const shopIds = Array.isArray(metadata?.shopIds) ? metadata.shopIds.filter(Boolean) : [];
  const studioLocationIds = Array.isArray(metadata?.studioLocationIds)
    ? metadata.studioLocationIds.filter(Boolean)
    : [];

  if (!tenantId) {
    return { displayName: fallback, shops: [], studioLocations: [] };
  }

  if (shopIds.length > 0) {
    const shops = await Shop.findAll({
      where: { tenantId, id: { [Op.in]: shopIds }, isActive: true },
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
    });
    const names = shops.map((s) => s.name).filter(Boolean);
    if (names.length > 0) {
      return {
        displayName: formatNameList(names),
        shops: shops.map((s) => ({ id: s.id, name: s.name })),
        studioLocations: [],
      };
    }
  }

  if (studioLocationIds.length > 0) {
    const studioLocations = await StudioLocation.findAll({
      where: { tenantId, id: { [Op.in]: studioLocationIds }, isActive: true },
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
    });
    const names = studioLocations.map((l) => l.name).filter(Boolean);
    if (names.length > 0) {
      return {
        displayName: formatNameList(names),
        shops: [],
        studioLocations: studioLocations.map((l) => ({ id: l.id, name: l.name })),
      };
    }
  }

  return { displayName: fallback, shops: [], studioLocations: [] };
};

/**
 * Adds targetDisplayName and assignment summaries to a plain invite object.
 * @param {object} invite - Sequelize instance or plain object with tenantId, metadata, tenant
 * @returns {Promise<object>}
 */
const enrichInviteForDisplay = async (invite) => {
  const plain = typeof invite?.toJSON === 'function' ? invite.toJSON() : { ...invite };
  const tenantId = plain.tenantId || plain.tenant?.id;
  const tenantName = plain.tenant?.name;
  const metadata =
    plain.metadata && typeof plain.metadata === 'object' ? plain.metadata : {};

  const { displayName, shops, studioLocations } = await resolveInviteTargetDisplay({
    tenantId,
    tenantName,
    metadata,
  });

  return {
    ...plain,
    targetDisplayName: displayName,
    assignedShops: shops,
    assignedStudioLocations: studioLocations,
  };
};

module.exports = {
  formatNameList,
  resolveInviteTargetDisplay,
  enrichInviteForDisplay,
};
