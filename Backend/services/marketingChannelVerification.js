const crypto = require('crypto');
const { Tenant } = require('../models');
const emailService = require('./emailService');
const smsService = require('./smsService');
const whatsappService = require('./whatsappService');

const CHANNELS = ['email', 'sms', 'whatsapp'];

/**
 * Stable hash of a JSON-serializable object (sorted keys) for config identity — no raw secrets.
 * @param {object} obj
 * @returns {string}
 */
function hashConfig(obj) {
  const norm = JSON.stringify(obj, Object.keys(obj || {}).sort());
  return crypto.createHash('sha256').update(norm, 'utf8').digest('hex');
}

function tokenFingerprint(token) {
  if (!token || typeof token !== 'string' || token.trim() === '') return 'none';
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex').slice(0, 16);
}

/**
 * Fingerprint from persisted email setting value (tenant outbound).
 * @param {object|null} v
 * @returns {string|null}
 */
function fingerprintEmailFromStored(v) {
  if (!v || !v.enabled) return null;
  const provider = (v.provider || 'smtp').toLowerCase();
  const base = { provider, fromEmail: (v.fromEmail || '').trim(), fromName: (v.fromName || '').trim() };
  if (provider === 'smtp' || provider === 'mailjet') {
    if (!v.smtpHost || !v.smtpUser) return null;
    Object.assign(base, {
      smtpHost: String(v.smtpHost).trim(),
      smtpPort: Number(v.smtpPort) || 587,
      smtpUser: String(v.smtpUser).trim(),
    });
  } else if (provider === 'sendgrid') {
    if (!v.sendgridApiKey) return null;
    Object.assign(base, { sendgridKeyFp: tokenFingerprint(v.sendgridApiKey) });
  } else if (provider === 'ses') {
    if (!v.sesAccessKeyId) return null;
    Object.assign(base, {
      sesAccessKeyId: String(v.sesAccessKeyId).trim(),
      sesRegion: String(v.sesRegion || 'us-east-1').trim(),
      sesHost: (v.sesHost || '').trim(),
    });
  } else {
    return null;
  }
  return hashConfig(base);
}

/**
 * Fingerprint from persisted SMS setting value.
 * @param {object|null} v
 * @returns {string|null}
 */
function fingerprintSmsFromStored(v) {
  if (!v || !v.enabled) return null;
  const provider = (v.provider || 'termii').toLowerCase();
  const base = { provider };
  if (provider === 'termii') {
    if (!v.apiKey || !String(v.senderId || '').trim()) return null;
    base.senderId = String(v.senderId).trim();
    base.apiKeyFp = tokenFingerprint(v.apiKey);
  } else if (provider === 'twilio') {
    if (!v.accountSid || !v.fromNumber) return null;
    base.accountSid = String(v.accountSid).trim();
    base.fromNumber = String(v.fromNumber).trim();
    base.authTokenFp = tokenFingerprint(v.authToken);
  } else if (provider === 'africas_talking') {
    if (!v.apiKey || !v.username || !v.fromNumber) return null;
    base.username = String(v.username).trim();
    base.fromNumber = String(v.fromNumber).trim();
    base.apiKeyFp = tokenFingerprint(v.apiKey);
  } else {
    return null;
  }
  return hashConfig(base);
}

/**
 * Fingerprint from persisted WhatsApp setting value.
 * @param {object|null} v
 * @returns {string|null}
 */
function fingerprintWhatsappFromStored(v) {
  if (!v || !v.enabled || !v.phoneNumberId) return null;
  return hashConfig({
    phoneNumberId: String(v.phoneNumberId).trim(),
    businessAccountId: String(v.businessAccountId || '').trim(),
    templateNamespace: String(v.templateNamespace || '').trim(),
    tokenFp: tokenFingerprint(v.accessToken),
  });
}

/**
 * Current fingerprints for all channels (null if channel not configured / unavailable).
 * @param {string} tenantId
 * @returns {Promise<{ email: string|null, sms: string|null, whatsapp: string|null }>}
 */
async function computeConfigFingerprints(tenantId) {
  const [emailCfg, smsCfg, waCfg] = await Promise.all([
    emailService.getConfig(tenantId),
    smsService.getResolvedConfig(tenantId),
    whatsappService.getConfig(tenantId),
  ]);
  return {
    email: fingerprintEmailFromStored(emailCfg),
    sms: fingerprintSmsFromStored(smsCfg),
    whatsapp: fingerprintWhatsappFromStored(waCfg),
  };
}

/**
 * Remove stale verification entries when integration config changed.
 * @param {string} tenantId
 * @returns {Promise<{ fingerprints: object, marketingChannels: object }>}
 */
