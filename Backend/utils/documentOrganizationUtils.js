const { Setting, Tenant } = require('../models');
const { getTenantLogoUrl } = require('./tenantLogo');

/**
 * Map shop/studio address columns to printable organization address shape.
 * @param {object|null} location
 * @returns {object}
 */
const locationToAddress = (location) => {
  if (!location) return {};
  return {
    line1: location.address || '',
    line2: '',
    city: location.city || '',
    state: location.state || '',
    postalCode: location.postalCode || '',
    country: location.country || '',
  };
};

const pickFirstNonEmpty = (...values) => {
  for (const v of values) {
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      return typeof v === 'string' ? v.trim() : v;
    }
  }
  return '';
};

/**
 * Load tenant-level organization settings (workspace fallback).
 * @param {string} tenantId
 * @returns {Promise<{ organization: object, tenant: import('../models').Tenant|null }>}
 */
const loadTenantOrganization = async (tenantId) => {
  const [orgSetting, tenant] = await Promise.all([
    Setting.findOne({ where: { tenantId, key: 'organization' } }),
    Tenant.findByPk(tenantId),
  ]);
  const orgSettings = orgSetting?.value || {};
  const tenantMetadata = tenant?.metadata || {};

  const organization = {
    name: pickFirstNonEmpty(orgSettings.name, tenant?.name, ''),
    legalName: orgSettings.legalName || '',
    email: pickFirstNonEmpty(orgSettings.email, tenantMetadata.email, tenantMetadata.companyEmail, ''),
    phone: pickFirstNonEmpty(orgSettings.phone, tenantMetadata.phone, tenantMetadata.companyPhone, ''),
    website: pickFirstNonEmpty(orgSettings.website, tenantMetadata.website, tenantMetadata.companyWebsite, ''),
    logoUrl: pickFirstNonEmpty(orgSettings.logoUrl, tenantMetadata.logo, getTenantLogoUrl(tenant)),
    invoiceFooter: orgSettings.invoiceFooter || '',
    paymentDetails: orgSettings.paymentDetails || '',
    paymentDetailsEnabled: orgSettings.paymentDetailsEnabled === true,
    defaultPaymentTerms: orgSettings.defaultPaymentTerms || '',
    defaultTermsAndConditions: orgSettings.defaultTermsAndConditions || '',
    supportEmail: orgSettings.supportEmail || '',
    address: orgSettings.address || locationToAddress(null),
    tax: orgSettings.tax || {},
    primaryColor: orgSettings.primaryColor || tenantMetadata.primaryColor || '#166534',
    source: 'tenant',
  };

  return { organization, tenant };
};

/**
 * Resolve branding for invoices/receipts/emails: shop or studio first, then tenant settings.
 * @param {object} options
 * @param {string} options.tenantId
 * @param {object|null} [options.shop]
 * @param {object|null} [options.studioLocation]
 * @returns {Promise<object>}
 */
const resolveDocumentOrganization = async ({ tenantId, shop = null, studioLocation = null }) => {
  const branch = shop || studioLocation;
  const branchType = shop ? 'shop' : studioLocation ? 'studio_location' : null;
  const { organization: tenantOrg, tenant } = await loadTenantOrganization(tenantId);

  if (!branch) {
    return { ...tenantOrg, source: 'tenant' };
  }

  const branchAddress = locationToAddress(branch);
  const hasBranchAddress = Object.values(branchAddress).some((v) => String(v || '').trim());

  return {
    ...tenantOrg,
    name: pickFirstNonEmpty(branch.name, tenantOrg.name),
    email: pickFirstNonEmpty(branch.email, tenantOrg.email),
    phone: pickFirstNonEmpty(branch.phone, tenantOrg.phone),
    website: tenantOrg.website,
    logoUrl: pickFirstNonEmpty(branch.logoUrl, tenantOrg.logoUrl),
    address: hasBranchAddress ? branchAddress : tenantOrg.address,
    source: branchType,
    branchId: branch.id,
    managerUserId: branch.managerUserId || null,
    manager: branch.manager || null,
  };
};

/**
 * Email template company block from resolved organization.
 * @param {object} organization
 * @returns {{ name: string, logo: string, primaryColor: string }}
 */
const organizationToEmailCompany = (organization) => ({
  name: organization?.name || 'African Business Suite',
  logo: organization?.logoUrl || '',
  primaryColor: organization?.primaryColor || '#166534',
});

module.exports = {
  locationToAddress,
  loadTenantOrganization,
  resolveDocumentOrganization,
  organizationToEmailCompany,
};
