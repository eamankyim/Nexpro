/**
 * Runtime MoMo collector priority for ABS charge flows.
 * Card / hosted checkout stays on Paystack — this router is for mobile-money collection only.
 *
 * Priority:
 * 1. Hubtel (tenant ClientID/Secret)
 * 2. Tenant MTN Collection API (Merchant ID + secrets) — Merchant ID alone cannot charge
 * 3. Platform MTN env fallback — only when tenant has no Merchant ID (avoids stealing settlement)
 * 4. Paystack MoMo (if secret key present)
 * 5. none → caller should return a clear setup error
 */

const {
  getResolvedHubtelConfigForTenant
} = require('./tenantHubtelCollectionService');
const {
  getTenantMtnChargeConfig,
  getPlatformMtnFallback,
  getMerchantIdOnlyBlockReason
} = require('./tenantMomoCollectionService');

/**
 * @typedef {'hubtel'|'mtn'|'paystack'|'none'} MoMoCollectorRail
 */

/**
 * Resolve which MoMo rail to use for a live charge.
 * @param {object|null} tenant - Sequelize Tenant (metadata loaded)
 * @param {{ allowPaystack?: boolean }} [options]
 * @returns {{
 *   rail: MoMoCollectorRail,
 *   hubtelConfig?: object,
 *   mtnConfig?: object,
 *   reason?: string,
 *   skipped?: Array<{ rail: string, reason: string }>
 * }}
 */
function resolveMoMoCollector(tenant, options = {}) {
  const allowPaystack = options.allowPaystack !== false;
  const skipped = [];

  const hubtelConfig = getResolvedHubtelConfigForTenant(tenant);
  if (hubtelConfig?.clientId && hubtelConfig?.clientSecret) {
    if (!hubtelConfig.posSalesId && !hubtelConfig.merchantAccountNumber) {
      skipped.push({
        rail: 'hubtel',
        reason: 'Hubtel POS Sales ID / Merchant Account Number is required for Receive Money'
      });
    } else {
      return { rail: 'hubtel', hubtelConfig, skipped };
    }
  } else {
    skipped.push({ rail: 'hubtel', reason: 'Hubtel not connected' });
  }

  const tenantMtn = getTenantMtnChargeConfig(tenant);
  if (tenantMtn) {
    return { rail: 'mtn', mtnConfig: tenantMtn, skipped };
  }

  const merchantOnlyReason = getMerchantIdOnlyBlockReason(tenant);
  if (merchantOnlyReason) {
    skipped.push({ rail: 'mtn', reason: merchantOnlyReason });
  } else {
    const platform = getPlatformMtnFallback();
    if (platform) {
      return { rail: 'mtn', mtnConfig: platform, skipped };
    }
    skipped.push({ rail: 'mtn', reason: 'MTN Collection API not configured' });
  }

  const paystackService = require('./paystackService');
  if (allowPaystack && paystackService.secretKey) {
    return { rail: 'paystack', skipped };
  }
  if (allowPaystack) {
    skipped.push({ rail: 'paystack', reason: 'Paystack not configured' });
  }

  return {
    rail: 'none',
    reason:
      'Set up payment collection in Settings → Payments (Hubtel, MTN Merchant ID + Collection API, or Paystack settlement).',
    skipped
  };
}

/**
 * Whether the tenant can run a direct (non-Paystack) MoMo charge.
 * @param {object|null} tenant
 */
function canDirectMoMoCharge(tenant) {
  const resolved = resolveMoMoCollector(tenant, { allowPaystack: false });
  return resolved.rail === 'hubtel' || resolved.rail === 'mtn';
}

/**
 * Public paymentOptions flags for invoice pay links (no secrets).
 * @param {object|null} tenant
 * @param {{ airtelDirectOk?: boolean }} [extras]
 */
function buildPublicPaymentOptions(tenant, extras = {}) {
  const paystackService = require('./paystackService');
  const hubtelOk = Boolean(getResolvedHubtelConfigForTenant(tenant));
  const tenantMtn = getTenantMtnChargeConfig(tenant);
  const merchantOnly = Boolean(getMerchantIdOnlyBlockReason(tenant));
  const platformMtn = !merchantOnly && Boolean(getPlatformMtnFallback());
  const mtnOk = Boolean(tenantMtn) || platformMtn;
  const airtelDirectOk = Boolean(extras.airtelDirectOk);
  const paystackOk = Boolean(paystackService.secretKey);

  return {
    paystack: paystackOk,
    directHubtel: hubtelOk,
    directMtnMoMo: mtnOk,
    directAirtelMoMo: airtelDirectOk,
    directMoMo: hubtelOk || mtnOk || airtelDirectOk
  };
}

module.exports = {
  resolveMoMoCollector,
  canDirectMoMoCharge,
  buildPublicPaymentOptions
};
