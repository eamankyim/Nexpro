const jwt = require('jsonwebtoken');
const {
  Marketer,
  PartnershipApplication,
  Partnership,
  PartnerProgramSettings,
  Tenant,
  Product,
  PricingTemplate,
} = require('../models');
const config = require('../config/config');
const partnerProgramService = require('../services/partnerProgramService');
const partnerCommissionService = require('../services/partnerCommissionService');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const signMarketerToken = (marketer) =>
  jwt.sign({ id: marketer.id, type: 'sabito_marketer' }, config.jwt.secret, {
    expiresIn: config.jwt.expire,
  });

const toSafeMarketer = (marketer) => ({
  id: marketer.id,
  name: marketer.name,
  email: marketer.email,
  phone: marketer.phone || null,
  momoNumber: marketer.momoNumber || null,
  bankDetails: marketer.bankDetails || null,
});

const authResponse = (marketer) => ({
  token: signMarketerToken(marketer),
  marketer: toSafeMarketer(marketer),
});

// ——— Public marketplace ———

exports.listPublicSabitoPartners = async (req, res, next) => {
  try {
    const data = await partnerProgramService.listPublicPartners({
      category: req.query.category,
      search: req.query.search,
      limit: req.query.limit,
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.getPublicSabitoPartner = async (req, res, next) => {
  try {
    const data = await partnerProgramService.getPublicPartnerBySlug(req.params.slug);
    if (!data) {
      return res.status(404).json({ success: false, message: 'Business not found' });
    }
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// ——— Marketer auth ———

exports.registerMarketer = async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const phone = String(req.body?.phone || '').trim() || null;
    const password = String(req.body?.password || '');

    if (!name || name.length < 2) {
      return res.status(400).json({ success: false, message: 'Name must be at least 2 characters.' });
    }
    if (!email || !EMAIL_REGEX.test(email)) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }

    const existing = await Marketer.findOne({ where: { email } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const marketer = await Marketer.create({
      name,
      email,
      phone,
      password,
      isActive: true,
      metadata: { source: 'sabito_app_signup' },
    });

    res.status(201).json({ success: true, data: authResponse(marketer) });
  } catch (error) {
    next(error);
  }
};

exports.loginMarketer = async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const marketer = await Marketer.findOne({ where: { email } });
    if (!marketer || !(await marketer.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }
    if (marketer.isActive !== true) {
      return res.status(401).json({ success: false, message: 'Account is inactive.' });
    }

    await marketer.update({ lastLoginAt: new Date() });
    res.status(200).json({ success: true, data: authResponse(marketer) });
  } catch (error) {
    next(error);
  }
};

exports.getMarketerSession = async (req, res, next) => {
  try {
    res.status(200).json({ success: true, data: { marketer: toSafeMarketer(req.marketer) } });
  } catch (error) {
    next(error);
  }
};

exports.updateMarketerProfile = async (req, res, next) => {
  try {
    const updates = {};
    if (req.body?.name != null) updates.name = String(req.body.name).trim().slice(0, 160);
    if (req.body?.phone !== undefined) updates.phone = req.body.phone ? String(req.body.phone).trim() : null;
    if (req.body?.momoNumber !== undefined) {
      updates.momoNumber = req.body.momoNumber ? String(req.body.momoNumber).trim() : null;
    }
    if (req.body?.bankDetails !== undefined) {
      updates.bankDetails = req.body.bankDetails ? String(req.body.bankDetails).trim() : null;
    }
    await req.marketer.update(updates);
    res.status(200).json({ success: true, data: { marketer: toSafeMarketer(req.marketer) } });
  } catch (error) {
    next(error);
  }
};

exports.applyToPartner = async (req, res, next) => {
  try {
    const tenantId = req.body?.tenantId || req.params.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'tenantId is required.' });
    }
    const application = await partnerProgramService.applyToPartner({
      marketerId: req.marketer.id,
      tenantId,
      pitch: req.body?.pitch,
    });
    res.status(201).json({ success: true, data: application });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        errorCode: error.errorCode,
      });
    }
    next(error);
  }
};

exports.listMyApplications = async (req, res, next) => {
  try {
    const apps = await PartnershipApplication.findAll({
      where: { marketerId: req.marketer.id },
      include: [
        {
          model: Tenant,
          as: 'tenant',
          attributes: ['id', 'name'],
          include: [
            {
              model: PartnerProgramSettings,
              as: 'partnerProgramSettings',
              attributes: ['slug', 'displayName', 'logoUrl'],
            },
          ],
        },
      ],
      order: [['createdAt', 'DESC']],
    });
    res.status(200).json({ success: true, data: apps });
  } catch (error) {
    next(error);
  }
};

