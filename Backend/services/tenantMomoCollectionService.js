const Tenant = require('../models/Tenant');
const { decryptJson, maskSecret, isEncryptionConfigured, encryptJson } = require('../utils/momoCredentialsCrypto');

const DEFAULT_COLLECTION_SANDBOX = 'https://sandbox.momodeveloper.mtn.com/collection';

/**
 * Tenant-only MTN Collection credentials (no platform fallback).
 * Required for automated Request-to-Pay when Merchant ID is on file.
 * @param {object} tenant - Sequelize Tenant instance
 * @returns {{ subscriptionKey: string, apiUser: string, apiKey: string, environment: string, collectionApiUrl: string, callbackUrl?: string, merchantId?: string, source: 'tenant' }|null}
 */
function getTenantMtnChargeConfig(tenant) {
  const stored = tenant?.metadata?.mtnCollectionCredentials;
  if (!stored?.secretsEnc) return null;

  try {
    const secrets = decryptJson(stored.secretsEnc);
    const sk = secrets.subscriptionKey;
    const user = secrets.apiUser;
    const key = secrets.apiKey;
    if (!sk || !user || !key) return null;

    const env = (stored.environment || 'sandbox').toLowerCase() === 'production' ? 'production' : 'sandbox';
    const collectionApiUrl =
      (stored.collectionApiUrl && String(stored.collectionApiUrl).trim()) ||
      process.env.MTN_MOMO_COLLECTION_URL ||
      DEFAULT_COLLECTION_SANDBOX;
    const callbackUrl =
      (stored.callbackUrl && String(stored.callbackUrl).trim()) || process.env.MTN_MOMO_CALLBACK_URL || undefined;
    return {
      subscriptionKey: String(sk).trim(),
      apiUser: String(user).trim(),
      apiKey: String(key).trim(),
      environment: env,
      collectionApiUrl,
      callbackUrl,
      merchantId: stored.merchantId ? String(stored.merchantId).trim() : undefined,
      source: 'tenant'
    };
  } catch (e) {
    console.error('[tenantMomoCollection] Decrypt failed for tenant', tenant?.id, e.message);
    return null;
  }
}

/**
 * Merchant ID without Collection API keys cannot run automated RpT.
 * Callers should skip to the next rail or return this message.
 * @param {object} tenant
 * @returns {string|null}
 */
function getMerchantIdOnlyBlockReason(tenant) {
  const stored = tenant?.metadata?.mtnCollectionCredentials;
  const merchantId = stored?.merchantId ? String(stored.merchantId).trim() : '';
  if (!merchantId) return null;
  if (getTenantMtnChargeConfig(tenant)) return null;
  return (
    'MTN Merchant ID is saved but Collection API credentials are missing. ' +
    'Add Subscription Key, API User, and API Key under Settings → Payments → Merchant ID (advanced credentials) to charge via MTN, or connect Hubtel / Paystack.'
  );
}

/**
 * Resolve MTN config for charging: tenant secrets first; platform only when
 * the tenant has not set a Merchant ID (so platform never steals settlement
 * from a merchant who expects direct MTN).
 * @param {object} tenant - Sequelize Tenant instance
 * @returns {{ subscriptionKey: string, apiUser: string, apiKey: string, environment: string, collectionApiUrl: string, callbackUrl?: string, merchantId?: string, source?: string }|null}
 */
function getResolvedMtnConfigForTenant(tenant) {
  const tenantCfg = getTenantMtnChargeConfig(tenant);
  if (tenantCfg) return tenantCfg;

  // Merchant ID without keys: do not fall through to platform settlement.
  if (getMerchantIdOnlyBlockReason(tenant)) return null;

  if (!tenant?.metadata) return getPlatformMtnFallback();
  return getPlatformMtnFallback();
}

function getPlatformMtnFallback() {
  const sk = process.env.MTN_MOMO_SUBSCRIPTION_KEY;
  const user = process.env.MTN_MOMO_API_USER;
  const key = process.env.MTN_MOMO_API_KEY;
  if (!sk || !user || !key) return null;
  return {
    subscriptionKey: sk,
    apiUser: user,
    apiKey: key,
    environment: (process.env.MTN_MOMO_ENVIRONMENT || 'sandbox').toLowerCase() === 'production' ? 'production' : 'sandbox',
    collectionApiUrl: process.env.MTN_MOMO_COLLECTION_URL || DEFAULT_COLLECTION_SANDBOX,
    callbackUrl: process.env.MTN_MOMO_CALLBACK_URL || undefined,
    source: 'platform'
  };
}

/**
 * Safe summary for GET settings (no secrets).
 * Merchant ID is the product-facing identity; API secrets are secondary.
 * @param {object} tenant
 */
