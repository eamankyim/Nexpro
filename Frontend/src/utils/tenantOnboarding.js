const TENANT_SETUP_ROLES = new Set(['owner', 'admin']);

/**
 * True when the tenant has completed the required business setup flow.
 * @param {object|null|undefined} tenant
 * @returns {boolean}
 */
export const hasCompletedTenantOnboarding = (tenant) =>
  Boolean(tenant?.metadata?.onboarding?.completedAt);

/**
 * Owner/admin memberships can configure tenant setup, including platform-created tenants.
 * @param {object|null|undefined} membership
 * @param {object|null|undefined} user
 * @returns {boolean}
 */
export const hasTenantSetupRights = (membership, user) => {
  const role = membership?.role || user?.role || null;
  return TENANT_SETUP_ROLES.has(String(role || '').toLowerCase());
};

/**
 * A workspace invite for a non-setup role should land directly in the existing workspace.
 * @param {object|null|undefined} membership
 * @param {object|null|undefined} user
 * @returns {boolean}
 */
export const isTeamMemberWorkspaceInvite = (membership, user) =>
  Boolean(membership?.invitedBy && !hasTenantSetupRights(membership, user));

/**
 * Requires onboarding for setup-capable users when the active/default tenant is not configured.
 * invitedBy alone does not skip onboarding because platform-created tenants also set it.
 * @param {object} params
 * @param {object|null|undefined} params.user
 * @param {object|null|undefined} params.membership
 * @param {object|null|undefined} [params.activeTenant]
 * @param {boolean} [params.suppressAppGuidance]
 * @returns {boolean}
 */
export const shouldRequireTenantOnboarding = ({
  user,
  membership,
  activeTenant,
  suppressAppGuidance = false,
} = {}) => {
  const tenant = activeTenant || membership?.tenant || null;
  if (!user || user.isPlatformAdmin || !tenant) return false;
  if (suppressAppGuidance || hasCompletedTenantOnboarding(tenant)) return false;
  return hasTenantSetupRights(membership, user);
};
