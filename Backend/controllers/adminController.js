const dayjs = require('dayjs');
const jwt = require('jsonwebtoken');
const { Op, QueryTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const config = require('../config/config');
const { Tenant, User, UserTenant, Notification } = require('../models');

const PLAN_PRICING = {
  trial: 0,
  standard: 799,
  pro: 1299,
};

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
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;
    const { plan, status, search } = req.query;

    const where = {};
    if (plan) {
      where.plan = plan;
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

    const serialized = tenants.map((tenant) => {
      const item = tenant.toJSON();
      item.userCount = Number(item.userCount) || 0;
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

    const planDistribution = planDistributionRaw.map((row) => ({
      plan: row.plan || 'unknown',
      count: Number(row.count) || 0
    }));

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

exports.getTenantById = async (req, res, next) => {
  try {
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

    res.status(200).json({
      success: true,
      data: tenant
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

    const planBreakdown = planBreakdownRaw.map((row) => ({
      plan: row.plan,
      count: Number(row.count) || 0,
      price: PLAN_PRICING[row.plan] || 0,
      mrr: (PLAN_PRICING[row.plan] || 0) * (Number(row.count) || 0)
    }));

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

