const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const {
  PlatformOpsAsset,
  PlatformOpsSecretReveal,
  PlatformOpsRevealChallenge,
  User,
  Customer,
  Tenant,
} = require('../models');
const { encryptSecret, decryptSecret, hasKey, isEncryptedSecret } = require('../utils/secretCrypto');
const emailService = require('./emailService');

const OPS_ASSETS_CREDENTIALS_ENCRYPTION_KEY = 'OPS_ASSETS_CREDENTIALS_ENCRYPTION_KEY';
const OPS_ASSETS_SECRET_EMAIL = 'OPS_ASSETS_SECRET_EMAIL';
const PLATFORM_TENANT_SLUG = 'platform';
const ASSET_TYPES = new Set(['domain', 'server', 'service', 'other']);
const OTP_TTL_MS = 10 * 60 * 1000;
const REVEAL_TTL_MS = 5 * 60 * 1000;

const CUSTOMER_INCLUDE = {
  model: Customer,
  as: 'customer',
  attributes: ['id', 'name', 'company', 'email'],
  required: false,
};

/**
 * Platform tenant used for admin-owned customers.
 * @returns {Promise<string>}
 */
async function getPlatformTenantId() {
  let tenant = await Tenant.findOne({ where: { slug: PLATFORM_TENANT_SLUG } });
  if (!tenant) {
    tenant = await Tenant.create({
      name: 'Platform',
      slug: PLATFORM_TENANT_SLUG,
      status: 'active',
      plan: 'trial',
    });
  }
  return tenant.id;
}

/**
 * Validate optional customerId belongs to platform customers.
 * @param {string|null|undefined} customerId
 * @returns {Promise<string|null>}
 */
async function resolveCustomerId(customerId) {
  if (customerId === undefined) return undefined;
  if (customerId === null || customerId === '' || customerId === 'none') return null;
  const platformTenantId = await getPlatformTenantId();
  const customer = await Customer.findOne({
    where: { id: customerId, tenantId: platformTenantId },
    attributes: ['id'],
  });
  if (!customer) {
    const err = new Error('Customer not found');
    err.statusCode = 400;
    throw err;
  }
  return customer.id;
}

/**
 * List platform customers for the ops asset picker.
 * @returns {Promise<object[]>}
 */
async function listCustomerOptions() {
  const platformTenantId = await getPlatformTenantId();
  return Customer.findAll({
    where: { tenantId: platformTenantId },
    attributes: ['id', 'name', 'company', 'email'],
    order: [
      ['company', 'ASC'],
      ['name', 'ASC'],
    ],
  });
}

/**
 * Create a platform customer from IT Ops (same folder as Admin Customers).
 * @param {object} body
 * @returns {Promise<object>}
 */
async function createCustomer(body = {}) {
  const name = String(body.name || '').trim();
  if (!name) {
    const err = new Error('Name is required');
    err.statusCode = 400;
    throw err;
  }
  const emailRaw = body.email != null ? String(body.email).trim() : '';
  if (emailRaw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    const err = new Error('Invalid email');
    err.statusCode = 400;
    throw err;
  }

  const platformTenantId = await getPlatformTenantId();
  const customer = await Customer.create({
    tenantId: platformTenantId,
    name,
    company: body.company != null ? String(body.company).trim() || null : null,
    email: emailRaw || null,
    phone: body.phone != null ? String(body.phone).trim() || null : null,
    address: body.address != null ? String(body.address).trim() || null : null,
    city: body.city != null ? String(body.city).trim() || null : null,
    state: body.state != null ? String(body.state).trim() || null : null,
    notes: body.notes != null ? String(body.notes).trim() || null : null,
  });

  return {
    id: customer.id,
    name: customer.name,
    company: customer.company,
    email: customer.email,
    phone: customer.phone,
  };
}

/**
 * Superadmin-configured inbox for reveal OTP codes.
 * @returns {string}
 */
function getOpsSecretEmail() {
  const email = String(process.env[OPS_ASSETS_SECRET_EMAIL] || '').trim();
  if (!email || !email.includes('@')) {
    const err = new Error(
      `Server is missing ${OPS_ASSETS_SECRET_EMAIL}. Configure the secret inbox before revealing ops passwords.`
    );
    err.statusCode = 400;
    throw err;
  }
  return email;
}

/**
 * @param {string|null|undefined} plain
 * @returns {string|null}
 */
function encryptPassword(plain) {
  if (plain == null || String(plain).trim() === '') return null;
  if (!hasKey(OPS_ASSETS_CREDENTIALS_ENCRYPTION_KEY)) {
    const err = new Error(
      'Server is missing OPS_ASSETS_CREDENTIALS_ENCRYPTION_KEY (64 hex chars). Configure it before storing ops passwords.'
    );
    err.statusCode = 400;
    throw err;
  }
  return encryptSecret(String(plain), OPS_ASSETS_CREDENTIALS_ENCRYPTION_KEY);
}

