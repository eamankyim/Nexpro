/**
 * Business Type Feature Mapping
 * 
 * Defines which features are available for each business type.
 * Features are filtered by both subscription plan AND business type.
 */

const BUSINESS_TYPE_FEATURES = {
  printing_press: [
    'crm',
    'quoteAutomation',
    'jobAutomation',
    'paymentsExpenses',
    'inventory',
    'reports',
    'leadPipeline',
    'quoteBuilder',
    'pricingTemplates',
    'jobWorkflow',
    'inventoryTracking',
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
  shop: [
    'crm',
    'inventory',
    'paymentsExpenses',
    'reports',
    'shopManagement',
    'pos',
    'inventoryTracking',
    'payments',
    'expenses',
    'invoicing',
    'basicReports',
    'salesReports',
    'arReports',
    'profitLossReports'
  ],
  pharmacy: [
    'crm',
    'inventory',
    'paymentsExpenses',
    'reports',
    'pharmacyManagement',
    'prescriptions',
    'inventoryTracking',
    'payments',
    'expenses',
    'invoicing',
    'basicReports',
    'salesReports',
    'arReports',
    'profitLossReports'
  ]
};

/**
 * Get features available for a business type
 * @param {string} businessType - The business type ('printing_press', 'shop', 'pharmacy')
 * @returns {string[]} Array of feature keys
 */
const getFeaturesForBusinessType = (businessType) => {
  if (!businessType) {
    // Return all features for backward compatibility
    return Object.values(BUSINESS_TYPE_FEATURES).flat();
  }
  return BUSINESS_TYPE_FEATURES[businessType] || [];
};

/**
 * Check if a feature is available for a business type
 * @param {string} businessType - The business type
 * @param {string} featureKey - The feature key to check
 * @returns {boolean} True if feature is available
 */
const isFeatureAvailableForBusinessType = (businessType, featureKey) => {
  if (!businessType) {
    // For backward compatibility, allow all features if businessType is not set
    return true;
  }
  const features = getFeaturesForBusinessType(businessType);
  return features.includes(featureKey);
};

/**
 * Get business type display name
 * @param {string} businessType - The business type key
 * @returns {string} Display name
 */
const getBusinessTypeDisplayName = (businessType) => {
  const displayNames = {
    printing_press: 'Printing Press',
    shop: 'Shop',
    pharmacy: 'Pharmacy'
  };
  return displayNames[businessType] || businessType;
};

module.exports = {
  BUSINESS_TYPE_FEATURES,
  getFeaturesForBusinessType,
  isFeatureAvailableForBusinessType,
  getBusinessTypeDisplayName
};
