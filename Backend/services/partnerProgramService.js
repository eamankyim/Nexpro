const crypto = require('crypto');
const { Op } = require('sequelize');
const {
  PartnerProgramSettings,
  PartnerProgramService,
  PartnershipApplication,
  Partnership,
  Marketer,
  Tenant,
  Product,
  PricingTemplate,
  OnlineServiceListing,
} = require('../models');

const money = (value) => Number((Number.parseFloat(value || 0) || 0).toFixed(2));

const slugify = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || `partner-${Date.now().toString(36)}`;

const generateReferralCode = () => {
  const raw = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `SP-${raw}`;
};

const countActivePartnerships = async (tenantId, transaction) =>
  Partnership.count({
    where: { tenantId, status: 'active' },
    transaction,
  });

/**
 * Get or create partner program settings for a tenant.
 */
const getOrCreateSettings = async (tenantId, tenantName = 'Business') => {
  let settings = await PartnerProgramSettings.findOne({ where: { tenantId } });
  if (settings) return settings;

  const baseSlug = slugify(tenantName);
  let slug = baseSlug;
  let attempt = 0;
  while (await PartnerProgramSettings.findOne({ where: { slug } })) {
    attempt += 1;
    slug = `${baseSlug}-${attempt}`.slice(0, 80);
  }

  settings = await PartnerProgramSettings.create({
    tenantId,
    enabled: false,
    listed: false,
    slug,
    displayName: tenantName || 'Business',
    firstClientRatePercent: 10,
    returningClientRatePercent: 5,
    attributionMonths: 12,
    maxMarketers: 10,
  });
  return settings;
};

const settingsInclude = [
  {
    model: PartnerProgramService,
    as: 'services',
    where: { isActive: true },
    required: false,
    include: [
      { model: Product, as: 'product', attributes: ['id', 'name'] },
      { model: PricingTemplate, as: 'pricingTemplate', attributes: ['id', 'name'] },
      { model: OnlineServiceListing, as: 'onlineServiceListing', attributes: ['id', 'title', 'slug'] },
    ],
  },
];

const toPublicListing = async (settings, activeCount) => {
  const slotsLeft = Math.max(0, Number(settings.maxMarketers || 0) - Number(activeCount || 0));
  const first = money(settings.firstClientRatePercent);
  const returning = money(settings.returningClientRatePercent);
  const serviceRates = (settings.services || [])
    .map((s) => money(s.firstClientRatePercent ?? first))
    .filter((n) => Number.isFinite(n));
  const commissionFrom = serviceRates.length ? Math.min(...serviceRates, first) : first;

  return {
    id: settings.id,
    tenantId: settings.tenantId,
    slug: settings.slug,
    name: settings.displayName,
    category: settings.category || 'Services',
    location: settings.location || 'Ghana',
    pitch: settings.pitch || '',
    description: settings.pitch || '',
    logoUrl: settings.logoUrl || null,
    imageUrl: settings.logoUrl || null,
    commissionFrom,
    firstClientRatePercent: first,
    returningClientRatePercent: returning,
    attributionMonths: settings.attributionMonths,
    maxMarketers: settings.maxMarketers,
    activePartners: activeCount,
    slotsLeft,
    applicationsOpen: slotsLeft > 0,
    payoutNotes: settings.payoutNotes || null,
    services: (settings.services || []).map((s) => ({
      id: s.id,
      label: s.label,
      firstClientRatePercent: s.firstClientRatePercent != null ? money(s.firstClientRatePercent) : first,
      returningClientRatePercent:
        s.returningClientRatePercent != null ? money(s.returningClientRatePercent) : returning,
    })),
  };
};

