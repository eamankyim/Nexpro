const { Setting } = require('../models');
const { decryptSecret, encryptSecret, hasKey } = require('../utils/secretCrypto');

const AI_SETTINGS_KEY = 'ai';
const AI_CREDENTIALS_ENCRYPTION_KEY = 'AI_CREDENTIALS_ENCRYPTION_KEY';
const PROVIDER = 'anthropic';

function normalizedSystemKey() {
  return (process.env.ANTHROPIC_API_KEY || '').replace(/\r?\n/g, '').trim();
}

function normalizeApiKey(value) {
  return String(value || '').replace(/\r?\n/g, '').trim();
}

function maskApiKey(last4) {
  return last4 ? `•••• ${last4}` : '••••';
}

async function findTenantAiSetting(tenantId) {
  if (!tenantId) return null;
  return Setting.findOne({
    where: {
      tenantId,
      key: AI_SETTINGS_KEY
    }
  });
}

function publicSummaryFromValue(value = {}) {
  const configured = Boolean(value.apiKey);
  return {
    provider: PROVIDER,
    source: configured ? 'tenant' : (normalizedSystemKey() ? 'system' : 'none'),
    apiKeyConfigured: configured,
    apiKeyMasked: configured ? maskApiKey(value.apiKeyLast4) : '',
    systemConfigured: Boolean(normalizedSystemKey()),
    encryptionConfigured: hasKey(AI_CREDENTIALS_ENCRYPTION_KEY),
    updatedAt: value.updatedAt || null
  };
}

async function getTenantAiSettingsSummary(tenantId) {
  const setting = await findTenantAiSetting(tenantId);
  return publicSummaryFromValue(setting?.value || {});
}

async function getTenantAnthropicApiKey(tenantId) {
  const setting = await findTenantAiSetting(tenantId);
  const storedKey = setting?.value?.apiKey;
  if (!storedKey) return null;

  try {
    const decrypted = decryptSecret(storedKey, AI_CREDENTIALS_ENCRYPTION_KEY);
    return normalizeApiKey(decrypted) || null;
  } catch (error) {
    console.warn('[AI settings] Could not read tenant AI key; falling back to system key', {
      tenantId,
      message: error?.message
    });
    return null;
  }
}

async function saveTenantAiApiKey({ tenantId, apiKey, userId }) {
  const normalizedKey = normalizeApiKey(apiKey);
  if (!tenantId) {
    const error = new Error('Tenant context is required');
    error.statusCode = 400;
    throw error;
  }
  if (!normalizedKey || normalizedKey.length < 20) {
    const error = new Error('Enter a valid Anthropic API key');
    error.statusCode = 400;
    throw error;
  }
  if (!hasKey(AI_CREDENTIALS_ENCRYPTION_KEY)) {
    const error = new Error('Server is missing AI_CREDENTIALS_ENCRYPTION_KEY (64 hex chars). Ask your administrator to configure it before saving AI keys.');
    error.statusCode = 503;
    throw error;
  }

  const value = {
    provider: PROVIDER,
    apiKey: encryptSecret(normalizedKey, AI_CREDENTIALS_ENCRYPTION_KEY),
    apiKeyLast4: normalizedKey.slice(-4),
    updatedBy: userId || null,
    updatedAt: new Date().toISOString()
  };

  const [setting, created] = await Setting.findOrCreate({
    where: {
      tenantId,
      key: AI_SETTINGS_KEY
    },
    defaults: {
      tenantId,
      key: AI_SETTINGS_KEY,
      value,
      description: 'Tenant AI provider credentials'
    }
  });

  if (!created) {
    setting.value = value;
    setting.description = 'Tenant AI provider credentials';
    await setting.save();
  }

  return publicSummaryFromValue(value);
}

async function clearTenantAiApiKey(tenantId) {
  const setting = await findTenantAiSetting(tenantId);
  if (setting) {
    await setting.destroy();
  }
  return publicSummaryFromValue({});
}

module.exports = {
  AI_CREDENTIALS_ENCRYPTION_KEY,
  getTenantAiSettingsSummary,
  getTenantAnthropicApiKey,
  saveTenantAiApiKey,
  clearTenantAiApiKey
};
