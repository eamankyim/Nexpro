const { Setting } = require('../models');

/** @typedef {{ enabled: boolean, label: string, ratePercent: number, customerBears: boolean, appliesTo: string }} NormalizedOtherChargeConfig */
/** @typedef {{ enabled: boolean, defaultRatePercent: number, pricesAreTaxInclusive: boolean, displayLabel: string, vatNumber: string, tin: string, otherCharges: NormalizedOtherChargeConfig }} NormalizedTaxConfig */

const DEFAULT_TAX_FIELDS = {
  enabled: false,
  defaultRatePercent: 0,
  pricesAreTaxInclusive: false,
  displayLabel: 'Tax',
  vatNumber: '',
  tin: '',
  otherCharges: {
    enabled: false,
    label: 'Transaction charge',
    ratePercent: 0,
    customerBears: false,
    appliesTo: 'online_payments'
  }
};

/**
 * Merge raw organization.tax with defaults (registration fields preserved).
 * @param {Record<string, unknown>} raw
 * @returns {NormalizedTaxConfig}
 */
function normalizeTaxConfig(raw = {}) {
  const rate = parseFloat(raw.defaultRatePercent);
  const safeRate = Number.isFinite(rate) ? Math.min(100, Math.max(0, rate)) : 0;
  const otherRate = parseFloat(raw?.otherCharges?.ratePercent);
  const safeOtherRate = Number.isFinite(otherRate) ? Math.min(100, Math.max(0, otherRate)) : 0;
  const rawAppliesTo = typeof raw?.otherCharges?.appliesTo === 'string' ? raw.otherCharges.appliesTo.trim() : '';
  const appliesTo = rawAppliesTo === 'online_payments' || rawAppliesTo === 'all_payments'
    ? rawAppliesTo
    : DEFAULT_TAX_FIELDS.otherCharges.appliesTo;
  return {
    enabled: raw.enabled === true,
    defaultRatePercent: safeRate,
    pricesAreTaxInclusive: raw.pricesAreTaxInclusive === true,
    displayLabel:
      typeof raw.displayLabel === 'string' && raw.displayLabel.trim()
        ? raw.displayLabel.trim().slice(0, 80)
        : DEFAULT_TAX_FIELDS.displayLabel,
    vatNumber: typeof raw.vatNumber === 'string' ? raw.vatNumber : '',
    tin: typeof raw.tin === 'string' ? raw.tin : '',
    otherCharges: {
      enabled: raw?.otherCharges?.enabled === true,
      label:
        typeof raw?.otherCharges?.label === 'string' && raw.otherCharges.label.trim()
          ? raw.otherCharges.label.trim().slice(0, 80)
          : DEFAULT_TAX_FIELDS.otherCharges.label,
      ratePercent: safeOtherRate,
      customerBears: raw?.otherCharges?.customerBears === true,
      appliesTo
    }
  };
}

/**
 * Tax slice for API responses (organization settings).
 * @param {Record<string, unknown>} organizationValue - full organization setting object
 * @returns {NormalizedTaxConfig}
 */
function getTaxFromOrganizationSettings(organizationValue = {}) {
  return normalizeTaxConfig(organizationValue.tax || {});
}

/**
 * Load normalized tax config for a tenant from settings.
 * @param {string} tenantId
 * @returns {Promise<NormalizedTaxConfig>}
 */
async function getTaxConfigForTenant(tenantId) {
  const row = await Setting.findOne({ where: { tenantId, key: 'organization' } });
  return getTaxFromOrganizationSettings(row?.value || {});
}

/**
 * Validate tax fields from a partial update; returns error message or null.
 * @param {Record<string, unknown>} taxPayload - merged tax object after patch
 * @returns {string|null}
 */
function validateMergedTaxPayload(taxPayload) {
  if (!taxPayload || typeof taxPayload !== 'object') return null;
  const rate = taxPayload.defaultRatePercent;
  if (rate !== undefined && rate !== null && rate !== '') {
    const n = parseFloat(rate);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      return 'Tax rate must be between 0 and 100';
    }
  }
  if (taxPayload.displayLabel !== undefined && taxPayload.displayLabel !== null) {
    if (typeof taxPayload.displayLabel !== 'string') {
      return 'Tax display label must be a string';
    }
    if (taxPayload.displayLabel.length > 80) {
      return 'Tax display label is too long';
    }
  }
  if (taxPayload.otherCharges !== undefined && taxPayload.otherCharges !== null) {
    if (typeof taxPayload.otherCharges !== 'object' || Array.isArray(taxPayload.otherCharges)) {
      return 'Other charges must be an object';
    }
    const oc = taxPayload.otherCharges;
    const ocRate = oc.ratePercent;
    if (ocRate !== undefined && ocRate !== null && ocRate !== '') {
      const n = parseFloat(ocRate);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        return 'Other charge rate must be between 0 and 100';
      }
    }
    if (oc.label !== undefined && oc.label !== null) {
      if (typeof oc.label !== 'string') return 'Other charge label must be a string';
      if (oc.label.length > 80) return 'Other charge label is too long';
    }
    if (oc.appliesTo !== undefined && oc.appliesTo !== null) {
      const valid = ['online_payments', 'all_payments'];
      if (!valid.includes(String(oc.appliesTo))) {
        return 'Other charge applicability is invalid';
      }
    }
  }
  return null;
}

module.exports = {
  DEFAULT_TAX_FIELDS,
  normalizeTaxConfig,
  getTaxFromOrganizationSettings,
  getTaxConfigForTenant,
  validateMergedTaxPayload
};
