const { Setting } = require('../models');
const { decryptSecret, encryptSecret, hasKey } = require('../utils/secretCrypto');

const PLATFORM_EMAIL_SETTINGS_KEY = 'platform:email';
const PLATFORM_EMAIL_CREDENTIALS_ENCRYPTION_KEY = 'PLATFORM_EMAIL_CREDENTIALS_ENCRYPTION_KEY';
const PROVIDERS = ['sendgrid', 'gmail'];

const clean = (value) => String(value || '').trim();
const isRealSecret = (value) => typeof value === 'string' && value.trim() !== '' && value !== '***';
const last4 = (value) => clean(value).slice(-4);
const maskLast4 = (value) => (value ? `•••• ${value}` : '');

function envFallbackProvider() {
  const provider = clean(process.env.PLATFORM_EMAIL_PROVIDER).toLowerCase();
  return PROVIDERS.includes(provider) ? provider : 'sendgrid';
}

function getEnvStatus() {
  const sendgridApiKey = clean(process.env.PLATFORM_SENDGRID_API_KEY);
  const gmailUser = clean(
    process.env.PLATFORM_GMAIL_USER ||
      process.env.GMAIL_USER ||
      process.env.PLATFORM_SMTP_USER ||
      process.env.PLATFORM_EMAIL_SMTP_USER
  );
  const gmailPassword = clean(
    process.env.PLATFORM_GMAIL_APP_PASSWORD ||
      process.env.GMAIL_APP_PASSWORD ||
      process.env.PLATFORM_GMAIL_PASSWORD ||
      process.env.GMAIL_PASSWORD ||
      process.env.PLATFORM_SMTP_PASSWORD ||
      process.env.PLATFORM_EMAIL_SMTP_PASSWORD
  );

  return {
    sendgridConfigured: Boolean(sendgridApiKey && clean(process.env.PLATFORM_EMAIL_FROM)),
    gmailConfigured: Boolean(gmailUser && gmailPassword),
  };
}

function normalizeProvider(value) {
  const provider = clean(value).toLowerCase();
  return PROVIDERS.includes(provider) ? provider : envFallbackProvider();
}

function getPublicSummary(value = {}) {
  const sendgrid = value.sendgrid || {};
  const gmail = value.gmail || {};
  return {
    provider: normalizeProvider(value.provider),
    availableProviders: PROVIDERS,
    encryptionConfigured: hasKey(PLATFORM_EMAIL_CREDENTIALS_ENCRYPTION_KEY),
    envFallback: getEnvStatus(),
    sendgrid: {
      apiKeyConfigured: Boolean(sendgrid.apiKey),
      apiKeyMasked: maskLast4(sendgrid.apiKeyLast4),
      fromEmail: sendgrid.fromEmail || '',
      fromName: sendgrid.fromName || '',
      updatedAt: sendgrid.updatedAt || null,
    },
    gmail: {
      user: gmail.user || '',
      passwordConfigured: Boolean(gmail.password),
      passwordMasked: maskLast4(gmail.passwordLast4),
      fromEmail: gmail.fromEmail || '',
      fromName: gmail.fromName || '',
      updatedAt: gmail.updatedAt || null,
    },
    updatedAt: value.updatedAt || null,
  };
}

async function getPlatformEmailSettingsSummary() {
  const setting = await Setting.findOne({
    where: { tenantId: null, key: PLATFORM_EMAIL_SETTINGS_KEY },
  });
  return getPublicSummary(setting?.value || {});
}

function decryptStoredSecret(value) {
  return value ? decryptSecret(value, PLATFORM_EMAIL_CREDENTIALS_ENCRYPTION_KEY) : '';
}

function buildStoredConfig(value = {}) {
  const provider = normalizeProvider(value.provider);
  if (provider === 'sendgrid') {
    const apiKey = decryptStoredSecret(value.sendgrid?.apiKey);
    const fromEmail = clean(value.sendgrid?.fromEmail);
    if (!apiKey || !fromEmail) return null;
    return {
      provider: 'sendgrid',
      sendgridApiKey: apiKey,
      fromEmail,
      fromName: clean(value.sendgrid?.fromName) || process.env.APP_NAME || 'African Business Suite',
    };
  }

  if (provider === 'gmail') {
    const user = clean(value.gmail?.user);
    const password = decryptStoredSecret(value.gmail?.password);
    if (!user || !password) return null;
    return {
      provider: 'gmail',
      smtpHost: value.gmail?.smtpHost || 'smtp.gmail.com',
      smtpPort: parseInt(value.gmail?.smtpPort || '465', 10),
      smtpUser: user,
      smtpPassword: password,
      smtpRejectUnauthorized: true,
      fromEmail: clean(value.gmail?.fromEmail) || user,
      fromName: clean(value.gmail?.fromName) || process.env.APP_NAME || 'African Business Suite',
    };
  }

  return null;
}

