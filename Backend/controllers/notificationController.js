const { Op } = require('sequelize');
const { Notification, User } = require('../models');
const config = require('../config/config');
const { applyTenantFilter } = require('../utils/tenantUtils');

exports.getNotifications = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || config.pagination.defaultPageSize;
    const offset = (page - 1) * limit;
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
      include: [
        {
          model: User,
          as: 'actor',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    console.log('[Notifications] getNotifications', {
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

      console.log('[Notifications] markNotificationRead', {
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

    console.log('[Notifications] markAllNotificationsRead', {
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
    const totals = await Notification.findAll({
      where: applyTenantFilter(req.tenantId, { userId: req.user.id }),
      attributes: [
        [Notification.sequelize.fn('COUNT', Notification.sequelize.col('id')), 'total'],
        [
          Notification.sequelize.fn('SUM', Notification.sequelize.literal(`CASE WHEN "isRead" = false THEN 1 ELSE 0 END`)),
          'unread'
        ]
      ]
    });

    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

    const recent = await Notification.count({
      where: applyTenantFilter(req.tenantId, {
        userId: req.user.id,
        createdAt: {
          [Op.gte]: fortyEightHoursAgo
        }
      })
    });

    const summary = totals[0]?.toJSON() || { total: 0, unread: 0 };

    console.log('[Notifications] getNotificationSummary', {
      userId: req.user.id,
      total: summary.total,
      unread: summary.unread,
      recent
    });

    res.status(200).json({
      success: true,
      data: {
        total: parseInt(summary.total, 10) || 0,
        unread: parseInt(summary.unread, 10) || 0,
        recent
      }
    });
  } catch (error) {
    next(error);
  }
};


