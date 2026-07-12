const { Op } = require('sequelize');
const { User, UserTenant, Employee } = require('../models');

const STAFF_ROLES = Object.freeze(['owner', 'admin', 'manager', 'staff']);

/**
 * Normalize a recipient config from an action or rule default.
 * @param {object|null|undefined} raw
 * @returns {{ type: 'assignee'|'role'|'user', roles?: string[], userId?: string }|null}
 */
function normalizeRecipientConfig(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const type = String(raw.type || '').trim();
  if (type === 'assignee') return { type: 'assignee' };
  if (type === 'user') {
    const userId = raw.userId || raw.user_id || null;
    if (!userId) return null;
    return { type: 'user', userId: String(userId) };
  }
  if (type === 'role' || type === 'roles') {
    const rolesRaw = Array.isArray(raw.roles) ? raw.roles : (raw.role ? [raw.role] : []);
    const roles = [...new Set(
      rolesRaw
        .map((role) => String(role || '').trim().toLowerCase())
        .filter((role) => STAFF_ROLES.includes(role))
    )];
    if (!roles.length) return null;
    return { type: 'role', roles };
  }
  return null;
}

/**
 * Whether an action/rule should message internal staff (never customer contacts).
 * @param {object} params
 * @param {object} [params.action]
 * @param {object} [params.rule]
 * @returns {boolean}
 */
function isInternalAudience({ action = null, rule = null } = {}) {
  if (action?.audience === 'internal' || action?.audience === 'staff') return true;
  if (rule?.metadata?.audience === 'internal' || rule?.metadata?.audience === 'staff') return true;
  if (rule?.actionConfig?.audience === 'internal' || rule?.actionConfig?.audience === 'staff') return true;
  if (normalizeRecipientConfig(action?.recipient || rule?.actionConfig?.defaultRecipient)) return true;
  const triggerType = String(rule?.triggerType || '');
  if (triggerType.endsWith('_staff')) return true;
  return false;
}

/**
 * Resolve phone for a user from linked Employee record (User has no phone field).
 * @param {string} tenantId
 * @param {string[]} userIds
 * @returns {Promise<Map<string, string|null>>}
 */
async function loadEmployeePhonesByUserId(tenantId, userIds) {
  const map = new Map();
  if (!tenantId || !userIds?.length) return map;
  const employees = await Employee.findAll({
    where: {
      tenantId,
      userId: { [Op.in]: userIds },
      phone: { [Op.ne]: null },
    },
    attributes: ['userId', 'phone', 'email'],
  });
  for (const emp of employees) {
    if (!emp.userId) continue;
    if (emp.phone && !map.has(emp.userId)) {
      map.set(emp.userId, String(emp.phone).trim() || null);
    }
  }
  return map;
}

/**
 * Load User rows and attach Employee phone when available.
 * @param {string} tenantId
 * @param {string[]} userIds
 * @returns {Promise<Array<{ userId: string, name: string|null, email: string|null, phone: string|null, role?: string|null }>>}
 */
async function hydrateStaffContacts(tenantId, userIds, roleByUserId = new Map()) {
  const uniqueIds = [...new Set((userIds || []).filter(Boolean))];
  if (!uniqueIds.length) return [];
  const users = await User.findAll({
    where: { id: { [Op.in]: uniqueIds } },
    attributes: ['id', 'name', 'email'],
  });
  const phoneByUserId = await loadEmployeePhonesByUserId(tenantId, uniqueIds);
  return users.map((user) => ({
    userId: user.id,
    name: user.name || null,
    email: user.email || null,
    phone: phoneByUserId.get(user.id) || null,
    role: roleByUserId.get(user.id) || null,
  }));
}

/**
 * Resolve staff recipients for an automation messaging action.
 * Never returns customer/lead contacts — only tenant staff Users.
 *
 * @param {object} params
 * @param {string} params.tenantId
 * @param {object|null} [params.recipient] - { type: 'assignee'|'role'|'user', roles?, userId? }
 * @param {object} [params.triggerContext]
 * @returns {Promise<Array<{ userId: string, name: string|null, email: string|null, phone: string|null, role?: string|null }>>}
 */
async function resolveStaffRecipients({
  tenantId,
  recipient = null,
  triggerContext = {},
} = {}) {
  if (!tenantId) return [];

  const config = normalizeRecipientConfig(recipient);
  if (!config) return [];

  if (config.type === 'assignee') {
    const assigneeId =
      triggerContext.assigneeId
      || triggerContext.assignedTo
      || triggerContext.assignee?.id
      || null;
    if (!assigneeId) return [];
    return hydrateStaffContacts(tenantId, [assigneeId]);
  }

  if (config.type === 'user') {
    const membership = await UserTenant.findOne({
      where: { tenantId, userId: config.userId },
      attributes: ['userId', 'role'],
    });
    if (!membership) return [];
    const roleByUserId = new Map([[membership.userId, membership.role]]);
    return hydrateStaffContacts(tenantId, [membership.userId], roleByUserId);
  }

  if (config.type === 'role') {
    const memberships = await UserTenant.findAll({
      where: {
        tenantId,
        role: { [Op.in]: config.roles },
        status: { [Op.in]: ['active', 'invited'] },
      },
      attributes: ['userId', 'role'],
    });
    // Prefer active; if status filter is too strict for older rows, fall back without status
    let rows = memberships;
    if (!rows.length) {
      rows = await UserTenant.findAll({
        where: { tenantId, role: { [Op.in]: config.roles } },
        attributes: ['userId', 'role'],
      });
    }
    const roleByUserId = new Map();
    const userIds = [];
    for (const row of rows) {
      if (!row.userId || roleByUserId.has(row.userId)) continue;
      roleByUserId.set(row.userId, row.role);
      userIds.push(row.userId);
    }
    return hydrateStaffContacts(tenantId, userIds, roleByUserId);
  }

  return [];
}

/**
 * Pick recipient config for an action (action override → rule default).
 * @param {object} action
 * @param {object} rule
 * @returns {object|null}
 */
function getActionRecipientConfig(action, rule) {
  return normalizeRecipientConfig(
    action?.recipient || rule?.actionConfig?.defaultRecipient || null
  );
}

module.exports = {
  STAFF_ROLES,
  normalizeRecipientConfig,
  isInternalAudience,
  resolveStaffRecipients,
  getActionRecipientConfig,
  loadEmployeePhonesByUserId,
  hydrateStaffContacts,
};
