const Tenant = require('../models/Tenant');
const { decryptJson, maskSecret, isEncryptionConfigured, encryptJson } = require('../utils/momoCredentialsCrypto');

const DEFAULT_COLLECTION_SANDBOX = 'https://sandbox.momodeveloper.mtn.com/collection';

/**
 * @param {object} tenant - Sequelize Tenant instance
 * @returns {{ subscriptionKey: string, apiUser: string, apiKey: string, environment: string, collectionApiUrl: string, callbackUrl?: string }|null}
 */
function getResolvedMtnConfigForTenant(tenant) {
  if (!tenant?.metadata) return getPlatformMtnFallback();

  const stored = tenant.metadata.mtnCollectionCredentials;
  if (stored?.secretsEnc) {
    try {
      const secrets = decryptJson(stored.secretsEnc);
      const sk = secrets.subscriptionKey;
      const user = secrets.apiUser;
      const key = secrets.apiKey;
      if (sk && user && key) {
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
          callbackUrl
        };
      }
    } catch (e) {
      console.error('[tenantMomoCollection] Decrypt failed for tenant', tenant.id, e.message);
    }
  }

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
    callbackUrl: process.env.MTN_MOMO_CALLBACK_URL || undefined
  };
}

/**
 * Safe summary for GET settings (no secrets).
 * @param {object} tenant
 */
function getMtnCollectionPublicSummary(tenant) {
  const stored = tenant?.metadata?.mtnCollectionCredentials;
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
  return {
    configured: hasTenantSecrets,
    environment: stored?.environment || '',
    collectionApiUrl: stored?.collectionApiUrl || '',
    callbackUrl: stored?.callbackUrl || '',
    subscriptionKeyMasked,
    apiUserMasked,
    encryptionConfigured: isEncryptionConfigured(),
    platformFallbackAvailable: platformFallback,
    activeSource: hasTenantSecrets ? 'tenant' : platformFallback ? 'platform' : 'none'
  };
}

/**
 * Persist tenant MTN collection credentials (caller must verify OTP/password).
 * @param {string} tenantId
 * @param {{ subscriptionKey: string, apiUser: string, apiKey: string, environment?: string, collectionApiUrl?: string, callbackUrl?: string }} payload
 */
async function saveTenantMtnCollectionCredentials(tenantId, payload) {
  if (!isEncryptionConfigured()) {
    throw new Error('Server encryption key for MoMo credentials is not configured');
  }
  const tenant = await Tenant.findByPk(tenantId);
  if (!tenant) throw new Error('Tenant not found');

  const secretsEnc = encryptJson({
    subscriptionKey: String(payload.subscriptionKey).trim(),
    apiUser: String(payload.apiUser).trim(),
    apiKey: String(payload.apiKey).trim()
  });

  const env = String(payload.environment || 'sandbox').toLowerCase() === 'production' ? 'production' : 'sandbox';
  const mtnCollectionCredentials = {
    secretsEnc,
    environment: env,
    updatedAt: new Date().toISOString()
  };
  if (payload.collectionApiUrl && String(payload.collectionApiUrl).trim()) {
    mtnCollectionCredentials.collectionApiUrl = String(payload.collectionApiUrl).trim();
  }
  if (payload.callbackUrl && String(payload.callbackUrl).trim()) {
    mtnCollectionCredentials.callbackUrl = String(payload.callbackUrl).trim();
  }

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
  getMtnCollectionPublicSummary,
  saveTenantMtnCollectionCredentials,
  clearTenantMtnCollectionCredentials,
  getPlatformMtnFallback,
  isEncryptionConfigured
};