/**
 * @param {string|null|undefined} encrypted
 * @returns {string|null}
 */
function decryptPassword(encrypted) {
  if (!encrypted) return null;
  if (!isEncryptedSecret(encrypted) && !hasKey(OPS_ASSETS_CREDENTIALS_ENCRYPTION_KEY)) {
    return encrypted;
  }
  return decryptSecret(encrypted, OPS_ASSETS_CREDENTIALS_ENCRYPTION_KEY);
}

/**
 * Public shape never includes plaintext password.
 * @param {object} asset
 * @returns {object}
 */
function toPublicAsset(asset) {
  const plain = asset?.toJSON ? asset.toJSON() : { ...asset };
  const hasPassword = Boolean(plain.passwordEncrypted);
  delete plain.passwordEncrypted;
  return {
    ...plain,
    hasPassword,
    passwordMasked: hasPassword ? '••••••' : null,
  };
}

/**
 * @param {object} body
 * @returns {{ type: string, name: string, status: string, expiresOn: string|null, loginUrl: string|null, username: string|null, notes: string|null, details: object, password?: string|null }}
 */
function normalizeAssetPayload(body = {}) {
  const type = String(body.type || '').toLowerCase().trim();
  if (!ASSET_TYPES.has(type)) {
    const err = new Error('Invalid type. Expected domain, server, service, or other.');
    err.statusCode = 400;
    throw err;
  }
  const name = String(body.name || '').trim();
  if (!name) {
    const err = new Error('Name is required');
    err.statusCode = 400;
    throw err;
  }
  const status = body.status === 'archived' ? 'archived' : 'active';
  const details = body.details && typeof body.details === 'object' ? body.details : {};
  const extras = {};
  if (type === 'domain' && body.registrar != null) extras.registrar = String(body.registrar).trim();
  if (type === 'server') {
    if (body.hostOrIp != null) extras.hostOrIp = String(body.hostOrIp).trim();
    if (body.provider != null) extras.provider = String(body.provider).trim();
  }
  if (type === 'service' && body.vendor != null) extras.vendor = String(body.vendor).trim();

  return {
    type,
    name,
    status,
    expiresOn: body.expiresOn || null,
    loginUrl: body.loginUrl ? String(body.loginUrl).trim() : null,
    username: body.username != null ? String(body.username).trim() : null,
    notes: body.notes != null ? String(body.notes) : null,
    details: { ...details, ...extras },
    password: body.password !== undefined ? body.password : undefined,
    customerId: body.customerId !== undefined ? body.customerId : undefined,
  };
}

async function listAssets({ type, status, search, expiryWindow } = {}) {
  const where = {};
  if (type && ASSET_TYPES.has(String(type).toLowerCase())) {
    where.type = String(type).toLowerCase();
  }
  // Default: show all (active + archived). Pass status=active|archived to filter.
  if (status === 'active' || status === 'archived') {
    where.status = status;
  }
  if (search && String(search).trim()) {
    const q = `%${String(search).trim()}%`;
    where[Op.or] = [
      { name: { [Op.iLike]: q } },
      { username: { [Op.iLike]: q } },
      { notes: { [Op.iLike]: q } },
    ];
  }

  const today = new Date();
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  const startOfThisMonth = new Date(Date.UTC(y, m, 1));
  const startOfNextMonth = new Date(Date.UTC(y, m + 1, 1));
  const startOfMonthAfter = new Date(Date.UTC(y, m + 2, 1));
  const todayStr = today.toISOString().slice(0, 10);

  if (expiryWindow === 'overdue') {
    where.expiresOn = { [Op.lt]: todayStr };
  } else if (expiryWindow === 'this_month') {
    where.expiresOn = {
      [Op.gte]: startOfThisMonth.toISOString().slice(0, 10),
      [Op.lt]: startOfNextMonth.toISOString().slice(0, 10),
    };
  } else if (expiryWindow === 'next_month') {
    where.expiresOn = {
      [Op.gte]: startOfNextMonth.toISOString().slice(0, 10),
      [Op.lt]: startOfMonthAfter.toISOString().slice(0, 10),
    };
  }

  const rows = await PlatformOpsAsset.findAll({
    where,
    include: [CUSTOMER_INCLUDE],
    order: [
      [sequelize.literal('CASE WHEN "PlatformOpsAsset"."status" = \'archived\' THEN 1 ELSE 0 END'), 'ASC'],
      [sequelize.literal('CASE WHEN "PlatformOpsAsset"."expiresOn" IS NULL THEN 1 ELSE 0 END'), 'ASC'],
      ['expiresOn', 'ASC'],
      ['name', 'ASC'],
    ],
  });
  return rows.map(toPublicAsset);
}

