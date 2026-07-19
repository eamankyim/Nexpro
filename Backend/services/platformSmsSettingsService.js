const { Setting } = require('../models');
const { decryptSecret, encryptSecret, hasKey } = require('../utils/secretCrypto');

const PLATFORM_SMS_SETTINGS_KEY = 'platform:sms';
const PLATFORM_SMS_CREDENTIALS_ENCRYPTION_KEY = 'PLATFORM_SMS_CREDENTIALS_ENCRYPTION_KEY';
const DEFAULT_SENDER_ID = 'ABS';
const DEFAULT_MONTHLY_LIMIT = 100;
const PLATFORM_SMS_PROVIDERS = ['arkesel', 'mnotify'];

const clean = (value) => String(value || '').trim();
const isRealSecret = (value) => typeof value === 'string' && value.trim() !== '' && value !== '***';
const last4 = (value) => clean(value).slice(-4);
const maskLast4 = (value) => (value ? `•••• ${value}` : '');

function parseMonthlyLimit(value) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_MONTHLY_LIMIT;
  return Math.min(parsed, 100000);
}

function encryptionConfigured() {
  return hasKey(PLATFORM_SMS_CREDENTIALS_ENCRYPTION_KEY)
    || hasKey('PLATFORM_EMAIL_CREDENTIALS_ENCRYPTION_KEY');
}

/**
 * Normalize provider id to a supported platform SMS provider.
 * @param {string} value
 * @returns {'arkesel'|'mnotify'}
 */
function normalizeProvider(value) {
  const provider = clean(value).toLowerCase();
  return PLATFORM_SMS_PROVIDERS.includes(provider) ? provider : 'arkesel';
}

/**
 * Migrate legacy `provider` field into `activeProvider` shape without dropping Arkesel creds.
 * @param {object} value
 * @returns {object}
 */
function normalizeStoredValue(value = {}) {
  const activeProvider = normalizeProvider(value.activeProvider || value.provider || 'arkesel');
  return {
    ...value,
    activeProvider,
    provider: activeProvider,
    arkesel: { ...(value.arkesel || {}) },
    mnotify: { ...(value.mnotify || {}) },
  };
}

function providerPublicSummary(blob = {}) {
  return {
    apiKeyConfigured: Boolean(blob.apiKey),
    apiKeyMasked: maskLast4(blob.apiKeyLast4),
    senderId: clean(blob.senderId) || DEFAULT_SENDER_ID,
    updatedAt: blob.updatedAt || null,
    lastTestAt: blob.lastTestAt || null,
    lastError: blob.lastError || null,
  };
}

function getPublicSummary(value = {}) {
  const normalized = normalizeStoredValue(value);
  return {
    enabled: normalized.enabled === true,
    activeProvider: normalized.activeProvider,
    provider: normalized.activeProvider,
    encryptionConfigured: encryptionConfigured(),
    arkesel: providerPublicSummary(normalized.arkesel),
    mnotify: providerPublicSummary(normalized.mnotify),
    monthlyLimit: parseMonthlyLimit(normalized.monthlyLimit),
    updatedAt: normalized.updatedAt || null,
  };
}

async function getPlatformSmsSettingsSummary() {
  const setting = await Setting.findOne({
    where: { tenantId: null, key: PLATFORM_SMS_SETTINGS_KEY },
  });
  return getPublicSummary(setting?.value || {});
}

function decryptStoredSecret(value) {
  return value ? decryptSecret(value, PLATFORM_SMS_CREDENTIALS_ENCRYPTION_KEY) : '';
}

/**
 * Whether the active provider has enough credentials to send.
 * @param {object} value
 * @returns {boolean}
 */
function hasActiveCredentials(value = {}) {
  const normalized = normalizeStoredValue(value);
  if (normalized.enabled !== true) return false;
  const blob = normalized[normalized.activeProvider] || {};
  return Boolean(blob.apiKey && clean(blob.senderId || DEFAULT_SENDER_ID));
}

/**
 * Build runtime config for the currently active platform SMS provider.
 * @param {object} value
 * @returns {object|null}
 */
function buildStoredConfig(value = {}) {
  const normalized = normalizeStoredValue(value);
  if (!hasActiveCredentials(normalized)) return null;

  const provider = normalized.activeProvider;
  const blob = normalized[provider] || {};
  const apiKey = decryptStoredSecret(blob.apiKey);
  const senderId = clean(blob.senderId) || DEFAULT_SENDER_ID;
  if (!apiKey || !senderId) return null;

  return {
    enabled: true,
    provider,
    apiKey,
    senderId: senderId.substring(0, 11),
    monthlyLimit: parseMonthlyLimit(normalized.monthlyLimit),
    source: 'platform',
    limited: true,
  };
}

