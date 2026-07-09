const { Setting } = require('../models');
const { decryptSecret, encryptSecret, hasKey } = require('../utils/secretCrypto');

const PLATFORM_SMS_SETTINGS_KEY = 'platform:sms';
const PLATFORM_SMS_CREDENTIALS_ENCRYPTION_KEY = 'PLATFORM_SMS_CREDENTIALS_ENCRYPTION_KEY';
const DEFAULT_SENDER_ID = 'ABS';
const DEFAULT_MONTHLY_LIMIT = 100;

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

function getPublicSummary(value = {}) {
  return {
    enabled: value.enabled === true,
    provider: 'arkesel',
    encryptionConfigured: encryptionConfigured(),
    arkesel: {
      apiKeyConfigured: Boolean(value.arkesel?.apiKey),
      apiKeyMasked: maskLast4(value.arkesel?.apiKeyLast4),
      senderId: clean(value.arkesel?.senderId) || DEFAULT_SENDER_ID,
      updatedAt: value.arkesel?.updatedAt || null,
    },
    monthlyLimit: parseMonthlyLimit(value.monthlyLimit),
    updatedAt: value.updatedAt || null,
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

function hasActiveCredentials(value = {}) {
  return Boolean(value.enabled === true && value.arkesel?.apiKey && clean(value.arkesel?.senderId || DEFAULT_SENDER_ID));
}

function buildStoredConfig(value = {}) {
  if (!hasActiveCredentials(value)) return null;
  const apiKey = decryptStoredSecret(value.arkesel?.apiKey);
  const senderId = clean(value.arkesel?.senderId) || DEFAULT_SENDER_ID;
  if (!apiKey || !senderId) return null;
  return {
    enabled: true,
    provider: 'arkesel',
    apiKey,
    senderId: senderId.substring(0, 11),
    monthlyLimit: parseMonthlyLimit(value.monthlyLimit),
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

function mergeSettings({ existing = {}, payload = {}, userId }) {
  const now = new Date().toISOString();
  const arkeselPayload = payload.arkesel || {};
  const arkeselExisting = existing.arkesel || {};

  const next = {
    enabled: payload.enabled !== undefined ? payload.enabled === true : existing.enabled === true,
    provider: 'arkesel',
    arkesel: { ...arkeselExisting },
    monthlyLimit: payload.monthlyLimit !== undefined
      ? parseMonthlyLimit(payload.monthlyLimit)
      : parseMonthlyLimit(existing.monthlyLimit),
    updatedAt: now,
    updatedBy: userId || null,
  };

  if (arkeselPayload.senderId !== undefined) {
    next.arkesel.senderId = clean(arkeselPayload.senderId) || DEFAULT_SENDER_ID;
  } else if (!next.arkesel.senderId) {
    next.arkesel.senderId = DEFAULT_SENDER_ID;
  }

  if (isRealSecret(arkeselPayload.apiKey)) {
    requireEncryptionForNewSecret(arkeselPayload.apiKey);
    const apiKey = clean(arkeselPayload.apiKey);
    next.arkesel.apiKey = encryptSecret(apiKey, PLATFORM_SMS_CREDENTIALS_ENCRYPTION_KEY);
    next.arkesel.apiKeyLast4 = last4(apiKey);
    next.arkesel.updatedAt = now;
    next.arkesel.updatedBy = userId || null;
  }

  return next;
}

async function savePlatformSmsSettings({ payload = {}, userId }) {
  const setting = await Setting.findOne({
    where: { tenantId: null, key: PLATFORM_SMS_SETTINGS_KEY },
  });
  const existing = setting?.value || {};
  const value = mergeSettings({ existing, payload, userId });

  const submittedApiKey = isRealSecret(payload.arkesel?.apiKey);
  if (value.enabled && !hasActiveCredentials(value) && submittedApiKey) {
    const error = new Error('Arkesel API key and sender ID are required when platform SMS is enabled.');
    error.statusCode = 400;
    throw error;
  }

  if (setting) {
    setting.value = value;
    setting.description = 'Platform SMS provider credentials (Arkesel)';
    await setting.save();
  } else {
    await Setting.create({
      tenantId: null,
      key: PLATFORM_SMS_SETTINGS_KEY,
      value,
      description: 'Platform SMS provider credentials (Arkesel)',
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

function buildTestConfig({ payload = {}, existing = {} }) {
  const arkeselPayload = payload.arkesel || {};
  const arkeselExisting = existing.arkesel || {};
  const apiKey = isRealSecret(arkeselPayload.apiKey)
    ? clean(arkeselPayload.apiKey)
    : readStoredSecret(arkeselExisting.apiKey) || '';

  if (!apiKey) {
    const error = new Error('Enter an Arkesel API key or save one first before testing.');
    error.statusCode = 400;
    throw error;
  }

  return {
    provider: 'arkesel',
    apiKey,
    senderId: clean(arkeselPayload.senderId) || clean(arkeselExisting.senderId) || DEFAULT_SENDER_ID,
  };
}

async function testPlatformSmsConnection({ payload = {}, userId, requestId }) {
  const setting = await Setting.findOne({
    where: { tenantId: null, key: PLATFORM_SMS_SETTINGS_KEY },
  });
  const config = buildTestConfig({
    payload,
    existing: setting?.value || {},
  });
  const smsService = require('./smsService');
  const result = await smsService.testConnection(config, {
    context: {
      requestId,
      userId,
      source: 'platform_settings_sms_test',
      mode: isRealSecret(payload.arkesel?.apiKey) ? 'form_values' : 'saved',
    },
  });

  if (!result.success) {
    const error = new Error(result.error || 'Failed to verify platform SMS connection');
    error.statusCode = 400;
    throw error;
  }

  return {
    provider: 'arkesel',
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
    provider: 'arkesel',
    arkesel: { senderId: legacySender },
    monthlyLimit: DEFAULT_MONTHLY_LIMIT,
    updatedAt: new Date().toISOString(),
    migratedFrom: 'platform:communications.smsSender',
  };

  if (smsSetting) {
    smsSetting.value = value;
    smsSetting.description = 'Platform SMS provider credentials (Arkesel)';
    await smsSetting.save();
  } else {
    await Setting.create({
      tenantId: null,
      key: PLATFORM_SMS_SETTINGS_KEY,
      value,
      description: 'Platform SMS provider credentials (Arkesel)',
    });
  }
}

module.exports = {
  PLATFORM_SMS_SETTINGS_KEY,
  PLATFORM_SMS_CREDENTIALS_ENCRYPTION_KEY,
  DEFAULT_SENDER_ID,
  DEFAULT_MONTHLY_LIMIT,
  getPlatformSmsSettingsSummary,
  getSavedPlatformSmsConfig,
  getPublicSummary,
  savePlatformSmsSettings,
  testPlatformSmsConnection,
  migrateLegacySmsSender,
  parseMonthlyLimit,
};
