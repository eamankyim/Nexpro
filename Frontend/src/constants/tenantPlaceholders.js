/** Default tenant names (placeholders when business not set up). */
export const DEFAULT_TENANT_NAMES = ['My Workspace', 'My Business'];

/** Matches "Eric's Business", "Eric's Workspace" etc. - treated as placeholder, not real business name */
const PLACEHOLDER_PATTERN = /^.+'s (Business|Workspace)$/i;

/**
 * Check if a name is a placeholder (not a real business name set by the user).
 * @param {string|undefined|null} name
 * @returns {boolean}
 */
export const isPlaceholderBusinessName = (name) => {
  if (!name || !name.trim()) return true;
  if (DEFAULT_TENANT_NAMES.includes(name.trim())) return true;
  return PLACEHOLDER_PATTERN.test(name.trim());
};

/**
 * Get display name for business. Uses the business name set during onboarding everywhere.
 * Avoids "Workspace" or "Eric's Business" - shows actual business name when set.
 * @param {string} tenantName - activeTenant?.name
 * @param {string} [organizationName] - organization?.name (from Settings)
 * @param {string} [fallback] - Fallback when no business name (default: 'your business')
 * @returns {string}
 */
export const getWorkspaceDisplayName = (tenantName, organizationName, fallback = 'your business') => {
  const tenant = (tenantName || '').trim();
  const org = (organizationName || '').trim();

  if (tenant && !isPlaceholderBusinessName(tenant)) return tenant;
  if (org && !isPlaceholderBusinessName(org)) return org;

  return fallback;
};