async function reconcileStaleVerifications(tenantId) {
  const tenant = await Tenant.findByPk(tenantId, { attributes: ['id', 'metadata'] });
  if (!tenant) {
    return { fingerprints: { email: null, sms: null, whatsapp: null }, marketingChannels: {} };
  }
  const fingerprints = await computeConfigFingerprints(tenantId);
  const metadata = { ...(tenant.metadata || {}) };
  let mc = { ...(metadata.marketingChannels || {}) };
  let dirty = false;
  for (const ch of CHANNELS) {
    const entry = mc[ch];
    if (!entry || !entry.configFingerprint) continue;
    if (entry.configFingerprint !== fingerprints[ch]) {
      delete mc[ch];
      dirty = true;
    }
  }
  if (dirty) {
    metadata.marketingChannels = mc;
    await tenant.update({ metadata });
  }
  return { fingerprints, marketingChannels: mc };
}

/**
 * @param {string} tenantId
 * @param {object} baseCapabilities - from resolveCapabilities (email/sms/whatsapp .available etc.)
 * @returns {Promise<object>} same shape + verified + verifiedAt per channel
 */
async function enrichCapabilitiesWithVerification(tenantId, baseCapabilities) {
  const { fingerprints, marketingChannels } = await reconcileStaleVerifications(tenantId);
  const out = {};
  for (const ch of CHANNELS) {
    const base = baseCapabilities[ch] || {};
    const fp = fingerprints[ch];
    const entry = marketingChannels[ch];
    const verified = !!(base.available && fp && entry && entry.configFingerprint === fp && entry.verifiedAt);
    out[ch] = {
      ...base,
      verified,
      verifiedAt: verified ? entry.verifiedAt : null,
    };
  }
  return out;
}

/**
 * Persist verified state for a channel (call after successful settings save, test, or broadcast).
 * @param {string} tenantId
 * @param {'email'|'sms'|'whatsapp'} channel
 * @param {string|null} [fingerprintOverride] - if null, computed from live settings
 */
async function markChannelVerified(tenantId, channel, fingerprintOverride = null) {
  if (!CHANNELS.includes(channel)) return;
  const fp = fingerprintOverride || (await computeConfigFingerprints(tenantId))[channel];
  if (!fp) return;
  const tenant = await Tenant.findByPk(tenantId, { attributes: ['id', 'metadata'] });
  if (!tenant) return;
  const metadata = { ...(tenant.metadata || {}) };
  const mc = { ...(metadata.marketingChannels || {}) };
  mc[channel] = { verifiedAt: new Date().toISOString(), configFingerprint: fp };
  metadata.marketingChannels = mc;
  await tenant.update({ metadata });
}

/**
 * Clear verification for one channel (e.g. integration disabled).
 * @param {string} tenantId
 * @param {'email'|'sms'|'whatsapp'} channel
 */
async function clearChannelVerification(tenantId, channel) {
  if (!CHANNELS.includes(channel)) return;
  const tenant = await Tenant.findByPk(tenantId, { attributes: ['id', 'metadata'] });
  if (!tenant) return;
  const metadata = { ...(tenant.metadata || {}) };
  const mc = { ...(metadata.marketingChannels || {}) };
  delete mc[channel];
  metadata.marketingChannels = mc;
  await tenant.update({ metadata });
}

/**
 * After settings save: mark verified if enabled, else clear.
 * @param {string} tenantId
 * @param {'email'|'sms'|'whatsapp'} channel
 * @param {boolean} enabled
 */
async function applyVerificationAfterIntegrationSave(tenantId, channel, enabled) {
  if (enabled) {
    await markChannelVerified(tenantId, channel);
  } else {
    await clearChannelVerification(tenantId, channel);
  }
}

/**
 * After a successful broadcast: mark channels that actually sent at least one message.
 * @param {string} tenantId
 * @param {boolean} dryRun
 * @param {object} result - marketing postBroadcast result.data
 */
async function applyVerificationAfterBroadcast(tenantId, dryRun, result) {
  if (dryRun || !result) return;
  const tasks = [];
  if (result.email?.sent > 0) tasks.push(markChannelVerified(tenantId, 'email'));
  if (result.sms?.sent > 0) tasks.push(markChannelVerified(tenantId, 'sms'));
  if (result.whatsapp?.sent > 0) tasks.push(markChannelVerified(tenantId, 'whatsapp'));
  await Promise.all(tasks);
}

module.exports = {
  CHANNELS,
  computeConfigFingerprints,
  enrichCapabilitiesWithVerification,
  markChannelVerified,
  clearChannelVerification,
  applyVerificationAfterIntegrationSave,
  applyVerificationAfterBroadcast,
};
