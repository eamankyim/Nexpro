const { Setting } = require('../models');
const { decryptSecret, encryptSecret, hasKey } = require('../utils/secretCrypto');

const PLATFORM_EMAIL_SETTINGS_KEY = 'platform:email';
const PLATFORM_EMAIL_CREDENTIALS_ENCRYPTION_KEY = 'PLATFORM_EMAIL_CREDENTIALS_ENCRYPTION_KEY';
const PROVIDERS = ['sendgrid', 'smtp'];

const clean = (value) => String(value || '').trim();
const isRealSecret = (value) => typeof value === 'string' && value.trim() !== '' && value !== '***';
const last4 = (value) => clean(value).slice(-4);
const maskLast4 = (value) => (value ? `•••• ${value}` : '');

function envFallbackProvider() {
  const provider = clean(process.env.PLATFORM_EMAIL_PROVIDER).toLowerCase();
  if (provider === 'gmail') return 'smtp';
  return PROVIDERS.includes(provider) ? provider : 'sendgrid';
}

function getEnvStatus() {
  const sendgridApiKey = clean(process.env.PLATFORM_SENDGRID_API_KEY);
  const legacyGmailUser = clean(process.env.PLATFORM_GMAIL_USER || process.env.GMAIL_USER);
  const legacyGmailPassword = clean(
    process.env.PLATFORM_GMAIL_APP_PASSWORD ||
      process.env.GMAIL_APP_PASSWORD ||
      process.env.PLATFORM_GMAIL_PASSWORD ||
      process.env.GMAIL_PASSWORD
  );
  const smtpHost = clean(
    process.env.PLATFORM_SMTP_HOST ||
      process.env.PLATFORM_EMAIL_SMTP_HOST ||
      process.env.PLATFORM_GMAIL_SMTP_HOST ||
      (legacyGmailUser && legacyGmailPassword ? 'smtp.gmail.com' : '')
  );
  const smtpUser = clean(
    legacyGmailUser ||
      process.env.PLATFORM_SMTP_USER ||
      process.env.PLATFORM_EMAIL_SMTP_USER
  );
  const smtpPassword = clean(
    legacyGmailPassword ||
      process.env.PLATFORM_SMTP_PASSWORD ||
      process.env.PLATFORM_EMAIL_SMTP_PASSWORD
  );

  return {
    sendgridConfigured: Boolean(sendgridApiKey && clean(process.env.PLATFORM_EMAIL_FROM)),
    smtpConfigured: Boolean(smtpHost && smtpUser && smtpPassword),
    gmailConfigured: Boolean(smtpUser && smtpPassword),
  };
}

function normalizeProvider(value) {
  const provider = clean(value).toLowerCase();
  if (provider === 'gmail') return 'smtp';
  return PROVIDERS.includes(provider) ? provider : envFallbackProvider();
}