async function getSavedPlatformEmailConfig() {
  const setting = await Setting.findOne({
    where: { tenantId: null, key: PLATFORM_EMAIL_SETTINGS_KEY },
  });
  if (!setting?.value || !Object.keys(setting.value).length) return null;

  try {
    return buildStoredConfig(setting.value);
  } catch (error) {
    console.warn('[Platform email settings] Could not read saved provider credentials:', error?.message);
    return null;
  }
}

function requireEncryptionForNewSecret(secret) {
  if (isRealSecret(secret) && !hasKey(PLATFORM_EMAIL_CREDENTIALS_ENCRYPTION_KEY)) {
    const error = new Error('Server is missing PLATFORM_EMAIL_CREDENTIALS_ENCRYPTION_KEY (64 hex chars). Configure it before saving platform email credentials.');
    error.statusCode = 400;
    throw error;
  }
}

function hasSubmittedSecret(payload = {}) {
  return isRealSecret(payload.sendgrid?.apiKey) || isRealSecret(payload.gmail?.password);
}

function mergeProviderSettings({ existing = {}, payload = {}, userId }) {
  const now = new Date().toISOString();
  const next = {
    provider: normalizeProvider(payload.provider || existing.provider),
    sendgrid: { ...(existing.sendgrid || {}) },
    gmail: { ...(existing.gmail || {}) },
    updatedAt: now,
    updatedBy: userId || null,
  };

  const sendgridPayload = payload.sendgrid || {};
  const gmailPayload = payload.gmail || {};

  if (sendgridPayload.fromEmail !== undefined) next.sendgrid.fromEmail = clean(sendgridPayload.fromEmail);
  if (sendgridPayload.fromName !== undefined) next.sendgrid.fromName = clean(sendgridPayload.fromName);
  if (isRealSecret(sendgridPayload.apiKey)) {
    requireEncryptionForNewSecret(sendgridPayload.apiKey);
    const apiKey = clean(sendgridPayload.apiKey);
    next.sendgrid.apiKey = encryptSecret(apiKey, PLATFORM_EMAIL_CREDENTIALS_ENCRYPTION_KEY);
    next.sendgrid.apiKeyLast4 = last4(apiKey);
    next.sendgrid.updatedAt = now;
    next.sendgrid.updatedBy = userId || null;
  }

  if (gmailPayload.user !== undefined) next.gmail.user = clean(gmailPayload.user);
  if (gmailPayload.fromEmail !== undefined) next.gmail.fromEmail = clean(gmailPayload.fromEmail);
  if (gmailPayload.fromName !== undefined) next.gmail.fromName = clean(gmailPayload.fromName);
  if (isRealSecret(gmailPayload.password)) {
    requireEncryptionForNewSecret(gmailPayload.password);
    const password = clean(gmailPayload.password);
    next.gmail.password = encryptSecret(password, PLATFORM_EMAIL_CREDENTIALS_ENCRYPTION_KEY);
    next.gmail.passwordLast4 = last4(password);
    next.gmail.updatedAt = now;
    next.gmail.updatedBy = userId || null;
  }

  return next;
}

function hasActiveProviderCredentials(value = {}) {
  const provider = normalizeProvider(value.provider);
  if (provider === 'sendgrid') {
    return Boolean(value.sendgrid?.apiKey && clean(value.sendgrid?.fromEmail));
  }
  if (provider === 'gmail') {
    return Boolean(value.gmail?.user && value.gmail?.password);
  }
  return false;
}

async function savePlatformEmailSettings({ payload = {}, userId }) {
  const provider = normalizeProvider(payload.provider);
  const setting = await Setting.findOne({
    where: { tenantId: null, key: PLATFORM_EMAIL_SETTINGS_KEY },
  });
  const existing = setting?.value || {};
  const value = mergeProviderSettings({
    existing,
    payload: { ...payload, provider },
    userId,
  });

  if (!hasActiveProviderCredentials(value) && hasSubmittedSecret(payload)) {
    const error = new Error(provider === 'sendgrid'
      ? 'SendGrid API key and sender email are required for the active platform email provider.'
      : 'Gmail address and app password are required for the active platform email provider.');
    error.statusCode = 400;
    throw error;
  }

  if (setting) {
    setting.value = value;
    setting.description = 'Platform email provider credentials';
    await setting.save();
  } else {
    await Setting.create({
      tenantId: null,
      key: PLATFORM_EMAIL_SETTINGS_KEY,
      value,
      description: 'Platform email provider credentials',
    });
  }

  return getPublicSummary(value);
}

