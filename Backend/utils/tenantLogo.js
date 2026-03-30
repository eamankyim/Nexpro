/**
 * Workspace logo for emails/public pages. Stored in tenant.metadata.logo (e.g. onboarding),
 * not on a tenants.logo column.
 * @param {{ metadata?: { logo?: string } }|null|undefined} tenant
 * @returns {string}
 */
function getTenantLogoUrl(tenant) {
  const logo = tenant?.metadata && typeof tenant.metadata === 'object' ? tenant.metadata.logo : null;
  return typeof logo === 'string' && logo.trim() ? logo.trim() : '';
}

module.exports = { getTenantLogoUrl };
