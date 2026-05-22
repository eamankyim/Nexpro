const { Op } = require('sequelize');
const { Notification, User, Product, Tenant } = require('../models');
const { sequelize } = require('../config/database');
const config = require('../config/config');
const { applyTenantFilter } = require('../utils/tenantUtils');
const { applyShopFilter } = require('../utils/shopUtils');
const { getPagination } = require('../utils/paginationUtils');
const { invalidateNotificationsCache } = require('../middleware/cache');

const STOCK_ALERT_TYPES = {
  OUT_OF_STOCK: 'out_of_stock',
  LOW_STOCK: 'low_stock'
};

async function syncStockAlertNotifications(req) {
  if (!req.tenantId || !req.user?.id) return;

  const tenant = req.tenant || await Tenant.findByPk(req.tenantId, {
    attributes: ['businessType']
  });
  const businessType = tenant?.businessType;
  if (businessType !== 'shop' && businessType !== 'pharmacy') return;

  const baseWhere = applyShopFilter(req, {
    tenantId: req.tenantId,
    isActive: true,
    trackStock: true
  });

  const [outOfStockCount, lowStockCount] = await Promise.all([
    Product.count({
      where: {
        ...baseWhere,
        quantityOnHand: { [Op.lte]: 0 }
      }
    }),
    Product.count({
      where: {
        ...baseWhere,
        quantityOnHand: { [Op.gt]: 0 },
        [Op.and]: [
          sequelize.where(sequelize.col('quantityOnHand'), Op.lte, sequelize.col('reorderLevel'))
        ]
      }
    })
  ]);

  await Promise.all([
    upsertStockAlertNotification({
      req,
      alertType: STOCK_ALERT_TYPES.OUT_OF_STOCK,
      count: outOfStockCount,
      title: `${outOfStockCount} item${outOfStockCount === 1 ? '' : 's'} out of stock`,
      message: outOfStockCount === 1
        ? '1 product is out of stock and cannot be sold until restocked.'
        : `${outOfStockCount} products are out of stock and cannot be sold until restocked.`,
      priority: 'high'
    }),
    upsertStockAlertNotification({
      req,
      alertType: STOCK_ALERT_TYPES.LOW_STOCK,
      count: lowStockCount,
      title: `${lowStockCount} item${lowStockCount === 1 ? '' : 's'} low on stock`,
      message: lowStockCount === 1
        ? '1 product is below its reorder level. Restock soon to avoid missed sales.'
        : `${lowStockCount} products are below their reorder level. Restock soon to avoid missed sales.`,
      priority: 'normal'
    })
  ]);
}

async function upsertStockAlertNotification({ req, alertType, count, title, message, priority }) {
  const where = {
    tenantId: req.tenantId,
    userId: req.user.id,
    type: 'inventory',
    metadata: {
      [Op.contains]: {
        source: 'stock_alert',
        alertType,
        shopId: req.shopFilterId || null
      }
    }
  };

  const existing = await Notification.findOne({ where, order: [['createdAt', 'DESC']] });

  if (count <= 0) {
    if (existing && !existing.isRead) {
      await existing.update({ isRead: true, readAt: new Date(), expiresAt: new Date() });
      invalidateNotificationsCache(req.tenantId, req.user.id);
    }
    return;
  }

  const metadata = {
    source: 'stock_alert',
    alertType,
    count,
    shopId: req.shopFilterId || null
  };

  if (!existing) {
    await Notification.create({
      tenantId: req.tenantId,
      userId: req.user.id,
      title,
      message,
      type: 'inventory',
      priority,
      metadata,
      channels: ['in_app'],
      icon: 'package',
      link: '/products'
    });
    invalidateNotificationsCache(req.tenantId, req.user.id);
    return;
  }

  const previousCount = Number(existing.metadata?.count || 0);
  if (previousCount !== count || existing.title !== title || existing.message !== message) {
    await existing.update({
      title,
      message,
      priority,
      metadata,
      isRead: false,
      readAt: null,
      expiresAt: null
    });
    invalidateNotificationsCache(req.tenantId, req.user.id);
  }
}

exports.getNotifications = async (req, res, next) => {
  try {
    await syncStockAlertNotifications(req);

    const { page, limit, offset } = getPagination(req);
    const type = req.query.type;
    const unreadOnly = req.query.unread === 'true';

    const where = applyTenantFilter(req.tenantId, {
      userId: req.user.id
    });

    if (type) {
      where.type = type;
    }
    if (unreadOnly) {
      where.isRead = false;
    }

    const { count, rows } = await Notification.findAndCountAll({
      where,
      offset,
      limit,
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'title', 'message', 'type', 'priority', 'link', 'isRead', 'readAt', 'createdAt', 'triggeredBy'],
      include: [
        {
          model: User,
          as: 'actor',
          attributes: ['id', 'name', 'email'],
          required: false
        }
      ]
    });

    if (config.nodeEnv === 'development') console.log('[Notifications] getNotifications', {
      userId: req.user.id,
      page,
      limit,
      unreadOnly,
      type,
      returned: rows.length,
      total: count
    });

    res.status(200).json({
      success: true,
      count,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(count / limit)
      },
      data: rows
    });
  } catch (error) {
    next(error);
  }
};

exports.markNotificationRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOne({
      where: applyTenantFilter(req.tenantId, {
        id: req.params.id,
        userId: req.user.id
      })
    });

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    if (!notification.isRead) {
      await notification.update({
        isRead: true,
        readAt: new Date()
      });
      invalidateNotificationsCache(req.tenantId, req.user.id);

      if (config.nodeEnv === 'development') console.log('[Notifications] markNotificationRead', {
        notificationId: notification.id,
        userId: req.user.id
      });
    }

    res.status(200).json({ success: true, data: notification });
  } catch (error) {
    next(error);
  }
};

exports.markAllNotificationsRead = async (req, res, next) => {
  try {
    const [updated] = await Notification.update(
      { isRead: true, readAt: new Date() },
      {
        where: applyTenantFilter(req.tenantId, {
          userId: req.user.id,
          isRead: false
        })
      }
    );
    invalidateNotificationsCache(req.tenantId, req.user.id);

    if (config.nodeEnv === 'development') console.log('[Notifications] markAllNotificationsRead', {
      userId: req.user.id,
      updated
    });

    res.status(200).json({
      success: true,
      message: `${updated} notifications marked as read`
    });
  } catch (error) {
    next(error);
  }
};

exports.getNotificationSummary = async (req, res, next) => {
  try {
    await syncStockAlertNotifications(req);

    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

    const [summaryRow] = await sequelize.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE "isRead" = false)::int AS unread,
         COUNT(*) FILTER (WHERE "createdAt" >= :cutoff)::int AS recent
       FROM notifications
       WHERE "tenantId" = :tenantId AND "userId" = :userId`,
      {
        replacements: { tenantId: req.tenantId, userId: req.user.id, cutoff: fortyEightHoursAgo },
        type: sequelize.QueryTypes.SELECT
      }
    );

    const summary = summaryRow || { total: 0, unread: 0, recent: 0 };

    res.status(200).json({
      success: true,
      data: {
        total: summary.total ?? 0,
        unread: summary.unread ?? 0,
        recent: summary.recent ?? 0
      }
    });
  } catch (error) {
    next(error);
  }
};


