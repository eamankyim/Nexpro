const jwt = require('jsonwebtoken');
const dayjs = require('dayjs');
const { sequelize } = require('../config/database');
const config = require('../config/config');
const { Tenant, User, UserTenant, Setting } = require('../models');

const generateToken = (userId) =>
  jwt.sign({ id: userId }, config.jwt.secret, {
    expiresIn: config.jwt.expire,
  });

const slugify = (value = '') => {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .substring(0, 150) || `tenant-${Date.now()}`;
};

const generateUniqueSlug = async (name, transaction) => {
  const base = slugify(name);
  let candidate = base;
  let counter = 1;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await Tenant.findOne({
      where: { slug: candidate },
      transaction,
      attributes: ['id'],
    });

    if (!existing) {
      return candidate;
    }

    candidate = `${base}-${counter++}`;
  }
};

exports.signupTenant = async (req, res, next) => {
  const {
    companyName,
    companyEmail,
    companyPhone,
    companyWebsite,
    adminName,
    adminEmail,
    password,
    plan = 'trial',
  } = req.body || {};

  try {
    if (!adminName || !adminEmail || !password) {
      return res.status(400).json({
        success: false,
        message:
          'Account owner name, email, and password are required to create a workspace.',
      });
    }

    const normalizedEmail = adminEmail.trim().toLowerCase();
    // Company name is optional - default to a placeholder if not provided
    const trimmedCompanyName = (companyName?.trim() || 'My Workspace');
    const trimmedAdminName = adminName.trim();

    const existingUser = await User.findOne({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message:
          'An account with this email already exists. Please sign in instead.',
      });
    }

    const transaction = await sequelize.transaction();

    try {
      const slug = await generateUniqueSlug(trimmedCompanyName, transaction);

      const trialEndDate =
        plan === 'trial' ? dayjs().add(1, 'month').toDate() : null;

      const tenant = await Tenant.create(
        {
          name: trimmedCompanyName,
          slug,
          plan,
          status: 'active',
          metadata: {
            website: companyWebsite || null,
            email: companyEmail || null,
            phone: companyPhone || null,
            signupSource: 'self_service',
          },
          trialEndsAt: trialEndDate,
        },
        { transaction }
      );

      const user = await User.create(
        {
          name: trimmedAdminName,
          email: normalizedEmail,
          password,
          role: 'admin',
        },
        { transaction }
      );

      await UserTenant.create(
        {
          tenantId: tenant.id,
          userId: user.id,
          role: 'owner',
          status: 'active',
          isDefault: true,
          invitedBy: null,
          invitedAt: new Date(),
          joinedAt: new Date(),
        },
        { transaction }
      );

      await Setting.bulkCreate(
        [
          {
            tenantId: tenant.id,
            key: 'organization',
            value: {
              name: trimmedCompanyName,
              legalName: trimmedCompanyName,
              email: companyEmail || normalizedEmail,
              phone: companyPhone || '',
              website: companyWebsite || '',
              logoUrl: '',
              address: {
                line1: '',
                city: '',
                state: '',
                country: '',
                postalCode: '',
              },
              tax: {
                vatNumber: '',
                tin: '',
              },
              invoiceFooter: 'Thank you for doing business with us.',
            },
            description: 'Organization profile',
          },
          {
            tenantId: tenant.id,
            key: 'subscription',
            value: {
              plan,
              status: plan === 'trial' ? 'trialing' : 'active',
              trialEndsAt: trialEndDate,
              paymentMethod: null,
              seats: 1,
            },
            description: 'Subscription and billing information',
          },
          {
            tenantId: tenant.id,
            key: 'payroll',
            value: {
              payeRate: 0.1,
              ssnitRate: 0.135,
              currency: 'GHS',
              payCycle: 'monthly',
            },
            description: 'Default payroll configuration',
          },
        ],
        { transaction }
      );

      await transaction.commit();

      const token = generateToken(user.id);

      const memberships = await UserTenant.findAll({
        where: { userId: user.id },
        include: [{ model: Tenant, as: 'tenant' }],
        order: [
          ['isDefault', 'DESC'],
          ['createdAt', 'ASC'],
        ],
      });

      const safeUser = user.toJSON();
      const safeMemberships = memberships.map((membership) =>
        membership.toJSON()
      );

      return res.status(201).json({
        success: true,
        data: {
          user: safeUser,
          token,
          memberships: safeMemberships,
          defaultTenantId: tenant.id,
        },
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

