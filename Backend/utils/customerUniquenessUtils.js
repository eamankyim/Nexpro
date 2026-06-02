const { Op } = require('sequelize');
const { Customer } = require('../models');
const { formatToE164 } = require('./phoneUtils');

/**
 * Normalize phone for duplicate lookups (E.164 when possible).
 * @param {string|null|undefined} phone
 * @returns {string|null}
 */
const normalizePhoneForLookup = (phone) => {
  if (!phone || typeof phone !== 'string') return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;
  try {
    return formatToE164(trimmed) || trimmed;
  } catch {
    return trimmed;
  }
};

/**
 * Build Sequelize where clause for the customer contact uniqueness scope.
 * Studio/shop tenants: unique within branch; others: tenant-wide (null scope columns).
 * @param {object} req
 * @param {string} tenantId
 * @returns {object}
 */
const buildCustomerContactScopeWhere = (req, tenantId) => {
  const base = { tenantId };

  if (req.studioLocationScoped) {
    const studioLocationId = req.studioLocationFilterId || req.defaultStudioLocationId;
    if (studioLocationId) {
      return { ...base, studioLocationId };
    }
  }

  if (req.shopScoped) {
    const shopId = req.shopFilterId || req.defaultShopId;
    if (shopId) {
      return { ...base, shopId };
    }
  }

  return {
    ...base,
    studioLocationId: null,
    shopId: null,
  };
};

/**
 * Phone match conditions (normalized + legacy raw formats).
 * @param {string} phone
 * @returns {object}
 */
const phoneMatchCondition = (phone) => {
  const normalized = normalizePhoneForLookup(phone);
  if (!normalized) return null;

  const rawTrimmed = phone.trim().replace(/[\s\-()]/g, '');
  const variants = [...new Set([normalized, rawTrimmed, phone.trim()].filter(Boolean))];

  return {
    phone: variants.length === 1 ? variants[0] : { [Op.in]: variants },
  };
};

/**
 * Reject when phone or email already exists in the current uniqueness scope.
 * @param {object} req
 * @param {{ phone?: string|null, email?: string|null, excludeCustomerId?: string }} options
 * @throws {Error} statusCode 400
 */
const assertCustomerContactUnique = async (req, { phone, email, excludeCustomerId } = {}) => {
  const tenantId = req.tenantId;
  if (!tenantId) return;

  const scopeWhere = buildCustomerContactScopeWhere(req, tenantId);
  const exclude = excludeCustomerId ? { id: { [Op.ne]: excludeCustomerId } } : {};

  if (phone) {
    const phoneWhere = phoneMatchCondition(phone);
    if (phoneWhere) {
      const existing = await Customer.findOne({
        where: { ...scopeWhere, ...phoneWhere, ...exclude },
        attributes: ['id'],
      });
      if (existing) {
        const err = new Error('Phone number already exists');
        err.statusCode = 400;
        throw err;
      }
    }
  }

  const normalizedEmail =
    email && typeof email === 'string' ? email.trim().toLowerCase() : null;
  if (normalizedEmail) {
    const existing = await Customer.findOne({
      where: {
        ...scopeWhere,
        email: normalizedEmail,
        ...exclude,
      },
      attributes: ['id'],
    });
    if (existing) {
      const err = new Error('Email already exists');
      err.statusCode = 400;
      throw err;
    }
  }
};

module.exports = {
  normalizePhoneForLookup,
  buildCustomerContactScopeWhere,
  phoneMatchCondition,
  assertCustomerContactUnique,
};
