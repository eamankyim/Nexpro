/**
 * Merge shop/studio branch fields over tenant organization settings for print/receipt UI.
 * @param {object|null} branch - Shop or studio location row
 * @param {object} tenantOrganization - Workspace organization settings
 * @returns {object}
 */
export const mergeBranchOrganization = (branch, tenantOrganization = {}) => {
  if (!branch) return tenantOrganization;

  const hasAddress =
    branch.address ||
    branch.city ||
    branch.state ||
    branch.postalCode ||
    branch.country;

  const address = hasAddress
    ? {
        line1: branch.address || '',
        line2: '',
        city: branch.city || '',
        state: branch.state || '',
        postalCode: branch.postalCode || '',
        country: branch.country || '',
      }
    : tenantOrganization.address;

  return {
    ...tenantOrganization,
    name: branch.name || tenantOrganization.name,
    email: branch.email || tenantOrganization.email,
    phone: branch.phone || tenantOrganization.phone,
    logoUrl: branch.logoUrl || tenantOrganization.logoUrl,
    address,
  };
};
