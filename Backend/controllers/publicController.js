const { Lead, Job, Sale, Customer, Setting, Tenant, JobStatusHistory } = require('../models');
const { Op } = require('sequelize');
const { formatToE164, normalizePhoneNumber } = require('../utils/phoneUtils');
const { resolveBusinessType } = require('../config/businessTypes');
const { getTenantLogoUrl } = require('../utils/tenantLogo');

const JOB_INVOICE_TRACK_DEFAULTS = {
  customerJobTrackingEnabled: false
};

/** @param {{ deliveryStatus?: string|null, deliveryRequired?: boolean }} job */
function publicTimelineKindForJob(job) {
  if (job?.deliveryRequired === true) return 'delivery';
  return job?.deliveryStatus ? 'delivery' : 'job';
}

/** @param {{ metadata?: object }} tenant @param {{ deliveryStatus?: string|null, orderStatus?: string|null }} sale */
function publicTimelineKindForSale(tenant, sale) {
  if (sale?.deliveryStatus) return 'delivery';
  const shopType =
    tenant?.metadata && typeof tenant.metadata === 'object' ? tenant.metadata.shopType : null;
  if (shopType === 'restaurant' && sale?.orderStatus) return 'kitchen';
  return 'order';
}
/** Same outcome for wrong slug / wrong combo — do not reveal which failed. */
const LOOKUP_NO_MATCH_MESSAGE = 'No match found';
const LOOKUP_NO_MATCH_HINT = 'Check your ID and phone, then try again—or contact the business.';

const LOOKUP_PHONE_INVALID_MESSAGE = 'Check your phone number';
const LOOKUP_PHONE_INVALID_HINT = 'Try adding your country code (e.g. +233).';

function lookupNoMatchResponse() {
  return {
    success: false,
    message: LOOKUP_NO_MATCH_MESSAGE,
    hint: LOOKUP_NO_MATCH_HINT
  };
}

function lookupPhoneInvalidResponse() {
  return {
    success: false,
    message: LOOKUP_PHONE_INVALID_MESSAGE,
    hint: LOOKUP_PHONE_INVALID_HINT
  };
}

function normalizeLookupPhone(phone) {
  if (!phone || typeof phone !== 'string') return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;

  const e164 = formatToE164(trimmed);
  const normalized = normalizePhoneNumber(trimmed);
  const normalizedNoPlus = normalized.replace(/^\+/, '');

  const candidates = new Set(
    [trimmed, normalized, e164, normalizedNoPlus].filter(Boolean)
  );

  return Array.from(candidates);
}

function buildOrganizationPublicPayload(organization, tenant) {
  return {
    name: organization?.name || tenant?.name || '',
    logoUrl: organization?.logoUrl || getTenantLogoUrl(tenant),
    primaryColor: organization?.primaryColor || tenant?.metadata?.primaryColor || '#166534'
  };
}

function buildSafeCustomer(customer) {
  if (!customer) return null;
  return {
    name: customer.name || customer.company || 'Customer'
  };
}

/**
 * Submit a demo booking from the marketing site. Creates an admin lead (control center)
 * so platform admins can see and follow up. No auth required.
 * POST /api/public/demo-booking
 * Body: { name, email, phone, preferredDate?, preferredTime? }
 */
