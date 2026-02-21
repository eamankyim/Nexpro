/**
 * Roles offered when inviting a platform admin.
 * Must match platform_admin_roles.name in the database.
 */
const PLATFORM_ADMIN_INVITE_ROLES = [
  'Marketing',
  'Operations',
  'Customer service',
  'Developer',
  'Media'
];

const getPlatformAdminInviteRoles = () => [...PLATFORM_ADMIN_INVITE_ROLES];

const isValidPlatformAdminInviteRole = (name) =>
  name && PLATFORM_ADMIN_INVITE_ROLES.includes(name);

module.exports = {
  PLATFORM_ADMIN_INVITE_ROLES,
  getPlatformAdminInviteRoles,
  isValidPlatformAdminInviteRole
};
