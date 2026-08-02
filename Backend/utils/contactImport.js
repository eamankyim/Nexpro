/**
 * Shared contact import for Customers and Leads (CSV rows or device contacts JSON).
 */

const { Customer, Lead } = require('../models');
const { attachScopedToPayload } = require('./shopUtils');
const {
  assertCustomerContactUnique,
  normalizePhoneForLookup,
  phoneMatchCondition,
  buildCustomerContactScopeWhere,
} = require('./customerUniquenessUtils');
const { invalidateCustomerListCache } = require('../middleware/cache');
const { MAX_ROWS } = require('./importParse');

const DESTINATIONS = new Set(['customers', 'leads']);

/**
 * @param {unknown} value
 * @returns {string|null}
 */
const compactString = (value) => {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
};

/**
 * Normalize a raw contact into a create payload.
 * @param {object} raw
 * @param {{ sourceHint?: string }} [opts]
 */
const normalizeContactPayload = (raw = {}, opts = {}) => {
  const name = compactString(raw.name);
  const phoneRaw = compactString(raw.phone || raw.tel);
  const emailRaw = compactString(raw.email);
  const phone = phoneRaw ? (normalizePhoneForLookup(phoneRaw) || phoneRaw) : null;
  const email = emailRaw ? emailRaw.toLowerCase() : null;

  return {
    name,
    phone,
    email,
    company: compactString(raw.company),
    address: compactString(raw.address),
    city: compactString(raw.city),
    notes: compactString(raw.notes),
    source: compactString(raw.source) || opts.sourceHint || 'import',
  };
};

/**
 * Within-batch dedupe key: phone preferred, else email, else name+index.
 * @param {{ phone?: string|null, email?: string|null }} contact
 * @param {number} index
 */
const batchDedupeKey = (contact, index) => {
  if (contact.phone) return `phone:${contact.phone}`;
  if (contact.email) return `email:${contact.email}`;
  return `name:${String(contact.name || '').toLowerCase()}:${index}`;
};

/**
 * Check if an active lead already exists with the same phone or email.
 * @param {object} req
 * @param {{ phone?: string|null, email?: string|null }} contact
 */
const findExistingLead = async (req, contact) => {
  const tenantId = req.tenantId;
  if (!tenantId) return null;

  const scopeWhere = buildCustomerContactScopeWhere(req, tenantId);
  // Leads use tenantId + optional shop/studio; reuse customer scope columns when present
  const where = { tenantId, isActive: true };
  if (scopeWhere.shopId) where.shopId = scopeWhere.shopId;
  if (scopeWhere.studioLocationId) where.studioLocationId = scopeWhere.studioLocationId;

  if (contact.phone) {
    const phoneWhere = phoneMatchCondition(contact.phone);
    if (phoneWhere) {
      const byPhone = await Lead.findOne({
        where: { ...where, ...phoneWhere },
        attributes: ['id'],
      });
      if (byPhone) return byPhone;
    }
  }

  if (contact.email) {
    return Lead.findOne({
      where: { ...where, email: contact.email },
      attributes: ['id'],
    });
  }

  return null;
};

/**
 * Import contacts into customers or leads.
 * @param {object} req - Express request (tenant + shop/studio context)
 * @param {{
 *   destination: 'customers'|'leads',
 *   contacts: object[],
 *   sourceHint?: string,
 *   rowOffset?: number,
 * }} options
 * @returns {Promise<{
 *   success: boolean,
 *   successCount: number,
 *   skippedCount: number,
 *   errorCount: number,
 *   errors: Array<{ row: number, message: string }>,
 *   skipped: Array<{ row: number, message: string }>,
 * }>}
 */
const importContacts = async (req, {
  destination,
  contacts,
  sourceHint = 'import',
  rowOffset = 1,
} = {}) => {
  if (!DESTINATIONS.has(destination)) {
    const err = new Error("destination must be 'customers' or 'leads'");
    err.statusCode = 400;
    throw err;
  }

  const list = Array.isArray(contacts) ? contacts : [];
  if (list.length === 0) {
    const err = new Error('No contacts to import');
    err.statusCode = 400;
    throw err;
  }
  if (list.length > MAX_ROWS) {
    const err = new Error(`Maximum ${MAX_ROWS} contacts allowed per import`);
    err.statusCode = 400;
    throw err;
  }

  const seen = new Set();
  const errors = [];
  const skipped = [];
  let successCount = 0;

  for (let i = 0; i < list.length; i += 1) {
    const row = rowOffset + i;
    const normalized = normalizeContactPayload(list[i], { sourceHint });

    if (!normalized.name) {
      errors.push({ row, message: 'Name is required' });
      continue;
    }

    const key = batchDedupeKey(normalized, i);
    if (seen.has(key) && (normalized.phone || normalized.email)) {
      skipped.push({ row, message: 'Duplicate in import file' });
      continue;
    }
    seen.add(key);

    try {
      if (destination === 'customers') {
        try {
          await assertCustomerContactUnique(req, {
            phone: normalized.phone,
            email: normalized.email,
          });
        } catch (dupErr) {
          if (dupErr.statusCode === 400) {
            skipped.push({ row, message: dupErr.message || 'Duplicate contact' });
            continue;
          }
          throw dupErr;
        }

        await Customer.create(
          attachScopedToPayload(req, {
            name: normalized.name,
            phone: normalized.phone,
            email: normalized.email,
            company: normalized.company,
            address: normalized.address,
            city: normalized.city,
            notes: normalized.notes,
            tenantId: req.tenantId,
            isActive: true,
            howDidYouHear: 'Import',
          })
        );
        successCount += 1;
      } else {
        const existing = await findExistingLead(req, normalized);
        if (existing) {
          skipped.push({ row, message: 'Lead with this phone or email already exists' });
          continue;
        }

        await Lead.create(
          attachScopedToPayload(req, {
            name: normalized.name,
            phone: normalized.phone,
            email: normalized.email,
            company: normalized.company,
            notes: normalized.notes,
            source: normalized.source || sourceHint,
            status: 'new',
            priority: 'medium',
            tags: [],
            tenantId: req.tenantId,
            createdBy: req.user?.id || null,
            isActive: true,
          })
        );
        successCount += 1;
      }
    } catch (error) {
      errors.push({
        row,
        message: error?.message || 'Failed to create contact',
      });
    }
  }

  if (destination === 'customers' && successCount > 0) {
    invalidateCustomerListCache(req.tenantId);
  }

  return {
    success: errors.length === 0,
    successCount,
    skippedCount: skipped.length,
    errorCount: errors.length,
    errors,
    skipped,
  };
};

module.exports = {
  DESTINATIONS,
  normalizeContactPayload,
  importContacts,
  MAX_ROWS,
};
