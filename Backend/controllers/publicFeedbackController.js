const { Tenant, Setting, CustomerFeedback } = require('../models');
const { resolveBusinessType } = require('../config/businessTypes');
const { ensureDefaultStudioLocation } = require('../utils/studioLocationUtils');
const { getTenantLogoUrl } = require('../utils/tenantLogo');

const MAX_COMMENT = 5000;
const MAX_FIELD = 255;
const MAX_PHONE = 50;
const MAX_SOURCE_REF = 255;
const MAX_CATEGORY = 120;
const MAX_REVIEW_CATEGORY_ITEMS = 20;
const MAX_REVIEW_CATEGORY_LABEL = 80;

function buildOrganizationPublicPayload(organization, tenant) {
  const phone = typeof organization?.phone === 'string' ? organization.phone.trim().slice(0, 50) : '';
  const email = typeof organization?.email === 'string' ? organization.email.trim().slice(0, 255) : '';
  return {
    name: organization?.name || tenant?.name || '',
    logoUrl: organization?.logoUrl || getTenantLogoUrl(tenant),
    primaryColor: organization?.primaryColor || tenant?.metadata?.primaryColor || '#166534',
    phone: phone || null,
    email: email || null,
  };
}

function trimString(value, maxLen) {
  if (value == null || typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

/**
 * Tenant override list for public review form (metadata.reviewCategories).
 * @param {unknown} raw
 * @returns {string[]|null}
 */
function sanitizeReviewCategoryList(raw) {
  if (!Array.isArray(raw)) return null;
  const out = [];
  for (const x of raw.slice(0, MAX_REVIEW_CATEGORY_ITEMS)) {
    const s = trimString(String(x ?? ''), MAX_REVIEW_CATEGORY_LABEL);
    if (s) out.push(s);
  }
  return out.length ? out : null;
}

/**
 * GET /api/public/feedback/branding/:tenantSlug
 */
exports.getPublicFeedbackBranding = async (req, res, next) => {
  try {
    const { tenantSlug } = req.params;
    if (!tenantSlug || typeof tenantSlug !== 'string') {
      return res.status(404).json({ success: false, message: 'Not found.' });
    }

    const tenant = await Tenant.findOne({
      where: { slug: tenantSlug.trim() },
      attributes: ['id', 'name', 'metadata', 'status', 'businessType']
    });

    if (!tenant || tenant.status === 'suspended') {
      return res.status(404).json({ success: false, message: 'Not found.' });
    }

    const organizationRow = await Setting.findOne({
      where: { tenantId: tenant.id, key: 'organization' }
    });
    const organization = buildOrganizationPublicPayload(organizationRow?.value, tenant);
    const reviewCategories = sanitizeReviewCategoryList(tenant.metadata?.reviewCategories);

    res.status(200).json({
      success: true,
      data: {
        organization,
        businessType: tenant.businessType || null,
        reviewCategories
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/public/feedback
 * Body: tenantSlug, rating, comment?, name?, email?, phone?, category?, source?, sourceRef?
 */
exports.submitPublicFeedback = async (req, res, next) => {
  try {
    const body = req.body || {};
    const tenantSlug = trimString(body.tenantSlug, 150);
    const ratingRaw = body.rating;
    const rating = Number(ratingRaw);

    if (!tenantSlug) {
      return res.status(400).json({
        success: false,
        message: 'Unable to submit.'
      });
    }

    if (!Number.isFinite(rating) || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Please choose a rating from 1 to 5.'
      });
    }

    const tenant = await Tenant.findOne({
      where: { slug: tenantSlug },
      attributes: ['id', 'name', 'status', 'businessType']
    });

    if (!tenant || tenant.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Unable to submit.'
      });
    }

    const comment = trimString(body.comment, MAX_COMMENT) || null;
    const contactName = trimString(body.name, MAX_FIELD) || null;
    const contactEmail = trimString(body.email, MAX_FIELD) || null;
    const contactPhone = trimString(body.phone, MAX_PHONE) || null;

    let source = trimString(body.source, 50).toLowerCase() || 'direct';
    if (!['direct', 'invoice', 'job'].includes(source)) {
      source = 'direct';
    }

    const sourceRef = trimString(body.sourceRef, MAX_SOURCE_REF) || null;
    const category = trimString(body.category, MAX_CATEGORY) || null;

    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email or leave it blank.'
      });
    }

    const metadata = category ? { category } : {};
    const studioLocationId =
      resolveBusinessType(tenant.businessType) === 'studio'
        ? (await ensureDefaultStudioLocation(tenant.id, tenant.name || 'Main studio'))?.id || null
        : null;

    const row = await CustomerFeedback.create({
      tenantId: tenant.id,
      studioLocationId,
      rating,
      comment,
      contactName,
      contactEmail,
      contactPhone,
      source,
      sourceRef,
      metadata
    });

    res.status(201).json({
      success: true,
      data: { id: row.id }
    });
  } catch (error) {
    next(error);
  }
};
