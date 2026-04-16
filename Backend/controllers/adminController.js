const crypto = require('crypto');
const dayjs = require('dayjs');
const jwt = require('jsonwebtoken');
const { Op, QueryTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const config = require('../config/config');
const { getPagination } = require('../utils/paginationUtils');
const {
  Tenant,
  User,
  UserTenant,
  Notification,
  Vendor,
  Job,
  InviteToken,
  SubscriptionPlan,
  TenantAccessAudit,
  Setting
} = require('../models');
const emailService = require('../services/emailService');
const { inviteTenantEmail } = require('../services/emailTemplates');
const { getFrontendBaseUrl } = require('../utils/frontendUrl');
const {
  ACCESS_STATES,
  normalizeFeatureOverrides,
  getTenantEffectiveEntitlements
} = require('../utils/tenantEntitlements');

const PLAN_PRICING = {
  trial: 0,
  starter: 129,
  professional: 250,
  enterprise: 0, // contact sales
};

const PLAN_ALIASES = {
  free: 'trial',
  standard: 'starter',
  pro: 'professional',
  launch: 'starter',
  scale: 'professional',
};

const normalizePlanId = (plan = '') => PLAN_ALIASES[String(plan).trim().toLowerCase()] || String(plan).trim().toLowerCase();

const generateToken = (id) =>
  jwt.sign({ id }, config.jwt.secret, {
    expiresIn: config.jwt.expire,
  });

const serverStartedAt = new Date();

const formatDuration = (totalSeconds) => {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;

  const parts = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  parts.push(`${remaining}s`);
  return parts.join(' ');
};

exports.getPlatformSummary = async (req, res, next) => {
  try {
    const sevenDaysAgo = dayjs().subtract(7, 'day').toDate();

    const [
      totalTenants,
      activeTenants,
      trialTenants,
      totalUsers,
      newTenantsLast7Days,
      totalMemberships
    ] = await Promise.all([
      Tenant.count(),
      Tenant.count({ where: { status: 'active' } }),
      Tenant.count({ where: { plan: 'trial' } }),
      User.count(),
      Tenant.count({ where: { createdAt: { [Op.gte]: sevenDaysAgo } } }),
      UserTenant.count()
    ]);

    const avgUsersPerTenant =
      totalTenants > 0 ? Number((totalMemberships / totalTenants).toFixed(1)) : 0;

    res.status(200).json({
      success: true,
      data: {
        totalTenants,
        activeTenants,
        trialTenants,
        totalUsers,
        newTenantsLast7Days,
        avgUsersPerTenant
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getTenants = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req, { defaultPageSize: 20 });
    const { plan, status, search } = req.query;

    const where = {};
    if (plan) {
      const normalizedPlan = normalizePlanId(plan);
      const aliasKeysForPlan = Object.entries(PLAN_ALIASES)
        .filter(([, canonical]) => canonical === normalizedPlan)
        .map(([alias]) => alias);
      const matchedPlans = Array.from(new Set([normalizedPlan, ...aliasKeysForPlan]));
      where.plan = matchedPlans.length > 1 ? { [Op.in]: matchedPlans } : normalizedPlan;
    }
    if (status) {
      where.status = status;
    }
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { slug: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const [tenants, total] = await Promise.all([
      Tenant.findAll({
        where,
        attributes: [
          'id',
          'name',
          'slug',
          'plan',
          'status',
          'createdAt',
          'trialEndsAt',
          'metadata',
          [sequelize.fn('COUNT', sequelize.col('memberships.id')), 'userCount']
        ],
        include: [
          {
            model: UserTenant,
            as: 'memberships',
            attributes: []
          }
        ],
        group: ['Tenant.id'],
        order: [['createdAt', 'DESC']],
        limit,
        offset,
        subQuery: false
      }),
      Tenant.count({ where })
    ]);

    const tenantIds = tenants.map((t) => t.id);
    const primaryEmailsByTenant = {};
    if (tenantIds.length > 0) {
      const firstMemberships = await UserTenant.findAll({
        where: { tenantId: tenantIds },
        attributes: ['tenantId', 'userId'],
        include: [{ model: User, as: 'user', attributes: ['email'], required: true }],
        order: [['createdAt', 'ASC']]
      });
      firstMemberships.forEach((ut) => {
        if (primaryEmailsByTenant[ut.tenantId] == null && ut.user?.email) {
          primaryEmailsByTenant[ut.tenantId] = ut.user.email;
        }
      });
    }

    const serialized = tenants.map((tenant) => {
      const item = tenant.toJSON();
      item.userCount = Number(item.userCount) || 0;
      item.primaryUserEmail = primaryEmailsByTenant[tenant.id] || null;
      return item;
    });

    res.status(200).json({
      success: true,
      data: serialized,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Invite a new tenant (platform admin only). Creates an invite token and sends email with signup link.
 * Invitee opens /signup?token=... and completes signup; backend then creates tenant + user as owner.
 * @route   POST /api/admin/tenants/invite
 */
exports.inviteTenant = async (req, res, next) => {
  try {
    const { email, name } = req.body || {};
    const inviteRequestId = `adm_inv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    if (!email || !String(email).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const existingUser = await User.findOne({ where: { email: normalizedEmail } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email already exists.',
      });
    }

    const existingInvite = await InviteToken.findOne({
      where: {
        email: normalizedEmail,
        inviteType: 'new_tenant',
        used: false,
        tenantId: null,
        expiresAt: { [Op.gt]: new Date() },
      },
    });
    if (existingInvite) {
      const frontendUrl = getFrontendBaseUrl(req);
      const inviteUrl = `${frontendUrl}/signup?token=${existingInvite.token}`;
      return res.status(400).json({
        success: false,
        message: 'An active invite already exists for this email. Revoke it or use the existing link.',
        data: { inviteUrl, invite: existingInvite },
      });
    }

    const token = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invite = await InviteToken.create({
      token,
      email: normalizedEmail,
      name: name ? String(name).trim() || null : null,
      role: 'admin',
      inviteType: 'new_tenant',
      tenantId: null,
      createdBy: req.user.id,
      expiresAt,
      used: false,
    });
    console.log('[Admin Invite] Invite created', {
      inviteRequestId,
      inviteId: invite.id,
      inviteType: 'new_tenant',
      email: normalizedEmail,
      createdBy: req.user?.id,
      expiresAt: invite.expiresAt,
    });

    const frontendUrl = getFrontendBaseUrl(req);
    const inviteUrl = `${frontendUrl}/signup?token=${token}`;
    const inviterName = req.user?.name || req.user?.email || 'African Business Suite';

    setImmediate(async () => {
      try {
        const platformConfig = emailService.getPlatformConfig?.();
        console.log('[Admin Invite Email] Dispatch started', {
          inviteRequestId,
          inviteId: invite.id,
          to: normalizedEmail,
          inviterUserId: req.user?.id,
          provider: platformConfig?.provider || 'unknown',
          fromEmail: platformConfig?.fromEmail || null,
          frontendUrl,
        });
        const { subject, html, text } = inviteTenantEmail(normalizedEmail, inviteUrl, inviterName);
        const result = await emailService.sendPlatformMessage(
          normalizedEmail,
          subject,
          html,
          text,
          [],
          { categories: ['transactional', 'signup'] }
        );
        if (!result?.success) {
          throw new Error(result?.error || 'Invite email send failed');
        }
        console.log('[Admin Invite Email] Dispatch success', {
          inviteRequestId,
          inviteId: invite.id,
          to: normalizedEmail,
          messageId: result?.messageId || null,
          provider: platformConfig?.provider || 'unknown',
        });
      } catch (err) {
        console.error('[Admin Invite Email] Dispatch failed', {
          inviteRequestId,
          inviteId: invite.id,
          to: normalizedEmail,
          error: err?.message,
          stack: err?.stack,
        });
      }
    });

    res.status(201).json({
      success: true,
      data: { invite, inviteUrl },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List pending tenant invites created by platform admins.
 * @route   GET /api/admin/tenants/invites
 */
exports.getTenantInvites = async (req, res, next) => {
  try {
    const invites = await InviteToken.findAll({
      where: {
        inviteType: 'new_tenant',
        tenantId: null,
        used: false,
      },
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name', 'email'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    return res.status(200).json({
      success: true,
      data: invites,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Revoke a pending tenant invite.
 * @route   DELETE /api/admin/tenants/invites/:id
 */
exports.revokeTenantInvite = async (req, res, next) => {
  try {
    const invite = await InviteToken.findOne({
      where: {
        id: req.params.id,
        inviteType: 'new_tenant',
        tenantId: null,
      },
    });

    if (!invite) {
      return res.status(404).json({
        success: false,
        message: 'Invite not found',
      });
    }

    if (invite.used) {
      return res.status(400).json({
        success: false,
        message: 'Cannot revoke an already used invite',
      });
    }

    await invite.destroy();

    return res.status(200).json({
      success: true,
      message: 'Invite revoked successfully',
    });
  } catch (error) {
    return next(error);
  }
};

exports.bootstrapPlatformAdmin = async (req, res, next) => {
  const { name, email, password } = req.body || {};

  try {
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();

    const existingAdmin = await User.findOne({
      where: { isPlatformAdmin: true },
    });

    if (existingAdmin) {
      return res.status(409).json({
        success: false,
        message: 'A platform administrator already exists. Please sign in instead.',
      });
    }

    const duplicateEmail = await User.findOne({
      where: { email: normalizedEmail },
    });

    if (duplicateEmail) {
      return res.status(409).json({
        success: false,
        message: 'A user with this email already exists.',
      });
    }

    let user;
    let defaultTenant;

    const transaction = await sequelize.transaction();

    try {
      [defaultTenant] = await Tenant.findOrCreate({
        where: { slug: 'default' },
        defaults: {
          name: 'Default Tenant',
          plan: 'trial',
          status: 'active',
          metadata: {},
        },
        transaction,
      });

      user = await User.create(
        {
          name: trimmedName,
          email: normalizedEmail,
          password,
          role: 'admin',
          isPlatformAdmin: true,
        },
        { transaction }
      );

      await UserTenant.create(
        {
          tenantId: defaultTenant.id,
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

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }

    const memberships = await UserTenant.findAll({
      where: { userId: user.id },
      include: [{ model: Tenant, as: 'tenant' }],
      order: [
        ['isDefault', 'DESC'],
        ['createdAt', 'ASC'],
      ],
    });

    const token = generateToken(user.id);
    const safeUser = user.toJSON();
    const safeMemberships = memberships.map((membership) => membership.toJSON());

    return res.status(201).json({
      success: true,
      data: {
        user: safeUser,
        token,
        memberships: safeMemberships,
        defaultTenantId: defaultTenant.id,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getTenantMetrics = async (req, res, next) => {
  try {
    const sinceDate = dayjs().subtract(30, 'day').startOf('day').toDate();

    const signupTrendRaw = await sequelize.query(
      `
        SELECT DATE("createdAt") AS date, COUNT(*)::int AS count
        FROM tenants
        WHERE "createdAt" >= :since
        GROUP BY DATE("createdAt")
        ORDER BY DATE("createdAt")
      `,
      {
        replacements: { since: sinceDate },
        type: QueryTypes.SELECT
      }
    );

    const signupTrend = signupTrendRaw.map((row) => ({
      date: dayjs(row.date).format('YYYY-MM-DD'),
      count: Number(row.count) || 0
    }));

    const planDistributionRaw = await Tenant.findAll({
      attributes: [
        'plan',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['plan'],
      raw: true
    });

    const statusDistributionRaw = await Tenant.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['status'],
      raw: true
    });

    const planCounts = planDistributionRaw.reduce((acc, row) => {
      const normalizedPlan = normalizePlanId(row.plan || 'unknown');
      acc[normalizedPlan] = (acc[normalizedPlan] || 0) + (Number(row.count) || 0);
      return acc;
    }, {});
    const planDistribution = Object.entries(planCounts).map(([plan, count]) => ({ plan, count }));

    const statusDistribution = statusDistributionRaw.map((row) => ({
      status: row.status || 'unknown',
      count: Number(row.count) || 0
    }));

    const totalByPlan = planDistribution.reduce((acc, item) => acc + item.count, 0);

    res.status(200).json({
      success: true,
      data: {
        signupTrend,
        planDistribution,
        statusDistribution,
        total: totalByPlan
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getPlatformAlerts = async (req, res, next) => {
  try {
    const today = dayjs().startOf('day');
    const trialThreshold = today.add(7, 'day').endOf('day').toDate();

    const upcomingTrials = await Tenant.findAll({
      where: {
        trialEndsAt: {
          [Op.not]: null,
          [Op.gte]: today.toDate(),
          [Op.lte]: trialThreshold
        },
        status: 'active'
      },
      attributes: ['id', 'name', 'plan', 'trialEndsAt', 'createdAt'],
      order: [['trialEndsAt', 'ASC']],
      limit: 10
    });

    const attentionRequired = await Tenant.findAll({
      where: {
        status: {
          [Op.notIn]: ['active']
        }
      },
      attributes: ['id', 'name', 'plan', 'status', 'updatedAt'],
      order: [['updatedAt', 'DESC']],
      limit: 10
    });

    res.status(200).json({
      success: true,
      data: {
        upcomingTrials: upcomingTrials.map((tenant) => ({
          id: tenant.id,
          name: tenant.name,
          plan: tenant.plan,
          trialEndsAt: tenant.trialEndsAt,
          createdAt: tenant.createdAt
        })),
        attentionRequired: attentionRequired.map((tenant) => ({
          id: tenant.id,
          name: tenant.name,
          plan: tenant.plan,
          status: tenant.status,
          updatedAt: tenant.updatedAt
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getTenantVendors = async (req, res, next) => {
  try {
    const tenant = await Tenant.findByPk(req.params.id);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }
    const vendors = await Vendor.findAll({
      where: { tenantId: tenant.id },
      attributes: ['id', 'name', 'company'],
      order: [['name', 'ASC']]
    });
    res.status(200).json({ success: true, data: vendors });
  } catch (error) {
    next(error);
  }
};

exports.getTenantJobs = async (req, res, next) => {
  try {
    const tenant = await Tenant.findByPk(req.params.id);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }
    const jobs = await Job.findAll({
      where: { tenantId: tenant.id },
      attributes: ['id', 'jobNumber', 'title'],
      order: [['jobNumber', 'DESC']],
      limit: 200
    });
    res.status(200).json({ success: true, data: jobs });
  } catch (error) {
    next(error);
  }
};

exports.getTenantById = async (req, res, next) => {
  try {
    const { Setting } = require('../models');
    
    const tenant = await Tenant.findByPk(req.params.id, {
      include: [
        {
          model: UserTenant,
          as: 'memberships',
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'name', 'email', 'role', 'isActive', 'lastLogin']
            }
          ]
        }
      ]
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    // Get organization settings (includes logo) for branding display
    // This shows the logo that tenants manage themselves in Settings
    let organizationSettings = {};
    try {
      const organizationSetting = await Setting.findOne({
        where: { tenantId: tenant.id, key: 'organization' }
      });
      organizationSettings = organizationSetting ? organizationSetting.value : {};
    } catch (error) {
      // If organization settings don't exist, use empty object
      console.warn('Could not fetch organization settings for tenant:', tenant.id);
    }

    const tenantData = tenant.toJSON();
    tenantData.organizationSettings = organizationSettings;
    tenantData.accessControl = await getTenantEffectiveEntitlements(tenant, {
      logContext: 'admin_tenant_detail',
    });

    res.status(200).json({
      success: true,
      data: tenantData
    });
  } catch (error) {
    next(error);
  }
};

exports.updateTenantAccess = async (req, res, next) => {
  try {
    const { plan, accessState, featureOverrides, note } = req.body || {};
    const tenant = await Tenant.findByPk(req.params.id);

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    const beforeSnapshot = {
      plan: tenant.plan,
      accessState: tenant?.metadata?.entitlements?.accessState || null,
      featureOverrides: tenant?.metadata?.entitlements?.featureOverrides || {},
      note: tenant?.metadata?.entitlements?.note || ''
    };

    if (plan != null) {
      const nextPlan = String(plan).trim();
      if (!nextPlan) {
        return res.status(400).json({
          success: false,
          message: 'Plan cannot be empty'
        });
      }
      const planExists = await SubscriptionPlan.findOne({
        where: { planId: nextPlan },
        attributes: ['id']
      });
      if (!planExists) {
        return res.status(400).json({
          success: false,
          message: `Plan "${nextPlan}" is not active or does not exist`
        });
      }
      tenant.plan = nextPlan;
    }

    if (accessState != null && !ACCESS_STATES.includes(accessState)) {
      return res.status(400).json({
        success: false,
        message: `Invalid accessState. Expected one of: ${ACCESS_STATES.join(', ')}`
      });
    }

    const metadata = tenant.metadata && typeof tenant.metadata === 'object' ? { ...tenant.metadata } : {};
    const entitlements = metadata.entitlements && typeof metadata.entitlements === 'object'
      ? { ...metadata.entitlements }
      : {};

    if (accessState != null) {
      entitlements.accessState = accessState;
    }
    if (featureOverrides != null) {
      entitlements.featureOverrides = normalizeFeatureOverrides(featureOverrides);
    }
    if (note != null) {
      entitlements.note = String(note).trim().slice(0, 500);
    }

    entitlements.updatedAt = new Date().toISOString();
    entitlements.updatedBy = req.user?.id || null;

    metadata.entitlements = entitlements;
    tenant.metadata = metadata;

    await tenant.save();

    if (plan != null) {
      const [subSetting] = await Setting.findOrCreate({
        where: { tenantId: tenant.id, key: 'subscription' },
        defaults: {
          tenantId: tenant.id,
          key: 'subscription',
          value: {},
        },
      });
      const prevSub =
        subSetting.value && typeof subSetting.value === 'object' ? { ...subSetting.value } : {};
      const nextPlan = tenant.plan;
      prevSub.plan = nextPlan;
      prevSub.status =
        nextPlan === 'trial'
          ? prevSub.status === 'active'
            ? 'trialing'
            : prevSub.status || 'trialing'
          : 'active';
      subSetting.value = prevSub;
      await subSetting.save();
    }

    const afterSnapshot = {
      plan: tenant.plan,
      accessState: metadata?.entitlements?.accessState || null,
      featureOverrides: metadata?.entitlements?.featureOverrides || {},
      note: metadata?.entitlements?.note || ''
    };

    await TenantAccessAudit.create({
      tenantId: tenant.id,
      actorUserId: req.user?.id || null,
      action: 'tenant_access_updated',
      before: beforeSnapshot,
      after: afterSnapshot,
      reason: metadata?.entitlements?.note || null
    });

    const freshTenant = await Tenant.findByPk(tenant.id);
    const accessControl = await getTenantEffectiveEntitlements(freshTenant, {
      logContext: 'admin_update_tenant_access',
    });

    res.status(200).json({
      success: true,
      data: {
        id: tenant.id,
        plan: tenant.plan,
        metadata: tenant.metadata,
        accessControl
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getTenantAccessAudit = async (req, res, next) => {
  try {
    const tenant = await Tenant.findByPk(req.params.id, { attributes: ['id'] });
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    const logs = await TenantAccessAudit.findAll({
      where: { tenantId: tenant.id },
      include: [
        {
          model: User,
          as: 'actor',
          attributes: ['id', 'name', 'email']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: 50
    });

    res.status(200).json({
      success: true,
      data: logs
    });
  } catch (error) {
    next(error);
  }
};

exports.updateTenantStatus = async (req, res, next) => {
  try {
    const { action } = req.body || {};
    const tenant = await Tenant.findByPk(req.params.id);

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    const validActions = ['activate', 'pause', 'suspend'];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Expected activate, pause, or suspend.'
      });
    }

    let nextStatus = tenant.status;
    switch (action) {
      case 'activate':
        nextStatus = 'active';
        break;
      case 'pause':
        nextStatus = 'paused';
        break;
      case 'suspend':
        nextStatus = 'suspended';
        break;
      default:
        break;
    }

    await tenant.update({
      status: nextStatus,
      metadata: {
        ...tenant.metadata,
        lastStatusChange: new Date().toISOString(),
        statusChangedBy: req.user?.id || null,
        statusAction: action
      }
    });

    res.status(200).json({
      success: true,
      data: tenant
    });
  } catch (error) {
    next(error);
  }
};

exports.getBillingSummary = async (req, res, next) => {
  try {
    const planBreakdownRaw = await Tenant.findAll({
      where: {
        plan: {
          [Op.ne]: 'trial'
        },
        status: 'active'
      },
      attributes: [
        'plan',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['plan'],
      raw: true
    });

    const trialingCount = await Tenant.count({
      where: {
        plan: 'trial',
        status: 'active'
      }
    });

    const planBreakdown = planBreakdownRaw.map((row) => {
      const normalizedPlan = normalizePlanId(row.plan);
      return {
      plan: normalizedPlan,
      count: Number(row.count) || 0,
      price: PLAN_PRICING[normalizedPlan] || 0,
      mrr: (PLAN_PRICING[normalizedPlan] || 0) * (Number(row.count) || 0)
    };
    });

    const estimatedMRR = planBreakdown.reduce((acc, item) => acc + item.mrr, 0);
    const payingTenants = planBreakdown.reduce((acc, item) => acc + item.count, 0);

    const upcomingRenewals = await Tenant.findAll({
      where: {
        plan: {
          [Op.ne]: 'trial'
        },
        status: 'active'
      },
      attributes: ['id', 'name', 'plan', 'status', 'metadata', 'createdAt', 'updatedAt'],
      order: [['updatedAt', 'DESC']],
      limit: 10
    });

    res.status(200).json({
      success: true,
      data: {
        planBreakdown,
        estimatedMRR,
        payingTenants,
        trialingTenants: trialingCount,
        upcomingRenewals
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getBillingTenants = async (req, res, next) => {
  try {
    const tenants = await Tenant.findAll({
      where: {
        plan: {
          [Op.ne]: 'trial'
        }
      },
      order: [['updatedAt', 'DESC']],
      attributes: [
        'id',
        'name',
        'plan',
        'status',
        'createdAt',
        'updatedAt',
        'metadata'
      ]
    });

    res.status(200).json({
      success: true,
      data: tenants
    });
  } catch (error) {
    next(error);
  }
};

exports.updateTenantBranding = async (req, res, next) => {
  try {
    const tenant = await Tenant.findByPk(req.params.id);

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    const { logoUrl } = req.body || {};

    const updatedMetadata = {
      ...(tenant.metadata || {}),
      logoUrl: logoUrl || ''
    };

    await tenant.update({
      metadata: updatedMetadata,
      updatedAt: new Date()
    });

    // Reload tenant to get fresh data
    await tenant.reload();

    res.status(200).json({
      success: true,
      data: tenant
    });
  } catch (error) {
    next(error);
  }
};

exports.getSystemHealth = async (req, res, next) => {
  try {
    const dbStart = Date.now();
    await sequelize.query('SELECT 1');
    const dbLatencyMs = Date.now() - dbStart;

    const [pendingNotifications, pausedTenants, suspendedTenants, activeAdmins] =
      await Promise.all([
        Notification.count({ where: { isRead: false } }),
        Tenant.count({ where: { status: 'paused' } }),
        Tenant.count({ where: { status: 'suspended' } }),
        User.count({ where: { isPlatformAdmin: true, isActive: true } }),
      ]);

    const recentTenants = await Tenant.findAll({
      attributes: ['id', 'name', 'plan', 'status', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit: 5,
    });

    const recentNotifications = await Notification.findAll({
      attributes: ['id', 'title', 'type', 'isRead', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit: 5,
    });

    res.status(200).json({
      success: true,
      data: {
        serverStartedAt,
        uptimeSeconds: process.uptime(),
        uptimeHuman: formatDuration(process.uptime()),
        database: {
          status: 'online',
          latencyMs: dbLatencyMs,
        },
        counts: {
          pendingNotifications,
          pausedTenants,
          suspendedTenants,
          activeAdmins,
        },
        recentTenants,
        recentNotifications,
      },
    });
  } catch (error) {
    next(error);
  }
};