async function getAssetById(id) {
  return PlatformOpsAsset.findByPk(id, { include: [CUSTOMER_INCLUDE] });
}

async function createAsset(body, userId) {
  const payload = normalizeAssetPayload(body);
  const customerId = await resolveCustomerId(payload.customerId);
  const passwordEncrypted =
    payload.password !== undefined ? encryptPassword(payload.password) : null;
  const asset = await PlatformOpsAsset.create({
    type: payload.type,
    name: payload.name,
    status: payload.status,
    expiresOn: payload.expiresOn,
    loginUrl: payload.loginUrl,
    username: payload.username,
    passwordEncrypted,
    details: payload.details,
    notes: payload.notes,
    customerId: customerId === undefined ? null : customerId,
    createdBy: userId || null,
    updatedBy: userId || null,
  });
  const full = await getAssetById(asset.id);
  return toPublicAsset(full || asset);
}

async function updateAsset(id, body, userId) {
  const asset = await PlatformOpsAsset.findByPk(id);
  if (!asset) return null;

  const merged = {
    type: body.type ?? asset.type,
    name: body.name ?? asset.name,
    status: body.status ?? asset.status,
    expiresOn: body.expiresOn !== undefined ? body.expiresOn : asset.expiresOn,
    loginUrl: body.loginUrl !== undefined ? body.loginUrl : asset.loginUrl,
    username: body.username !== undefined ? body.username : asset.username,
    notes: body.notes !== undefined ? body.notes : asset.notes,
    details: body.details !== undefined ? body.details : asset.details,
    registrar: body.registrar,
    hostOrIp: body.hostOrIp,
    provider: body.provider,
    vendor: body.vendor,
    password: body.password,
    customerId: body.customerId !== undefined ? body.customerId : asset.customerId,
  };
  const payload = normalizeAssetPayload(merged);
  const customerId = await resolveCustomerId(payload.customerId);

  asset.type = payload.type;
  asset.name = payload.name;
  asset.status = payload.status;
  asset.expiresOn = payload.expiresOn;
  asset.loginUrl = payload.loginUrl;
  asset.username = payload.username;
  asset.notes = payload.notes;
  asset.details = payload.details;
  asset.updatedBy = userId || null;
  if (customerId !== undefined) {
    asset.customerId = customerId;
  }
  if (payload.password !== undefined) {
    if (payload.password === '' || payload.password == null) {
      asset.passwordEncrypted = null;
    } else {
      asset.passwordEncrypted = encryptPassword(payload.password);
    }
  }
  await asset.save();
  const full = await getAssetById(asset.id);
  return toPublicAsset(full || asset);
}

async function archiveAsset(id, userId) {
  const asset = await PlatformOpsAsset.findByPk(id);
  if (!asset) return null;
  asset.status = 'archived';
  asset.updatedBy = userId || null;
  await asset.save();
  return toPublicAsset(asset);
}

