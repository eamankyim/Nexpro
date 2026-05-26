const {
  resolveBusinessType,
} = require('../config/businessTypes');

const DEFAULT_BUSINESS_TYPE = 'shop';
const DEFAULT_SHOP_TYPE = 'other';
const LEGACY_STUDIO_BUSINESS_TYPES = ['printing_press', 'mechanic', 'barber', 'salon'];

const STUDIO_BUSINESS_SUB_TYPES = new Set([
  'printing_press',
  'software_it_services',
  'other_professional_services',
  'barber_shop',
  'hair_salon',
  'spa_nail_bar',
  'mechanic_workshop',
  'car_wash',
  ...LEGACY_STUDIO_BUSINESS_TYPES,
]);

const PHARMACY_BUSINESS_SUB_TYPES = new Set([
  'community_pharmacy',
  'clinic_pharmacy',
]);

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const toPlainTenant = (tenant) => {
  if (!tenant) return null;
  if (typeof tenant.toJSON === 'function') return tenant.toJSON();
  if (tenant.dataValues && isPlainObject(tenant.dataValues)) return { ...tenant.dataValues };
  return { ...tenant };
};

const resolveDefaultBusinessType = (tenant) => {
  const metadata = isPlainObject(tenant?.metadata) ? tenant.metadata : {};
  const subType = metadata.businessSubType || metadata.shopType || metadata.studioType || null;

  if (tenant?.businessType) return resolveBusinessType(tenant.businessType);
  if (metadata.studioType || STUDIO_BUSINESS_SUB_TYPES.has(subType)) return 'studio';
  if (PHARMACY_BUSINESS_SUB_TYPES.has(subType)) return 'pharmacy';
  return DEFAULT_BUSINESS_TYPE;
};

/**
 * Normalizes tenant classification for API responses without marking onboarding complete.
 * Preserves explicit business/shop/studio choices and only fills missing values with safe defaults.
 */
const normalizeTenantClassification = (tenant) => {
  const plain = toPlainTenant(tenant);
  if (!plain) return plain;

  const metadata = isPlainObject(plain.metadata) ? { ...plain.metadata } : {};
  const originalBusinessType = plain.businessType || null;
  const businessType = resolveDefaultBusinessType(plain);

  if (businessType === 'shop' && !metadata.shopType) {
    metadata.shopType = metadata.businessSubType || DEFAULT_SHOP_TYPE;
  }

  if (businessType === 'studio' && !metadata.studioType) {
    if (LEGACY_STUDIO_BUSINESS_TYPES.includes(originalBusinessType)) {
      metadata.studioType = originalBusinessType;
    } else if (metadata.businessSubType) {
      metadata.studioType = metadata.businessSubType;
    }
  }

  return {
    ...plain,
    businessType,
    metadata,
  };
};

const normalizeTenantInstanceForRequest = (tenant) => {
  if (!tenant) return tenant;
  const normalized = normalizeTenantClassification(tenant);
  if (tenant.dataValues && normalized) {
    tenant.dataValues.businessType = normalized.businessType;
    tenant.dataValues.metadata = normalized.metadata;
  }
  tenant.businessType = normalized?.businessType;
  tenant.metadata = normalized?.metadata;
  return tenant;
};

const normalizeMembershipForResponse = (membership) => {
  if (!membership) return membership;
  const plain =
    typeof membership.toJSON === 'function'
      ? membership.toJSON()
      : membership.dataValues
        ? { ...membership.dataValues }
        : { ...membership };

  if (plain.tenant) {
    plain.tenant = normalizeTenantClassification(plain.tenant);
  }
  return plain;
};

module.exports = {
  DEFAULT_BUSINESS_TYPE,
  DEFAULT_SHOP_TYPE,
  LEGACY_STUDIO_BUSINESS_TYPES,
  normalizeTenantClassification,
  normalizeTenantInstanceForRequest,
  normalizeMembershipForResponse,
  resolveDefaultBusinessType,
};
