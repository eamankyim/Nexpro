const { Op } = require('sequelize');
const { SupportAccessSession, Tenant } = require('../models');
const { normalizeTenantInstanceForRequest } = require('./tenantClassification');

const DEFAULT_SESSION_HOURS = 4;
const MAX_REASON_LENGTH = 500;

const resolveSupportSessionId = (req) => {
  const header =
    req.headers['x-support-session-id'] ||
    req.headers['x-support-session'] ||
    null;
  return header ? String(header).trim() : null;
};

/**
 * Load an active support session for the current platform admin.
 * @param {string} sessionId
 * @param {string} adminUserId
 * @param {string} [tenantId] - optional tenant to match
 */
const findActiveSupportSession = async (sessionId, adminUserId, tenantId = null) => {
  if (!sessionId || !adminUserId) return null;

  const where = {
    id: sessionId,
    adminUserId,
    endedAt: null,
    expiresAt: { [Op.gt]: new Date() },
  };
  if (tenantId) {
    where.tenantId = tenantId;
  }

  const session = await SupportAccessSession.findOne({
    where,
    include: [{ model: Tenant, as: 'tenant' }],
  });

  return session;
};

/**
 * End any other active sessions for this admin (one active session at a time).
 */
const endOtherActiveSessions = async (adminUserId, exceptSessionId = null, transaction = null) => {
  const where = {
    adminUserId,
    endedAt: null,
  };
  if (exceptSessionId) {
    where.id = { [Op.ne]: exceptSessionId };
  }

  await SupportAccessSession.update(
    { endedAt: new Date() },
    { where, transaction }
  );
};

const buildSupportTenantContext = (session) => {
  const tenant = normalizeTenantInstanceForRequest(session.tenant);
  return {
    tenantId: session.tenantId,
    tenant,
    tenantRole: 'support',
    isSupportAccess: true,
    supportAccessSession: session,
    supportAccessMode: session.mode || 'read_only',
  };
};

const SUPPORT_ACCESS_MODES = {
  READ_ONLY: 'read_only',
  CONFIGURATION: 'configuration',
};

const isConfigurationSupportMode = (mode) => mode === SUPPORT_ACCESS_MODES.CONFIGURATION;

module.exports = {
  DEFAULT_SESSION_HOURS,
  MAX_REASON_LENGTH,
  SUPPORT_ACCESS_MODES,
  resolveSupportSessionId,
  findActiveSupportSession,
  endOtherActiveSessions,
  buildSupportTenantContext,
  isConfigurationSupportMode,
};
