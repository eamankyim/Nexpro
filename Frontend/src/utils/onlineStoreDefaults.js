import { CURRENCY } from '../constants';
import { normalizePrimaryColor } from './brandingColors';
import { toPreviewQueryImageUrl } from './fileUtils';
import { resolveStoreCurrencyCode } from './storeCurrency';

const CATEGORY_BY_BUSINESS_TYPE = {
  shop: 'Other',
  studio: 'Printing and creative services',
  printing_press: 'Printing and creative services',
  pharmacy: 'Health and pharmacy',
  barber: 'Beauty and salon',
  salon: 'Beauty and salon',
};

const CATEGORY_BY_SHOP_TYPE = {
  restaurant: 'Food and restaurants',
  bakery: 'Food and restaurants',
  supermarket: 'Groceries and provisions',
  groceries: 'Groceries and provisions',
  grocery: 'Groceries and provisions',
  convenience: 'Groceries and provisions',
  electronics: 'Electronics',
  clothing: 'Fashion and apparel',
  fashion: 'Fashion and apparel',
  beauty: 'Beauty and salon',
  furniture: 'Home and office',
};

/**
 * @param {unknown} value
 * @returns {string}
 */
export const compactString = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * First non-empty trimmed string among candidates.
 * @param {...unknown} values
 * @returns {string}
 */
export const firstFilled = (...values) => values.map(compactString).find(Boolean) || '';

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
export const getPlainObject = (value) => (
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}
);

/**
 * URL-safe store slug from a display name or raw slug.
 * @param {unknown} value
 * @returns {string}
 */
export const normalizeStoreSlug = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 80);

/**
 * @param {Record<string, unknown>} [address]
 * @returns {string}
 */
export const formatOrganizationAddress = (address = {}) => [
  address.line1,
  address.line2,
  [address.city, address.state].map(compactString).filter(Boolean).join(', '),
  address.postalCode,
  address.country,
].map(compactString).filter(Boolean).join(', ');

/**
 * Prefer saved category unless it is a generic "Other" with a better inferred value.
 * @param {unknown} savedCategory
 * @param {string} fallbackCategory
 * @returns {string}
 */
export const resolveSavedStoreCategory = (savedCategory, fallbackCategory) => {
  const saved = compactString(savedCategory);
  if (!saved) return fallbackCategory;
  if (saved === 'Other' && fallbackCategory && fallbackCategory !== 'Other') return fallbackCategory;
  return saved;
};

/**
 * @param {object} [activeTenant]
 * @param {Record<string, unknown>} [tenantMetadata]
 * @returns {string}
 */
export const getTenantShopType = (activeTenant, tenantMetadata = {}) => compactString(
  activeTenant?.shopType ||
  tenantMetadata.shopType ||
  tenantMetadata.businessSubType ||
  tenantMetadata.shopTypeKey ||
  tenantMetadata.businessSubtype,
);

/**
 * @param {object} [activeTenant]
 * @param {Record<string, unknown>} [tenantMetadata]
 * @returns {string}
 */
export const resolveBusinessCategory = (activeTenant, tenantMetadata = {}) => {
  const shopType = getTenantShopType(activeTenant, tenantMetadata);
  return CATEGORY_BY_SHOP_TYPE[shopType] ||
    CATEGORY_BY_BUSINESS_TYPE[activeTenant?.businessType] ||
    'Other';
};

/**
 * Resolve logo URL from organization / tenant / store settings sources.
 * @param {...unknown} sources
 * @returns {string}
 */
export const resolveStoreLogoUrl = (...sources) => firstFilled(
  ...sources.flatMap((source) => [
    source?.logoUrl,
    source?.logo,
    source?.companyLogoUrl,
    source?.companyLogo,
    source?.businessLogoUrl,
    source?.businessLogo,
    source?.tenantLogoUrl,
    source?.tenantLogo,
  ]),
);

/**
 * Resolve banner / hero image from settings or metadata aliases.
 * Marketplace discovery may still use this; Online Store single-shop no longer surfaces banners.
 * @param {...unknown} sources
 * @returns {string}
 */
export const resolveStoreBannerImageUrl = (...sources) => firstFilled(
  ...sources.flatMap((source) => [
    source?.bannerImageUrl,
    source?.bannerUrl,
    source?.heroImageUrl,
    source?.coverImageUrl,
  ]),
);

/**
 * Prefer a saved Online Store value; otherwise use the inferred default.
 * @param {unknown} saved
 * @param {unknown} fallback
 * @returns {string}
 */
export const savedOrDefault = (saved, fallback) => firstFilled(saved, fallback);