async function getSavedPlatformSmsConfig() {
  const setting = await Setting.findOne({
    where: { tenantId: null, key: PLATFORM_SMS_SETTINGS_KEY },
  });
  if (!setting?.value || !Object.keys(setting.value).length) return null;

  try {
    return buildStoredConfig(setting.value);
  } catch (error) {
    console.warn('[Platform SMS settings] Could not read saved provider credentials:', error?.message);
    return null;
  }
}

function requireEncryptionForNewSecret(secret) {
  if (isRealSecret(secret) && !encryptionConfigured()) {
    const error = new Error(
      'Server is missing PLATFORM_SMS_CREDENTIALS_ENCRYPTION_KEY (64 hex chars). Configure it before saving platform SMS credentials.'
    );
    error.statusCode = 400;
    throw error;
  }
}

/**
 * Merge provider credential blob (apiKey / senderId) into stored settings.
 * @param {object} existingBlob
 * @param {object} payloadBlob
 * @param {string|null} userId
 * @param {string} now
 * @returns {object}
 */
function mergeProviderBlob(existingBlob = {}, payloadBlob = {}, userId, now) {
  const next = { ...existingBlob };

  if (payloadBlob.senderId !== undefined) {
    next.senderId = clean(payloadBlob.senderId) || DEFAULT_SENDER_ID;
  } else if (!next.senderId) {
    next.senderId = DEFAULT_SENDER_ID;
  }

  if (isRealSecret(payloadBlob.apiKey)) {
    requireEncryptionForNewSecret(payloadBlob.apiKey);
    const apiKey = clean(payloadBlob.apiKey);
    next.apiKey = encryptSecret(apiKey, PLATFORM_SMS_CREDENTIALS_ENCRYPTION_KEY);
    next.apiKeyLast4 = last4(apiKey);
    next.updatedAt = now;
    next.updatedBy = userId || null;
    next.lastError = null;
  }

  return next;
}

function mergeSettings({ existing = {}, payload = {}, userId }) {
  const now = new Date().toISOString();
  const existingNorm = normalizeStoredValue(existing);
  const activeProvider = normalizeProvider(
    payload.activeProvider || payload.provider || existingNorm.activeProvider
  );

  const next = {
    enabled: payload.enabled !== undefined ? payload.enabled === true : existingNorm.enabled === true,
    activeProvider,
    provider: activeProvider,
    arkesel: mergeProviderBlob(existingNorm.arkesel, payload.arkesel || {}, userId, now),
    mnotify: mergeProviderBlob(existingNorm.mnotify, payload.mnotify || {}, userId, now),
    monthlyLimit: payload.monthlyLimit !== undefined
      ? parseMonthlyLimit(payload.monthlyLimit)
      : parseMonthlyLimit(existingNorm.monthlyLimit),
    updatedAt: now,
    updatedBy: userId || null,
  };

  return next;
}

async function savePlatformSmsSettings({ payload = {}, userId }) {
  const setting = await Setting.findOne({
    where: { tenantId: null, key: PLATFORM_SMS_SETTINGS_KEY },
  });
  const existing = setting?.value || {};
  const value = mergeSettings({ existing, payload, userId });
  const provider = value.activeProvider;
  const providerLabel = provider === 'mnotify' ? 'Mnotify' : 'Arkesel';

  if (value.enabled && !hasActiveCredentials(value)) {
    const error = new Error(
      `${providerLabel} API key and sender ID are required when platform SMS is enabled.`
    );
    error.statusCode = 400;
    throw error;
  }

  const description = 'Platform SMS provider credentials (multi-provider)';

  if (setting) {
    setting.value = value;
    setting.description = description;
    await setting.save();
  } else {
    await Setting.create({
      tenantId: null,
      key: PLATFORM_SMS_SETTINGS_KEY,
      value,
      description,
    });
  }

  return getPublicSummary(value);
}

function readStoredSecret(value) {
  try {
    return decryptStoredSecret(value);
  } catch (error) {
    const err = new Error(
      `Saved platform SMS credentials cannot be decrypted. Configure ${PLATFORM_SMS_CREDENTIALS_ENCRYPTION_KEY} or enter the credentials again.`
    );
    err.statusCode = 400;
    throw err;
  }
}

/**
 * Build a test config for the requested (or active) provider.
 * @param {{ payload?: object, existing?: object }} args
 * @returns {{ provider: string, apiKey: string, senderId: string }}
 */