function getPublicSummary(value = {}) {
  const sendgrid = value.sendgrid || {};
  const smtp = value.smtp || value.gmail || {};
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
    smtp: {
      smtpHost: smtp.smtpHost || (value.gmail ? 'smtp.gmail.com' : ''),
      smtpPort: smtp.smtpPort || (value.gmail ? 587 : ''),
      smtpUser: smtp.smtpUser || smtp.user || '',
      passwordConfigured: Boolean(smtp.password),
      passwordMasked: maskLast4(smtp.passwordLast4),
      fromEmail: smtp.fromEmail || '',
      fromName: smtp.fromName || '',
      updatedAt: smtp.updatedAt || null,
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

  if (provider === 'smtp') {
    const smtp = value.smtp || value.gmail || {};
    const user = clean(smtp.smtpUser || smtp.user);
    const password = decryptStoredSecret(smtp.password);
    const host = clean(smtp.smtpHost) || (value.gmail ? 'smtp.gmail.com' : '');
    const port = parseInt(smtp.smtpPort || (value.gmail ? '587' : '587'), 10);
    if (!host || !user || !password) return null;
    return {
      provider: 'smtp',
      smtpHost: host,
      smtpPort: port,
      smtpUser: user,
      smtpPassword: password,
      smtpRejectUnauthorized: true,
      fromEmail: clean(smtp.fromEmail) || user,
      fromName: clean(smtp.fromName) || process.env.APP_NAME || 'African Business Suite',
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
  return isRealSecret(payload.sendgrid?.apiKey) || isRealSecret(payload.smtp?.password) || isRealSecret(payload.gmail?.password);
}

function mergeProviderSettings({ existing = {}, payload = {}, userId }) {
  const now = new Date().toISOString();
  const next = {
    provider: normalizeProvider(payload.provider || existing.provider),
    sendgrid: { ...(existing.sendgrid || {}) },
    smtp: { ...(existing.smtp || {}) },
    updatedAt: now,
    updatedBy: userId || null,
  };

  const sendgridPayload = payload.sendgrid || {};
  const legacyGmail = existing.gmail || {};
  const smtpPayload = payload.smtp || payload.gmail || {};

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

  if (!next.smtp.password && legacyGmail.password) {
    next.smtp.password = legacyGmail.password;
    next.smtp.passwordLast4 = legacyGmail.passwordLast4;
    next.smtp.updatedAt = legacyGmail.updatedAt;
    next.smtp.updatedBy = legacyGmail.updatedBy;
  }
  if (!next.smtp.smtpHost && legacyGmail.smtpHost) next.smtp.smtpHost = legacyGmail.smtpHost;
  if (!next.smtp.smtpHost && legacyGmail.password) next.smtp.smtpHost = 'smtp.gmail.com';
  if (!next.smtp.smtpPort && legacyGmail.smtpPort) next.smtp.smtpPort = legacyGmail.smtpPort;
  if (!next.smtp.smtpPort && legacyGmail.password) next.smtp.smtpPort = 587;
  if (!next.smtp.smtpUser && legacyGmail.user) next.smtp.smtpUser = legacyGmail.user;
  if (!next.smtp.fromEmail && legacyGmail.fromEmail) next.smtp.fromEmail = legacyGmail.fromEmail;
  if (!next.smtp.fromName && legacyGmail.fromName) next.smtp.fromName = legacyGmail.fromName;

  if (smtpPayload.smtpHost !== undefined) next.smtp.smtpHost = clean(smtpPayload.smtpHost);
  if (smtpPayload.smtpPort !== undefined) next.smtp.smtpPort = smtpPayload.smtpPort === '' ? '' : parseInt(smtpPayload.smtpPort, 10);
  if (smtpPayload.smtpUser !== undefined || smtpPayload.user !== undefined) next.smtp.smtpUser = clean(smtpPayload.smtpUser || smtpPayload.user);
  if (smtpPayload.fromEmail !== undefined) next.smtp.fromEmail = clean(smtpPayload.fromEmail);
  if (smtpPayload.fromName !== undefined) next.smtp.fromName = clean(smtpPayload.fromName);
  if (isRealSecret(smtpPayload.password)) {
    requireEncryptionForNewSecret(smtpPayload.password);
    const password = clean(smtpPayload.password);
    next.smtp.password = encryptSecret(password, PLATFORM_EMAIL_CREDENTIALS_ENCRYPTION_KEY);
    next.smtp.passwordLast4 = last4(password);
    next.smtp.updatedAt = now;
    next.smtp.updatedBy = userId || null;
  }

  return next;
}

function hasActiveProviderCredentials(value = {}) {
  const provider = normalizeProvider(value.provider);
  if (provider === 'sendgrid') {
    return Boolean(value.sendgrid?.apiKey && clean(value.sendgrid?.fromEmail));
  }
  if (provider === 'smtp') {
    const smtp = value.smtp || value.gmail || {};
    return Boolean(clean(smtp.smtpHost || (value.gmail ? 'smtp.gmail.com' : '')) && clean(smtp.smtpUser || smtp.user) && smtp.password);
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
      : 'SMTP host, user, and password are required for the active platform email provider.');
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

  const smtpPayload = payload.smtp || payload.gmail || {};
  const smtpExisting = existing.smtp || existing.gmail || {};
  const host = clean(smtpPayload.smtpHost) || clean(smtpExisting.smtpHost) || clean(envConfig.smtpHost) || (existing.gmail ? 'smtp.gmail.com' : '');
  const user = clean(smtpPayload.smtpUser || smtpPayload.user) || clean(smtpExisting.smtpUser || smtpExisting.user) || clean(envConfig.smtpUser);
  const password = isRealSecret(smtpPayload.password)
    ? clean(smtpPayload.password)
    : readStoredSecret(smtpExisting.password) || envConfig.smtpPassword || '';

  if (!host || !user || !password) {
    const error = new Error('Enter SMTP host, user, and password; save them first; or configure platform SMTP environment credentials.');
    error.statusCode = 400;
    throw error;
  }

  return {
    provider: 'smtp',
    smtpHost: host,
    smtpPort: parseInt(smtpPayload.smtpPort || smtpExisting.smtpPort || envConfig.smtpPort || '587', 10),
    smtpUser: user,
    smtpPassword: password,
    smtpRejectUnauthorized: true,
    fromEmail: clean(smtpPayload.fromEmail) || clean(smtpExisting.fromEmail) || clean(envConfig.fromEmail) || user,
    fromName: clean(smtpPayload.fromName) || clean(smtpExisting.fromName) || envConfig.fromName,
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
