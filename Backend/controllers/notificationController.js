const { Op } = require('sequelize');
const { Notification, User } = require('../models');
const config = require('../config/config');
const { applyTenantFilter } = require('../utils/tenantUtils');
const { getPagination } = require('../utils/paginationUtils');
const { invalidateNotificationsCache } = require('../middleware/cache');

exports.getNotifications = async (req, res, next) => {
  try {
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
    const { sequelize } = require('../config/database');
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