const listPublicPartners = async ({ category, search, limit = 50 } = {}) => {
  const where = { enabled: true, listed: true };
  if (category && category !== 'All categories') {
    where.category = category;
  }
  if (search) {
    where[Op.or] = [
      { displayName: { [Op.iLike]: `%${search}%` } },
      { pitch: { [Op.iLike]: `%${search}%` } },
      { location: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const rows = await PartnerProgramSettings.findAll({
    where,
    include: settingsInclude,
    order: [['displayName', 'ASC']],
    limit: Math.min(Number(limit) || 50, 100),
  });

  const results = [];
  for (const settings of rows) {
    const activeCount = await countActivePartnerships(settings.tenantId);
    results.push(await toPublicListing(settings, activeCount));
  }
  return results;
};

const getPublicPartnerBySlug = async (slug) => {
  const settings = await PartnerProgramSettings.findOne({
    where: { slug: String(slug || '').toLowerCase(), enabled: true, listed: true },
    include: settingsInclude,
  });
  if (!settings) return null;
  const activeCount = await countActivePartnerships(settings.tenantId);
  return toPublicListing(settings, activeCount);
};

const updateSettings = async (tenantId, payload = {}) => {
  const tenant = await Tenant.findByPk(tenantId);
  const settings = await getOrCreateSettings(tenantId, tenant?.name || tenant?.companyName || 'Business');

  const updates = {};
  if (payload.enabled !== undefined) updates.enabled = Boolean(payload.enabled);
  if (payload.listed !== undefined) updates.listed = Boolean(payload.listed);
  if (payload.displayName != null) updates.displayName = String(payload.displayName).trim().slice(0, 160);
  if (payload.pitch !== undefined) updates.pitch = payload.pitch ? String(payload.pitch).trim() : null;
  if (payload.logoUrl !== undefined) updates.logoUrl = payload.logoUrl || null;
  if (payload.category !== undefined) updates.category = payload.category ? String(payload.category).trim().slice(0, 80) : null;
  if (payload.location !== undefined) updates.location = payload.location ? String(payload.location).trim().slice(0, 160) : null;
  if (payload.firstClientRatePercent !== undefined) {
    updates.firstClientRatePercent = money(payload.firstClientRatePercent);
  }
  if (payload.returningClientRatePercent !== undefined) {
    updates.returningClientRatePercent = money(payload.returningClientRatePercent);
  }
  if (payload.attributionMonths !== undefined) {
    updates.attributionMonths = Math.max(1, Math.min(60, parseInt(payload.attributionMonths, 10) || 12));
  }
  if (payload.maxMarketers !== undefined) {
    updates.maxMarketers = Math.max(1, Math.min(500, parseInt(payload.maxMarketers, 10) || 10));
  }
  if (payload.payoutNotes !== undefined) {
    updates.payoutNotes = payload.payoutNotes ? String(payload.payoutNotes).trim() : null;
  }
  if (payload.slug) {
    const nextSlug = slugify(payload.slug);
    const clash = await PartnerProgramSettings.findOne({
      where: { slug: nextSlug, tenantId: { [Op.ne]: tenantId } },
    });
    if (!clash) updates.slug = nextSlug;
  }

  const willList = updates.listed !== undefined ? updates.listed : settings.listed;
  const willEnable = updates.enabled !== undefined ? updates.enabled : settings.enabled;
  if (willEnable && willList && !settings.setupCompletedAt) {
    updates.setupCompletedAt = new Date();
  }

  await settings.update(updates);
  return PartnerProgramSettings.findByPk(settings.id, { include: settingsInclude });
};

const replaceServices = async (tenantId, services = []) => {
  const settings = await getOrCreateSettings(tenantId);
  await PartnerProgramService.destroy({ where: { partnerProgramSettingsId: settings.id } });

  const created = [];
  for (const item of services) {
    if (!item?.label) continue;
    created.push(
      await PartnerProgramService.create({
        tenantId,
        partnerProgramSettingsId: settings.id,
        productId: item.productId || null,
        pricingTemplateId: item.pricingTemplateId || null,
        onlineServiceListingId: item.onlineServiceListingId || null,
        label: String(item.label).trim().slice(0, 160),
        firstClientRatePercent:
          item.firstClientRatePercent != null ? money(item.firstClientRatePercent) : null,
        returningClientRatePercent:
          item.returningClientRatePercent != null ? money(item.returningClientRatePercent) : null,
        isActive: item.isActive !== false,
      })
    );
  }
  return created;
};

const applyToPartner = async ({ marketerId, tenantId, pitch }) => {
  const settings = await PartnerProgramSettings.findOne({
    where: { tenantId, enabled: true, listed: true },
  });
  if (!settings) {
    const err = new Error('This business is not accepting partner applications.');
    err.statusCode = 404;
    throw err;
  }

  const activeCount = await countActivePartnerships(tenantId);
  if (activeCount >= settings.maxMarketers) {
    const err = new Error('Applications are full for this business.');
    err.statusCode = 409;
    err.errorCode = 'PARTNER_SLOTS_FULL';
    throw err;
  }

  const existingPartnership = await Partnership.findOne({
    where: { tenantId, marketerId, status: 'active' },
  });
  if (existingPartnership) {
    const err = new Error('You are already an active partner with this business.');
    err.statusCode = 409;
    throw err;
  }

  const existingApp = await PartnershipApplication.findOne({ where: { tenantId, marketerId } });
  if (existingApp) {
    if (existingApp.status === 'pending') {
      return existingApp;
    }
    if (existingApp.status === 'declined') {
      await existingApp.update({
        status: 'pending',
        pitch: pitch ? String(pitch).trim() : existingApp.pitch,
        decisionNote: null,
        reviewedAt: null,
        reviewedBy: null,
      });
      return existingApp;
    }
  }

  return PartnershipApplication.create({
    tenantId,
    marketerId,
    status: 'pending',
    pitch: pitch ? String(pitch).trim() : null,
  });
};

const approveApplication = async ({ tenantId, applicationId, reviewedBy }) => {
  const application = await PartnershipApplication.findOne({
    where: { id: applicationId, tenantId },
    include: [{ model: Marketer, as: 'marketer' }],
  });
  if (!application) {
    const err = new Error('Application not found');
    err.statusCode = 404;
    throw err;
  }
  if (application.status === 'approved') {
    const existing = await Partnership.findOne({
      where: { tenantId, marketerId: application.marketerId },
    });
    return { application, partnership: existing };
  }

  const settings = await getOrCreateSettings(tenantId);
  const activeCount = await countActivePartnerships(tenantId);
  if (activeCount >= settings.maxMarketers) {
    const err = new Error('Marketer slots are full. Raise max marketers or revoke a partner first.');
    err.statusCode = 409;
    err.errorCode = 'PARTNER_SLOTS_FULL';
    throw err;
  }

  let referralCode = generateReferralCode();
  while (await Partnership.findOne({ where: { referralCode } })) {
    referralCode = generateReferralCode();
  }

  const partnership = await Partnership.create({
    tenantId,
    marketerId: application.marketerId,
    applicationId: application.id,
    referralCode,
    status: 'active',
    firstClientRatePercent: money(settings.firstClientRatePercent),
    returningClientRatePercent: money(settings.returningClientRatePercent),
    attributionMonths: settings.attributionMonths,
    activatedAt: new Date(),
  });

  await application.update({
    status: 'approved',
    reviewedAt: new Date(),
    reviewedBy: reviewedBy || null,
  });

  return { application, partnership };
};

const declineApplication = async ({ tenantId, applicationId, reviewedBy, decisionNote }) => {
  const application = await PartnershipApplication.findOne({
    where: { id: applicationId, tenantId },
  });
  if (!application) {
    const err = new Error('Application not found');
    err.statusCode = 404;
    throw err;
  }
  await application.update({
    status: 'declined',
    decisionNote: decisionNote ? String(decisionNote).trim() : null,
    reviewedAt: new Date(),
    reviewedBy: reviewedBy || null,
  });
  return application;
};

const findPartnershipByReferralCode = async (code, tenantId = null) => {
  const where = {
    referralCode: String(code || '').trim().toUpperCase(),
    status: 'active',
  };
  if (tenantId) where.tenantId = tenantId;
  return Partnership.findOne({ where });
};

module.exports = {
  money,
  getOrCreateSettings,
  listPublicPartners,
  getPublicPartnerBySlug,
  updateSettings,
  replaceServices,
  applyToPartner,
  approveApplication,
  declineApplication,
  countActivePartnerships,
  findPartnershipByReferralCode,
  settingsInclude,
  toPublicListing,
};