function buildTestConfig({ payload = {}, existing = {} }) {
  const existingNorm = normalizeStoredValue(existing);
  const provider = normalizeProvider(
    payload.activeProvider || payload.provider || existingNorm.activeProvider
  );
  const payloadBlob = payload[provider] || {};
  const existingBlob = existingNorm[provider] || {};
  const apiKey = isRealSecret(payloadBlob.apiKey)
    ? clean(payloadBlob.apiKey)
    : readStoredSecret(existingBlob.apiKey) || '';

  if (!apiKey) {
    const label = provider === 'mnotify' ? 'Mnotify' : 'Arkesel';
    const error = new Error(`Enter a ${label} API key or save one first before testing.`);
    error.statusCode = 400;
    throw error;
  }

  return {
    provider,
    apiKey,
    senderId: clean(payloadBlob.senderId) || clean(existingBlob.senderId) || DEFAULT_SENDER_ID,
  };
}

async function testPlatformSmsConnection({ payload = {}, userId, requestId }) {
  const setting = await Setting.findOne({
    where: { tenantId: null, key: PLATFORM_SMS_SETTINGS_KEY },
  });
  const existing = setting?.value || {};
  const config = buildTestConfig({ payload, existing });
  const smsService = require('./smsService');
  const providerPayload = payload[config.provider] || {};
  const result = await smsService.testConnection(config, {
    context: {
      requestId,
      userId,
      source: 'platform_settings_sms_test',
      mode: isRealSecret(providerPayload.apiKey) ? 'form_values' : 'saved',
    },
  });

  if (!result.success) {
    const error = new Error(result.error || 'Failed to verify platform SMS connection');
    error.statusCode = 400;
    throw error;
  }

  // Soft-record last successful test on saved provider when testing saved credentials
  if (setting?.value && !isRealSecret(providerPayload.apiKey)) {
    try {
      const normalized = normalizeStoredValue(setting.value);
      const blob = { ...(normalized[config.provider] || {}) };
      blob.lastTestAt = new Date().toISOString();
      blob.lastError = null;
      normalized[config.provider] = blob;
      setting.value = normalized;
      await setting.save();
    } catch (persistError) {
      console.warn('[Platform SMS settings] Could not persist lastTestAt:', persistError?.message);
    }
  }

  return {
    provider: config.provider,
    message: result.message || 'Platform SMS connection verified successfully',
    data: result.data,
  };
}

/**
 * Migrate legacy communications.smsSender into platform:sms when platform SMS row is missing.
 * @returns {Promise<void>}
 */
async function migrateLegacySmsSender() {
  const [smsSetting, commSetting] = await Promise.all([
    Setting.findOne({ where: { tenantId: null, key: PLATFORM_SMS_SETTINGS_KEY } }),
    Setting.findOne({ where: { tenantId: null, key: 'platform:communications' } }),
  ]);

  if (smsSetting?.value && Object.keys(smsSetting.value).length > 0) return;

  const legacySender = clean(commSetting?.value?.smsSender);
  if (!legacySender) return;

  const value = {
    enabled: false,
    activeProvider: 'arkesel',
    provider: 'arkesel',
    arkesel: { senderId: legacySender },
    mnotify: { senderId: DEFAULT_SENDER_ID },
    monthlyLimit: DEFAULT_MONTHLY_LIMIT,
    updatedAt: new Date().toISOString(),
    migratedFrom: 'platform:communications.smsSender',
  };

  const description = 'Platform SMS provider credentials (multi-provider)';

  if (smsSetting) {
    smsSetting.value = value;
    smsSetting.description = description;
    await smsSetting.save();
  } else {
    await Setting.create({
      tenantId: null,
      key: PLATFORM_SMS_SETTINGS_KEY,
      value,
      description,
    });
  }
}

module.exports = {
  PLATFORM_SMS_SETTINGS_KEY,
  PLATFORM_SMS_CREDENTIALS_ENCRYPTION_KEY,
  PLATFORM_SMS_PROVIDERS,
  DEFAULT_SENDER_ID,
  DEFAULT_MONTHLY_LIMIT,
  normalizeProvider,
  normalizeStoredValue,
  getPlatformSmsSettingsSummary,
  getSavedPlatformSmsConfig,
  getPublicSummary,
  savePlatformSmsSettings,
  testPlatformSmsConnection,
  migrateLegacySmsSender,
  parseMonthlyLimit,
  hasActiveCredentials,
  buildTestConfig,
};