async function getStats() {
  const today = new Date();
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  const todayStr = today.toISOString().slice(0, 10);
  const startOfThisMonth = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const startOfNextMonth = new Date(Date.UTC(y, m + 1, 1)).toISOString().slice(0, 10);
  const startOfMonthAfter = new Date(Date.UTC(y, m + 2, 1)).toISOString().slice(0, 10);

  const activeWhere = { status: 'active' };
  const [overdue, thisMonth, nextMonth, byTypeRows] = await Promise.all([
    PlatformOpsAsset.count({
      where: { ...activeWhere, expiresOn: { [Op.lt]: todayStr } },
    }),
    PlatformOpsAsset.count({
      where: {
        ...activeWhere,
        expiresOn: { [Op.gte]: startOfThisMonth, [Op.lt]: startOfNextMonth },
      },
    }),
    PlatformOpsAsset.count({
      where: {
        ...activeWhere,
        expiresOn: { [Op.gte]: startOfNextMonth, [Op.lt]: startOfMonthAfter },
      },
    }),
    PlatformOpsAsset.findAll({
      attributes: ['type', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      where: activeWhere,
      group: ['type'],
      raw: true,
    }),
  ]);

  const byType = { domain: 0, server: 0, service: 0, other: 0 };
  for (const row of byTypeRows) {
    if (byType[row.type] != null) byType[row.type] = Number(row.count) || 0;
  }

  return {
    overdue,
    thisMonth,
    nextMonth,
    byType,
    totalActive: Object.values(byType).reduce((a, b) => a + b, 0),
  };
}

async function logReveal({ assetId, requestedBy, method, success }) {
  await PlatformOpsSecretReveal.create({
    assetId,
    requestedBy: requestedBy || null,
    method,
    success: Boolean(success),
  });
}

/**
 * Start a reveal challenge: send OTP to the configured secret ops email.
 */
async function startRevealChallenge({ assetId, userId, userName }) {
  const asset = await PlatformOpsAsset.findByPk(assetId);
  if (!asset || asset.status === 'archived') {
    const err = new Error('Asset not found');
    err.statusCode = 404;
    throw err;
  }
  if (!asset.passwordEncrypted) {
    const err = new Error('This asset has no password stored');
    err.statusCode = 400;
    throw err;
  }

  const secretEmail = getOpsSecretEmail();
  const code = String(crypto.randomInt(100000, 999999));
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await PlatformOpsRevealChallenge.create({
    assetId,
    userId,
    codeHash,
    expiresAt,
  });

  const subject = `IT Ops reveal code for ${asset.name}`;
  const safeName = String(asset.name || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const safeUser = String(userName || 'Admin')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const html = `
    <h2>IT Ops secret reveal</h2>
    <p>A reveal was requested by <strong>${safeUser}</strong>.</p>
    <p>One-time code to reveal the password for <strong>${safeName}</strong>:</p>
    <p style="font-size:24px;letter-spacing:4px;font-weight:bold;">${code}</p>
    <p>This code expires in 10 minutes. If you did not expect this, ignore this email.</p>
  `.trim();
  const text = [
    'IT Ops secret reveal',
    `Requested by: ${userName || 'Admin'}`,
    `Asset: ${asset.name}`,
    `Code: ${code}`,
    'Expires in 10 minutes.',
  ].join('\n');

  const sendResult = await emailService.sendPlatformMessage(
    secretEmail,
    subject,
    html,
    text,
    [],
    {
      categories: ['transactional', 'security'],
      context: { source: 'platform_ops_reveal_otp', assetId, userId },
    }
  );
  if (!sendResult?.success) {
    const err = new Error(sendResult?.error || 'Failed to send reveal code email');
    err.statusCode = 502;
    throw err;
  }

  return {
    method: 'email_otp',
    ready: true,
    expiresAt,
    emailedTo: emailService.maskEmail(secretEmail),
  };
}

/**
 * Confirm email OTP and return plaintext secret once.
 */
async function confirmReveal({ assetId, userId, code }) {
  const asset = await PlatformOpsAsset.findByPk(assetId);
  if (!asset || asset.status === 'archived') {
    const err = new Error('Asset not found');
    err.statusCode = 404;
    throw err;
  }
  if (!asset.passwordEncrypted) {
    const err = new Error('This asset has no password stored');
    err.statusCode = 400;
    throw err;
  }

  const method = 'email_otp';
  const user = await User.findByPk(userId);
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 401;
    throw err;
  }

  try {
    if (!code) {
      const err = new Error('Code is required');
      err.statusCode = 400;
      throw err;
    }
    const challenge = await PlatformOpsRevealChallenge.findOne({
      where: {
        assetId,
        userId,
        consumedAt: null,
        expiresAt: { [Op.gt]: new Date() },
      },
      order: [['createdAt', 'DESC']],
    });
    if (!challenge) {
      await logReveal({ assetId, requestedBy: userId, method, success: false });
      const err = new Error('Reveal code expired or not found. Request a new code.');
      err.statusCode = 400;
      throw err;
    }
    const ok = await bcrypt.compare(String(code).trim(), challenge.codeHash);
    if (!ok) {
      await logReveal({ assetId, requestedBy: userId, method, success: false });
      const err = new Error('Invalid reveal code');
      err.statusCode = 401;
      throw err;
    }
    challenge.consumedAt = new Date();
    await challenge.save();

    const secret = decryptPassword(asset.passwordEncrypted);
    await logReveal({ assetId, requestedBy: userId, method, success: true });
    return {
      secret,
      expiresAt: new Date(Date.now() + REVEAL_TTL_MS),
      assetId: asset.id,
      assetName: asset.name,
    };
  } catch (err) {
    if (err.statusCode) throw err;
    await logReveal({ assetId, requestedBy: userId, method, success: false }).catch(() => {});
    throw err;
  }
}

async function listReveals(assetId) {
  return PlatformOpsSecretReveal.findAll({
    where: { assetId },
    order: [['createdAt', 'DESC']],
    limit: 50,
    include: [{ model: User, as: 'requester', attributes: ['id', 'name', 'email'], required: false }],
  });
}

module.exports = {
  OPS_ASSETS_CREDENTIALS_ENCRYPTION_KEY,
  OPS_ASSETS_SECRET_EMAIL,
  ASSET_TYPES,
  encryptPassword,
  decryptPassword,
  getOpsSecretEmail,
  toPublicAsset,
  normalizeAssetPayload,
  listAssets,
  getAssetById,
  createAsset,
  updateAsset,
  archiveAsset,
  getStats,
  listCustomerOptions,
  createCustomer,
  startRevealChallenge,
  confirmReveal,
  listReveals,
};