exports.listMyPartnerships = async (req, res, next) => {
  try {
    const rows = await Partnership.findAll({
      where: { marketerId: req.marketer.id, status: 'active' },
      include: [
        {
          model: Tenant,
          as: 'tenant',
          attributes: ['id', 'name'],
          include: [
            {
              model: PartnerProgramSettings,
              as: 'partnerProgramSettings',
              attributes: ['slug', 'displayName', 'logoUrl', 'payoutNotes'],
            },
          ],
        },
      ],
      order: [['activatedAt', 'DESC']],
    });
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

exports.listMyEarnings = async (req, res, next) => {
  try {
    const data = await partnerCommissionService.listCommissionsForMarketer(req.marketer.id, {
      status: req.query.status,
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// ——— Tenant (ABS) admin ———

exports.getPartnerProgramSettings = async (req, res, next) => {
  try {
    const tenant = await Tenant.findByPk(req.tenantId);
    const settings = await partnerProgramService.getOrCreateSettings(
      req.tenantId,
      tenant?.name || 'Business'
    );
    const full = await PartnerProgramSettings.findByPk(settings.id, {
      include: partnerProgramService.settingsInclude,
    });
    const activePartners = await partnerProgramService.countActivePartnerships(req.tenantId);
    res.status(200).json({
      success: true,
      data: {
        ...full.toJSON(),
        activePartners,
        slotsLeft: Math.max(0, full.maxMarketers - activePartners),
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.updatePartnerProgramSettings = async (req, res, next) => {
  try {
    const settings = await partnerProgramService.updateSettings(req.tenantId, req.body || {});
    if (Array.isArray(req.body?.services)) {
      await partnerProgramService.replaceServices(req.tenantId, req.body.services);
    }
    const full = await PartnerProgramSettings.findByPk(settings.id, {
      include: partnerProgramService.settingsInclude,
    });
    res.status(200).json({ success: true, data: full });
  } catch (error) {
    next(error);
  }
};

exports.listCatalogForPartnerProgram = async (req, res, next) => {
  try {
    const [products, templates] = await Promise.all([
      Product.findAll({
        where: { tenantId: req.tenantId, isActive: true },
        attributes: ['id', 'name'],
        order: [['name', 'ASC']],
        limit: 500,
      }),
      PricingTemplate.findAll({
        where: { tenantId: req.tenantId },
        attributes: ['id', 'name', 'category', 'jobType'],
        order: [['name', 'ASC']],
        limit: 500,
      }),
    ]);
    res.status(200).json({
      success: true,
      data: {
        products: products.map((p) => ({ id: p.id, label: p.name, type: 'product' })),
        pricingTemplates: templates.map((t) => ({
          id: t.id,
          label: t.name,
          type: 'pricingTemplate',
          category: t.category,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.listPartnershipApplications = async (req, res, next) => {
  try {
    const where = { tenantId: req.tenantId };
    if (req.query.status) where.status = req.query.status;
    const apps = await PartnershipApplication.findAll({
      where,
      include: [{ model: Marketer, as: 'marketer', attributes: ['id', 'name', 'email', 'phone', 'momoNumber'] }],
      order: [['createdAt', 'DESC']],
    });
    res.status(200).json({ success: true, data: apps });
  } catch (error) {
    next(error);
  }
};

exports.approvePartnershipApplication = async (req, res, next) => {
  try {
    const result = await partnerProgramService.approveApplication({
      tenantId: req.tenantId,
      applicationId: req.params.id,
      reviewedBy: req.user?.id,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        errorCode: error.errorCode,
      });
    }
    next(error);
  }
};

exports.declinePartnershipApplication = async (req, res, next) => {
  try {
    const application = await partnerProgramService.declineApplication({
      tenantId: req.tenantId,
      applicationId: req.params.id,
      reviewedBy: req.user?.id,
      decisionNote: req.body?.decisionNote,
    });
    res.status(200).json({ success: true, data: application });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

exports.listPartnerships = async (req, res, next) => {
  try {
    const where = { tenantId: req.tenantId };
    if (req.query.status) where.status = req.query.status;
    const rows = await Partnership.findAll({
      where,
      include: [{ model: Marketer, as: 'marketer', attributes: ['id', 'name', 'email', 'phone', 'momoNumber', 'bankDetails'] }],
      order: [['activatedAt', 'DESC']],
    });
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

exports.revokePartnership = async (req, res, next) => {
  try {
    const partnership = await Partnership.findOne({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!partnership) {
      return res.status(404).json({ success: false, message: 'Partnership not found' });
    }
    await partnership.update({ status: 'revoked', revokedAt: new Date() });
    res.status(200).json({ success: true, data: partnership });
  } catch (error) {
    next(error);
  }
};

exports.listPartnerCommissions = async (req, res, next) => {
  try {
    const data = await partnerCommissionService.listCommissionsForTenant(req.tenantId, {
      status: req.query.status,
      marketerId: req.query.marketerId,
      month: req.query.month,
      year: req.query.year,
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.markPartnerCommissionsPaid = async (req, res, next) => {
  try {
    const result = await partnerCommissionService.markCommissionsPaid({
      tenantId: req.tenantId,
      commissionIds: req.body?.commissionIds || req.body?.ids || [],
      paidBy: req.user?.id,
      paidNote: req.body?.paidNote,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};
