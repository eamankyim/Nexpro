/**
 * Business Type Feature Mapping
 *
 * Only 3 business types: shop, studio, pharmacy.
 * Studio types (printing_press, mechanic, barber, salon) are in metadata.studioType.
 */

const BUSINESS_TYPE_FEATURES = {
  shop: [
    'crm',
    'materials',
    'paymentsExpenses',
    'reports',
    'shopManagement',
    'pos',
    'materialsTracking',
    'payments',
    'expenses',
    'invoicing',
    'basicReports',
    'salesReports',
    'arReports',
    'profitLossReports'
  ],
  studio: [
    'crm',
    'quoteAutomation',
    'jobAutomation',
    'paymentsExpenses',
    'materials',
    'reports',
    'leadPipeline',
    'quoteBuilder',
    'pricingTemplates',
    'jobWorkflow',
    'materialsTracking',
    'vendorPriceLists',
    'payments',
    'expenses',
    'invoicing',
    'autoInvoicing',
    'basicReports',
    'salesReports',
    'arReports',
    'profitLossReports'
  ],
  pharmacy: [
    'crm',
    'materials',
    'paymentsExpenses',
    'reports',
    'pharmacyManagement',
    'prescriptions',
    'materialsTracking',
    'payments',
    'expenses',
    'invoicing',
    'basicReports',
    'salesReports',
    'arReports',
    'profitLossReports'
  ]
};

// Legacy: map old businessType values to new (for tenants not yet migrated)
const LEGACY_TO_STUDIO = ['printing_press', 'mechanic', 'barber', 'salon'];

/**
 * Resolve effective business type (handles legacy values)
 * @param {string} businessType - From tenant
 * @returns {string} 'shop' | 'studio' | 'pharmacy'
 */
const resolveBusinessType = (businessType) => {
  if (!businessType) return 'shop';
  if (LEGACY_TO_STUDIO.includes(businessType)) return 'studio';
  if (['shop', 'studio', 'pharmacy'].includes(businessType)) return businessType;
  return 'shop';
};

/**
 * Get features available for a business type
 * @param {string} businessType - The business type
 * @returns {string[]} Array of feature keys
 */
const getFeaturesForBusinessType = (businessType) => {
  const resolved = resolveBusinessType(businessType);
  return BUSINESS_TYPE_FEATURES[resolved] || [];
};

/**
 * Check if a feature is available for a business type
 */
const isFeatureAvailableForBusinessType = (businessType, featureKey) => {
  const features = getFeaturesForBusinessType(businessType);
  return features.includes(featureKey);
};

/**
 * Get business type display name
 */
const getBusinessTypeDisplayName = (businessType) => {
  const resolved = resolveBusinessType(businessType);
  const displayNames = {
    shop: 'Shop',
    studio: 'Studio',
    pharmacy: 'Pharmacy'
  };
  return displayNames[resolved] || businessType;
};

module.exports = {
  BUSINESS_TYPE_FEATURES,
  resolveBusinessType,
  getFeaturesForBusinessType,
  isFeatureAvailableForBusinessType,
  getBusinessTypeDisplayName
};