function readStoredSecret(value) {
  try {
    return decryptStoredSecret(value);
  } catch (error) {
    const err = new Error(`Saved platform email credentials cannot be decrypted. Configure ${PLATFORM_EMAIL_CREDENTIALS_ENCRYPTION_KEY} or enter the credentials again.`);
    err.statusCode = 400;
    throw err;
  }
}

function buildTestConfig({ payload = {}, existing = {} }) {
  const provider = normalizeProvider(payload.provider || existing.provider);
  const emailService = require('./emailService');
  const envConfig = emailService.getPlatformConfig(provider) || {};

  if (provider === 'sendgrid') {
    const sendgridPayload = payload.sendgrid || {};
    const sendgridExisting = existing.sendgrid || {};
    const apiKey = isRealSecret(sendgridPayload.apiKey)
      ? clean(sendgridPayload.apiKey)
      : readStoredSecret(sendgridExisting.apiKey) || envConfig.sendgridApiKey || '';
    const fromEmail = clean(sendgridPayload.fromEmail) || clean(sendgridExisting.fromEmail) || clean(envConfig.fromEmail);

    if (!apiKey) {
      const error = new Error('Enter a SendGrid API key, save one first, or configure PLATFORM_SENDGRID_API_KEY.');
      error.statusCode = 400;
      throw error;
    }

    return {
      provider: 'sendgrid',
      sendgridApiKey: apiKey,
      fromEmail,
      fromName: clean(sendgridPayload.fromName) || clean(sendgridExisting.fromName) || envConfig.fromName,
    };
  }

  const gmailPayload = payload.gmail || {};
  const gmailExisting = existing.gmail || {};
  const user = clean(gmailPayload.user) || clean(gmailExisting.user) || clean(envConfig.smtpUser);
  const password = isRealSecret(gmailPayload.password)
    ? clean(gmailPayload.password)
    : readStoredSecret(gmailExisting.password) || envConfig.smtpPassword || '';

  if (!user || !password) {
    const error = new Error('Enter a Gmail address and app password, save them first, or configure platform Gmail environment credentials.');
    error.statusCode = 400;
    throw error;
  }

  return {
    provider: 'gmail',
    smtpHost: gmailPayload.smtpHost || gmailExisting.smtpHost || envConfig.smtpHost || 'smtp.gmail.com',
    smtpPort: parseInt(gmailPayload.smtpPort || gmailExisting.smtpPort || envConfig.smtpPort || '465', 10),
    smtpUser: user,
    smtpPassword: password,
    smtpRejectUnauthorized: true,
    fromEmail: clean(gmailPayload.fromEmail) || clean(gmailExisting.fromEmail) || clean(envConfig.fromEmail) || user,
    fromName: clean(gmailPayload.fromName) || clean(gmailExisting.fromName) || envConfig.fromName,
  };
}

async function testPlatformEmailConnection({ payload = {}, userId, requestId }) {
  const setting = await Setting.findOne({
    where: { tenantId: null, key: PLATFORM_EMAIL_SETTINGS_KEY },
  });
  const config = buildTestConfig({
    payload,
    existing: setting?.value || {},
  });
  const emailService = require('./emailService');
  const result = await emailService.testConnection(config, {
    context: {
      requestId,
      userId,
      source: 'platform_settings_email_test',
      mode: hasSubmittedSecret(payload) ? 'form_values' : 'saved_or_env',
    },
  });

  if (!result.success) {
    const error = new Error(result.error || 'Failed to verify platform email connection');
    error.statusCode = 400;
    throw error;
  }

  return {
    provider: config.provider,
    message: result.message || 'Platform email connection verified successfully',
  };
}

module.exports = {
  PLATFORM_EMAIL_SETTINGS_KEY,
  PLATFORM_EMAIL_CREDENTIALS_ENCRYPTION_KEY,
  PROVIDERS,
  getPlatformEmailSettingsSummary,
  getSavedPlatformEmailConfig,
  getPublicSummary,
  savePlatformEmailSettings,
  testPlatformEmailConnection,
};