function getMtnCollectionPublicSummary(tenant) {
  const stored = tenant?.metadata?.mtnCollectionCredentials;
  const merchantId = stored?.merchantId ? String(stored.merchantId).trim() : '';
  const hasTenantSecrets = Boolean(stored?.secretsEnc);
  let subscriptionKeyMasked = '';
  let apiUserMasked = '';
  if (hasTenantSecrets && isEncryptionConfigured()) {
    try {
      const secrets = decryptJson(stored.secretsEnc);
      subscriptionKeyMasked = maskSecret(secrets.subscriptionKey);
      apiUserMasked = maskSecret(secrets.apiUser);
    } catch {
      subscriptionKeyMasked = '****';
      apiUserMasked = '****';
    }
  }
  const platformFallback = Boolean(getPlatformMtnFallback());
  const hasMerchantId = Boolean(merchantId);
  return {
    configured: hasMerchantId || hasTenantSecrets,
    merchantId,
    hasApiCredentials: hasTenantSecrets,
    environment: stored?.environment || '',
    collectionApiUrl: stored?.collectionApiUrl || '',
    callbackUrl: stored?.callbackUrl || '',
    subscriptionKeyMasked,
    apiUserMasked,
    encryptionConfigured: isEncryptionConfigured(),
    platformFallbackAvailable: platformFallback,
    activeSource: hasTenantSecrets ? 'tenant' : platformFallback ? 'platform' : hasMerchantId ? 'merchant_id' : 'none'
  };
}

/**
 * Persist MTN Merchant ID and optional Collection API credentials (caller must verify OTP/password).
 * Merchant ID can be saved alone; API keys are optional for automated Request-to-Pay.
 * @param {string} tenantId
 * @param {{
 *   merchantId: string,
 *   subscriptionKey?: string,
 *   apiUser?: string,
 *   apiKey?: string,
 *   environment?: string,
 *   collectionApiUrl?: string,
 *   callbackUrl?: string
 * }} payload
 */
async function saveTenantMtnCollectionCredentials(tenantId, payload) {
  const tenant = await Tenant.findByPk(tenantId);
  if (!tenant) throw new Error('Tenant not found');

  const merchantId = payload.merchantId != null ? String(payload.merchantId).trim() : '';
  if (!merchantId) {
    throw new Error('Merchant ID is required');
  }

  const existing = tenant.metadata?.mtnCollectionCredentials || {};
  const subscriptionKey = payload.subscriptionKey != null ? String(payload.subscriptionKey).trim() : '';
  const apiUser = payload.apiUser != null ? String(payload.apiUser).trim() : '';
  const apiKey = payload.apiKey != null ? String(payload.apiKey).trim() : '';
  const providingKeys = Boolean(subscriptionKey || apiUser || apiKey);

  if (providingKeys) {
    if (!subscriptionKey || !apiUser || !apiKey) {
      throw new Error('Subscription key, API user, and API key are all required when saving API credentials');
    }
    if (!isEncryptionConfigured()) {
      throw new Error('Server encryption key for MoMo credentials is not configured');
    }
  }

  const env = String(payload.environment || existing.environment || 'sandbox').toLowerCase() === 'production'
    ? 'production'
    : 'sandbox';

  const mtnCollectionCredentials = {
    merchantId,
    environment: env,
    updatedAt: new Date().toISOString()
  };

  if (providingKeys) {
    mtnCollectionCredentials.secretsEnc = encryptJson({
      subscriptionKey,
      apiUser,
      apiKey
    });
  } else if (existing.secretsEnc) {
    mtnCollectionCredentials.secretsEnc = existing.secretsEnc;
  }

  const collectionApiUrl =
    payload.collectionApiUrl != null ? String(payload.collectionApiUrl).trim() : existing.collectionApiUrl;
  const callbackUrl = payload.callbackUrl != null ? String(payload.callbackUrl).trim() : existing.callbackUrl;
  if (collectionApiUrl) mtnCollectionCredentials.collectionApiUrl = collectionApiUrl;
  if (callbackUrl) mtnCollectionCredentials.callbackUrl = callbackUrl;

  tenant.metadata = {
    ...(tenant.metadata || {}),
    mtnCollectionCredentials
  };
  await tenant.save({ fields: ['metadata'] });
  return getMtnCollectionPublicSummary(tenant);
}

async function clearTenantMtnCollectionCredentials(tenantId) {
  const tenant = await Tenant.findByPk(tenantId);
  if (!tenant) throw new Error('Tenant not found');
  const meta = { ...(tenant.metadata || {}) };
  delete meta.mtnCollectionCredentials;
  tenant.metadata = meta;
  await tenant.save({ fields: ['metadata'] });
}

module.exports = {
  getResolvedMtnConfigForTenant,
  getTenantMtnChargeConfig,
  getMerchantIdOnlyBlockReason,
  getMtnCollectionPublicSummary,
  saveTenantMtnCollectionCredentials,
  clearTenantMtnCollectionCredentials,
  getPlatformMtnFallback,
  isEncryptionConfigured
};