exports.submitDemoBooking = async (req, res, next) => {
  try {
    const { name, email, phone, preferredDate, preferredTime } = req.body || {};

    const trimmedName = typeof name === 'string' ? name.trim() : '';
    const trimmedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const trimmedPhone = typeof phone === 'string' ? phone.trim() : '';

    if (!trimmedName || trimmedName.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Name must be at least 2 characters',
        errorCode: 'VALIDATION_ERROR'
      });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      return res.status(400).json({
        success: false,
        error: 'Valid email is required',
        errorCode: 'VALIDATION_ERROR'
      });
    }
    if (!trimmedPhone || trimmedPhone.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required (at least 6 characters)',
        errorCode: 'VALIDATION_ERROR'
      });
    }

    const notes = [preferredDate, preferredTime].filter(Boolean).length
      ? `Demo requested: ${[preferredDate, preferredTime].filter(Boolean).join(' at ')}`
      : 'Demo requested from website';

    const lead = await Lead.create({
      tenantId: null,
      name: trimmedName,
      email: trimmedEmail,
      phone: trimmedPhone,
      source: 'website_demo',
      status: 'new',
      priority: 'medium',
      notes: notes || null,
      metadata: {
        preferredDate: preferredDate || null,
        preferredTime: preferredTime || null,
        source: 'website_demo'
      },
      createdBy: null
    });

    res.status(201).json({
      success: true,
      data: { id: lead.id }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Public job tracking (no login). Requires tenant to enable customer job tracking.
 * GET /api/public/jobs/track/:token
 */
exports.getJobTrackByToken = async (req, res, next) => {
  try {
    const { token } = req.params;
    if (!token || typeof token !== 'string' || token.length < 16) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    const job = await Job.findOne({
      where: {
        viewToken: token,
        tenantId: { [Op.ne]: null }
      },
      include: [
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'name', 'company']
        }
      ]
    });

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    const settingRow = await Setting.findOne({ where: { tenantId: job.tenantId, key: 'job-invoice' } });
    const flags = { ...JOB_INVOICE_TRACK_DEFAULTS, ...(settingRow?.value || {}) };
    if (flags.customerJobTrackingEnabled !== true) {
      return res.status(404).json({
        success: false,
        message: 'This tracking link is not available.'
      });
    }

    const orgRow = await Setting.findOne({ where: { tenantId: job.tenantId, key: 'organization' } });
    const organization = orgRow?.value || {};
    const tenant = await Tenant.findByPk(job.tenantId, {
      attributes: ['id', 'name', 'metadata']
    });

    const latestInProgressHistory = await JobStatusHistory.findOne({
      where: {
        jobId: job.id,
        tenantId: job.tenantId,
        status: 'in_progress'
      },
      order: [['createdAt', 'DESC']],
      attributes: ['createdAt']
    });
    const inProgressAt = latestInProgressHistory?.createdAt || null;

    const safeJob = {
      jobNumber: job.jobNumber,
      title: job.title,
      status: job.status,
      deliveryRequired: job.deliveryRequired === true,
      deliveryStatus: job.deliveryStatus || null,
      timelineKind: publicTimelineKindForJob(job),
      priority: job.priority,
      orderDate: job.orderDate,
      startDate: job.startDate,
      inProgressAt,
      dueDate: job.dueDate,
      completionDate: job.completionDate,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      customer: job.customer
        ? { name: job.customer.name, company: job.customer.company }
        : null
    };

    res.status(200).json({
      success: true,
      data: {
        job: safeJob,
        organization: {
          name: organization.name || tenant?.name || '',
          logoUrl: organization.logoUrl || getTenantLogoUrl(tenant),
          primaryColor: organization.primaryColor || tenant?.metadata?.primaryColor || '#166534'
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Branding for public slug tracking page (no login). No PII when tracking is disabled.
 * GET /api/public/track/:tenantSlug/branding
 */
exports.getPublicTrackBranding = async (req, res, next) => {
  try {
    const { tenantSlug } = req.params;
    if (!tenantSlug) {
      return res.status(404).json({ success: false, message: 'Not found.' });
    }

    const tenant = await Tenant.findOne({
      where: { slug: tenantSlug },
      attributes: ['id', 'name', 'metadata']
    });

    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Not found.' });
    }

    const flags = await Setting.findOne({ where: { tenantId: tenant.id, key: 'job-invoice' } });
    const trackingSettings = { ...JOB_INVOICE_TRACK_DEFAULTS, ...(flags?.value || {}) };
    if (trackingSettings.customerJobTrackingEnabled !== true) {
      return res.status(200).json({
        success: true,
        data: { trackingEnabled: false }
      });
    }

    const organizationRow = await Setting.findOne({ where: { tenantId: tenant.id, key: 'organization' } });
    const organization = buildOrganizationPublicPayload(organizationRow?.value, tenant);

    res.status(200).json({
      success: true,
      data: {
        trackingEnabled: true,
        organization
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Public lookup page submit (no login).
 * POST /api/public/track/:tenantSlug/lookup
 * Body: { trackingId, phone }
 */
exports.lookupPublicTracking = async (req, res, next) => {
  try {
    const { tenantSlug } = req.params;
    const trackingId = typeof req.body?.trackingId === 'string' ? req.body.trackingId.trim() : '';
    const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';

    if (!tenantSlug || !trackingId || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Missing details',
        hint: 'Enter your ID and phone.'
      });
    }

    const tenant = await Tenant.findOne({
      where: { slug: tenantSlug },
      attributes: ['id', 'name', 'slug', 'businessType', 'metadata']
    });

    if (!tenant) {
      return res.status(404).json(lookupNoMatchResponse());
    }

    const flags = await Setting.findOne({ where: { tenantId: tenant.id, key: 'job-invoice' } });
    const trackingSettings = { ...JOB_INVOICE_TRACK_DEFAULTS, ...(flags?.value || {}) };
    if (trackingSettings.customerJobTrackingEnabled !== true) {
      return res.status(404).json({
        success: false,
        message: 'Tracking unavailable',
        hint: 'Contact the business.'
      });
    }

    const phoneCandidates = normalizeLookupPhone(phone);
    if (!phoneCandidates || phoneCandidates.length === 0) {
      return res.status(404).json(lookupPhoneInvalidResponse());
    }

    const organizationRow = await Setting.findOne({ where: { tenantId: tenant.id, key: 'organization' } });
    const organization = buildOrganizationPublicPayload(organizationRow?.value, tenant);
    const effectiveBusinessType = resolveBusinessType(tenant.businessType);

    if (effectiveBusinessType === 'studio') {
      const job = await Job.findOne({
        where: {
          tenantId: tenant.id,
          jobNumber: trackingId
        },
        include: [{
          model: Customer,
          as: 'customer',
          attributes: ['name', 'company', 'phone'],
          where: {
            [Op.or]: [
              { phone: { [Op.in]: phoneCandidates } },
              { phone: { [Op.in]: phoneCandidates.map((value) => value.replace(/^\+/, '')) } }
            ]
          }
        }]
      });

      if (!job) {
        return res.status(404).json(lookupNoMatchResponse());
      }

      const lookupLatestInProgress = await JobStatusHistory.findOne({
        where: {
          jobId: job.id,
          tenantId: tenant.id,
          status: 'in_progress'
        },
        order: [['createdAt', 'DESC']],
        attributes: ['createdAt']
      });

      return res.status(200).json({
        success: true,
        data: {
          organization,
          tracking: {
            kind: 'job',
            timelineKind: publicTimelineKindForJob(job),
            idLabel: 'Job ID',
            idValue: job.jobNumber,
            status: job.status,
            deliveryRequired: job.deliveryRequired === true,
            deliveryStatus: job.deliveryStatus || null,
            orderStatus: null,
            titleOrSummary: job.title || 'Job',
            orderDate: job.orderDate || null,
            startDate: job.startDate || null,
            inProgressAt: lookupLatestInProgress?.createdAt || null,
            dueDate: job.dueDate || null,
            completionDate: job.completionDate || null,
            createdAt: job.createdAt || null,
            updatedAt: job.updatedAt || null
          },
          customer: buildSafeCustomer(job.customer)
        }
      });
    }

    const sale = await Sale.findOne({
      where: {
        tenantId: tenant.id,
        saleNumber: trackingId
      },
      include: [{
        model: Customer,
        as: 'customer',
        attributes: ['name', 'company', 'phone'],
        where: {
          [Op.or]: [
            { phone: { [Op.in]: phoneCandidates } },
            { phone: { [Op.in]: phoneCandidates.map((value) => value.replace(/^\+/, '')) } }
          ]
        }
      }],
      order: [['createdAt', 'DESC']]
    });

    if (!sale) {
      return res.status(404).json(lookupNoMatchResponse());
    }

    const summary = sale.notes || `Order total: ${sale.total || '0.00'}`;

    return res.status(200).json({
      success: true,
      data: {
        organization,
        tracking: {
          kind: 'order',
          timelineKind: publicTimelineKindForSale(tenant, sale),
          idLabel: 'Order ID',
          idValue: sale.saleNumber,
          status: sale.orderStatus || sale.status,
          deliveryStatus: sale.deliveryStatus || null,
          orderStatus: sale.orderStatus || null,
          titleOrSummary: summary,
          orderDate: sale.createdAt || null,
          startDate: null,
          dueDate: null,
          completionDate: sale.status === 'completed' ? sale.updatedAt : null,
          createdAt: sale.createdAt || null,
          updatedAt: sale.updatedAt || null
        },
        customer: buildSafeCustomer(sale.customer)
      }
    });
  } catch (error) {
    next(error);
  }
};