/**
 * Seed Online Store form / preview branding from tenant, organization, and user profile.
 * Does not overwrite values — callers should only apply when OnlineStoreSettings fields are empty.
 *
 * @param {object} [tenant] - activeTenant from AuthContext
 * @param {object} [user] - authenticated user
 * @param {{ organization?: object, profile?: object }} [extras]
 * @returns {{
 *   displayName: string,
 *   slug: string,
 *   description: string,
 *   category: string,
 *   whatsappNumber: string,
 *   contactPhone: string,
 *   contactEmail: string,
 *   primaryColor: string,
 *   secondaryColor: string,
 *   tertiaryColor: string,
 *   logoUrl: string,
 *   currency: string,
 *   localDeliveryAreas: string,
 *   nationwideRegions: string,
 *   pickupInstructions: string,
 * }}
 * @example
 * buildOnlineStoreDefaultsFromTenant(activeTenant, user, { organization, profile })
 */
export const buildOnlineStoreDefaultsFromTenant = (tenant, user, extras = {}) => {
  const { organization, profile } = extras;
  const tenantMetadata = getPlainObject(tenant?.metadata);
  const organizationAddress = getPlainObject(organization?.address || tenantMetadata.address);
  const addressText = formatOrganizationAddress(organizationAddress);
  const localArea = [organizationAddress.city, organizationAddress.state]
    .map(compactString)
    .filter(Boolean)
    .join(', ');

  const displayName = firstFilled(
    organization?.name,
    organization?.legalName,
    tenant?.name,
    tenantMetadata.businessName,
    tenantMetadata.companyName,
  );

  const contactPhone = firstFilled(
    organization?.phone,
    tenantMetadata.businessPhone,
    tenantMetadata.companyPhone,
    tenantMetadata.phone,
    tenant?.phone,
    profile?.phone,
    profile?.phoneNumber,
    user?.phone,
    user?.phoneNumber,
  );

  const contactEmail = firstFilled(
    organization?.email,
    organization?.supportEmail,
    tenantMetadata.businessEmail,
    tenantMetadata.companyEmail,
    tenantMetadata.email,
    tenant?.email,
    profile?.email,
    user?.email,
  );

  const primaryColor = normalizePrimaryColor(firstFilled(
    organization?.primaryColor,
    tenantMetadata.primaryColor,
    tenantMetadata.brandColor,
  ));

  return {
    displayName,
    slug: normalizeStoreSlug(displayName),
    description: firstFilled(
      tenantMetadata.storeDescription,
      tenantMetadata.businessDescription,
      tenantMetadata.description,
      tenant?.description,
    ),
    category: resolveSavedStoreCategory(
      firstFilled(tenantMetadata.storeCategory, tenantMetadata.businessCategory),
      resolveBusinessCategory(tenant, tenantMetadata),
    ),
    whatsappNumber: firstFilled(
      tenantMetadata.whatsappNumber,
      tenantMetadata.whatsapp,
      contactPhone,
    ),
    contactPhone,
    contactEmail,
    primaryColor,
    secondaryColor: '',
    tertiaryColor: '',
    logoUrl: resolveStoreLogoUrl(organization, tenantMetadata, tenant),
    currency: resolveStoreCurrencyCode(
      organization?.currency,
      tenantMetadata.currency,
      tenant?.currency,
      CURRENCY.CODE,
    ),
    localDeliveryAreas: localArea,
    nationwideRegions: '',
    pickupInstructions: addressText ? `Pickup from ${addressText}` : '',
  };
};

/**
 * Query-param payload for personalized template iframe previews.
 * Image URLs are query-safe only (absolute http(s)/short paths). data: logos
 * must be delivered via TemplatePreviewFrame postMessage.
 * @param {object} [branding]
 * @returns {{
 *   businessName?: string,
 *   logoUrl?: string,
 *   primaryColor?: string,
 *   secondaryColor?: string,
 *   tertiaryColor?: string,
 *   description?: string,
 *   contactPhone?: string,
 *   whatsappNumber?: string,
 *   contactEmail?: string,
 *   currency?: string,
 * }}
 */
export const buildTenantPreviewBrandingParams = (branding = {}) => ({
  businessName: compactString(branding.displayName || branding.businessName) || undefined,
  logoUrl: toPreviewQueryImageUrl(branding.logoUrl) || undefined,
  primaryColor: compactString(branding.primaryColor) || undefined,
  secondaryColor: compactString(branding.secondaryColor) || undefined,
  tertiaryColor: compactString(branding.tertiaryColor) || undefined,
  description: compactString(branding.description) || undefined,
  contactPhone: compactString(branding.contactPhone) || undefined,
  whatsappNumber: compactString(branding.whatsappNumber) || undefined,
  contactEmail: compactString(branding.contactEmail) || undefined,
  currency: compactString(branding.currency) || undefined,
});
