/**
 * Shared Hubtel / MTN (direct) MoMo charge helpers used by POS and public invoice.
 * Paystack charge APIs are intentionally not called here — callers fall back when rail is paystack/none.
 */

const mobileMoneyService = require('./mobileMoneyService');
const {
  initiateReceiveMoney,
  checkReceiveMoneyStatus,
  getResolvedHubtelConfigForTenant
} = require('./tenantHubtelCollectionService');
const { resolveMoMoCollector } = require('./paymentCollectionRouter');

/**
 * Initiate a direct MoMo charge using collector priority (Hubtel → tenant MTN → platform MTN).
 * When the resolved rail is Paystack or none, returns success:false with a message that allows
 * callers (e.g. POS) to fall back to Paystack MoMo endpoints.
 *
 * @param {{
 *   tenant: object,
 *   phoneNumber: string,
 *   amount: number,
 *   currency?: string,
 *   provider: string,
 *   externalId: string,
 *   payerMessage?: string,
 *   customerName?: string,
 *   customerEmail?: string
 * }} params
 */
async function initiateDirectMoMoCharge(params) {
  const {
    tenant,
    phoneNumber,
    amount,
    currency = 'GHS',
    provider,
    externalId,
    payerMessage,
    customerName,
    customerEmail
  } = params;

  const resolved = resolveMoMoCollector(tenant, { allowPaystack: true });

  if (resolved.rail === 'hubtel') {
    const result = await initiateReceiveMoney({
      config: resolved.hubtelConfig,
      phoneNumber,
      amount,
      provider,
      clientReference: String(externalId).slice(0, 64),
      customerName: customerName || 'Customer',
      customerEmail,
      description: payerMessage || 'Payment'
    });
    if (!result.success) return { ...result, rail: 'hubtel' };
    return {
      success: true,
      rail: 'hubtel',
      referenceId: result.referenceId,
      clientReference: result.clientReference,
      hubtelTransactionId: result.hubtelTransactionId,
      provider: 'HUBTEL',
      status: result.status || 'PENDING',
      message: result.message,
      channel: result.channel
    };
  }

  if (resolved.rail === 'mtn') {
    const logical = String(provider || '').toUpperCase();
    if (logical !== 'MTN' && logical !== 'UNKNOWN') {
      // Tenant MTN Collection API cannot charge Airtel/Vodafone — try Paystack fallback upstream.
      return {
        success: false,
        rail: 'mtn',
        error: `Direct ${logical} collection is not available. MTN Collection is configured; use MTN or Paystack for other networks.`,
        provider: logical,
        allowPaystackFallback: true
      };
    }
    const mtnConfig = resolved.mtnConfig;
    const merchantTag = mtnConfig.merchantId ? ` merchant:${mtnConfig.merchantId}` : '';
    const result = await mobileMoneyService.requestPayment({
      phoneNumber,
      amount: parseFloat(amount),
      currency,
      externalId,
      provider: 'MTN',
      payerMessage: payerMessage || 'Payment for your purchase',
      payeeNote: `ABS collect${merchantTag}`.slice(0, 50),
      mtnConfig
    });
    if (!result.success) {
      return {
        ...result,
        rail: 'mtn',
        allowPaystackFallback: true,
        merchantId: mtnConfig.merchantId
      };
    }
    return {
      success: true,
      rail: 'mtn',
      referenceId: result.referenceId,
      provider: 'MTN',
      status: result.status || 'PENDING',
      message: result.message,
      merchantId: mtnConfig.merchantId,
      mtnSource: mtnConfig.source || 'platform'
    };
  }

  if (resolved.rail === 'paystack') {
    return {
      success: false,
      rail: 'paystack',
      error: 'Direct mobile money is not configured; use Paystack mobile money.',
      allowPaystackFallback: true,
      skipped: resolved.skipped
    };
  }

  return {
    success: false,
    rail: 'none',
    error:
      resolved.reason ||
      'Set up payment collection in Settings → Payments (Hubtel, MTN Merchant ID + Collection API, or Paystack).',
    allowPaystackFallback: false,
    skipped: resolved.skipped
  };
}

/**
 * Check status for a direct MoMo ref (Hubtel or MTN/Airtel).
 * @param {{
 *   tenant: object,
 *   referenceId: string,
 *   provider: string,
 *   mtnConfig?: object
 * }} params
 */
async function checkDirectMoMoStatus(params) {
  const { tenant, referenceId, provider } = params;
  const prov = String(provider || '').toUpperCase();

  if (prov === 'HUBTEL') {
    const hubtelConfig = getResolvedHubtelConfigForTenant(tenant);
    if (!hubtelConfig) {
      return {
        success: false,
        referenceId,
        status: 'UNKNOWN',
        error: 'Hubtel is not configured for this workspace',
        provider: 'HUBTEL'
      };
    }
    return checkReceiveMoneyStatus({ config: hubtelConfig, clientReference: referenceId });
  }

  let mtnConfig = params.mtnConfig;
  if (prov === 'MTN' && !mtnConfig) {
    const resolved = resolveMoMoCollector(tenant, { allowPaystack: false });
    mtnConfig = resolved.rail === 'mtn' ? resolved.mtnConfig : null;
  }

  return mobileMoneyService.checkPaymentStatus(referenceId, prov, mtnConfig);
}

/**
 * Build metadata.mobileMoneyRef blob for sale/invoice.
 */
function buildMobileMoneyRefMeta(chargeResult, extras = {}) {
  return {
    referenceId: chargeResult.referenceId,
    provider: chargeResult.provider,
    status: chargeResult.status || 'PENDING',
    rail: chargeResult.rail,
    initiatedAt: new Date().toISOString(),
    ...(chargeResult.clientReference ? { clientReference: chargeResult.clientReference } : {}),
    ...(chargeResult.hubtelTransactionId
      ? { hubtelTransactionId: chargeResult.hubtelTransactionId }
      : {}),
    ...(chargeResult.merchantId ? { merchantId: chargeResult.merchantId } : {}),
    ...(chargeResult.channel ? { channel: chargeResult.channel } : {}),
    ...extras
  };
}

module.exports = {
  initiateDirectMoMoCharge,
  checkDirectMoMoStatus,
  buildMobileMoneyRefMeta
};
