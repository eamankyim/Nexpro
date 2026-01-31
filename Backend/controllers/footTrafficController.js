const { FootTraffic, Shop, Sale, User } = require('../models');
const { Op } = require('sequelize');
const { applyTenantFilter } = require('../utils/tenantUtils');
const { getPagination } = require('../utils/paginationUtils');
const { sequelize } = require('../config/database');

/**
 * Get all foot traffic records with filtering and pagination
 * @route GET /api/foot-traffic
 */
const getFootTraffic = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { page, limit, offset } = getPagination(req, { defaultPageSize: 20 });
    const { shopId, startDate, endDate, entryMethod, periodType } = req.query;

    const where = applyTenantFilter({ tenantId }, req);

    if (shopId) {
      where.shopId = shopId;
    }

    if (entryMethod) {
      where.entryMethod = entryMethod;
    }

    if (periodType) {
      where.periodType = periodType;
    }

    if (startDate || endDate) {
      where.periodStart = {};
      if (startDate) {
        where.periodStart[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        where.periodEnd = { [Op.lte]: new Date(endDate) };
      }
    }

    const { count, rows } = await FootTraffic.findAndCountAll({
      where,
      include: [
        { model: Shop, as: 'shop', attributes: ['id', 'name', 'code'] },
        { model: User, as: 'recorder', attributes: ['id', 'name', 'email'] }
      ],
      order: [['periodStart', 'DESC']],
      limit,
      offset
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page,
        limit,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching foot traffic:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch foot traffic data'
    });
  }
};

/**
 * Get foot traffic analytics/summary
 * @route GET /api/foot-traffic/analytics
 */
const getTrafficAnalytics = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { shopId, startDate, endDate, groupBy = 'day' } = req.query;

    const where = applyTenantFilter({ tenantId }, req);

    if (shopId) {
      where.shopId = shopId;
    }

    // Default to last 30 days
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate 
      ? new Date(startDate) 
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    where.periodStart = { [Op.gte]: start };
    where.periodEnd = { [Op.lte]: end };

    // Get total stats
    const totals = await FootTraffic.findOne({
      where,
      attributes: [
        [sequelize.fn('SUM', sequelize.col('visitorCount')), 'totalVisitors'],
        [sequelize.fn('SUM', sequelize.col('purchaseCount')), 'totalPurchases'],
        [sequelize.fn('SUM', sequelize.col('periodRevenue')), 'totalRevenue'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'recordCount']
      ],
      raw: true
    });

    // Calculate conversion rate
    const conversionRate = totals.totalVisitors > 0 
      ? ((totals.totalPurchases / totals.totalVisitors) * 100).toFixed(2)
      : 0;

    // Get sales count for the period to calculate accurate conversion
    const salesCount = await Sale.count({
      where: {
        tenantId,
        status: 'completed',
        createdAt: {
          [Op.between]: [start, end]
        },
        ...(shopId && { shopId })
      }
    });

    // Get traffic by time period
    let dateFormat;
    switch (groupBy) {
      case 'hour':
        dateFormat = 'YYYY-MM-DD HH24:00';
        break;
      case 'week':
        dateFormat = 'IYYY-IW';
        break;
      case 'month':
        dateFormat = 'YYYY-MM';
        break;
      default:
        dateFormat = 'YYYY-MM-DD';
    }

    const trafficByPeriod = await FootTraffic.findAll({
      where,
      attributes: [
        [sequelize.fn('TO_CHAR', sequelize.col('periodStart'), dateFormat), 'period'],
        [sequelize.fn('SUM', sequelize.col('visitorCount')), 'visitors'],
        [sequelize.fn('SUM', sequelize.col('purchaseCount')), 'purchases'],
        [sequelize.fn('SUM', sequelize.col('periodRevenue')), 'revenue']
      ],
      group: [sequelize.fn('TO_CHAR', sequelize.col('periodStart'), dateFormat)],
      order: [[sequelize.fn('TO_CHAR', sequelize.col('periodStart'), dateFormat), 'ASC']],
      raw: true
    });

    // Get peak hours (for hourly data)
    const peakHours = await FootTraffic.findAll({
      where: {
        ...where,
        periodType: 'hourly'
      },
      attributes: [
        [sequelize.fn('EXTRACT', sequelize.literal("HOUR FROM \"periodStart\"")), 'hour'],
        [sequelize.fn('AVG', sequelize.col('visitorCount')), 'avgVisitors']
      ],
      group: [sequelize.fn('EXTRACT', sequelize.literal("HOUR FROM \"periodStart\""))],
      order: [[sequelize.fn('AVG', sequelize.col('visitorCount')), 'DESC']],
      limit: 5,
      raw: true
    });

    // Get traffic by shop
    const trafficByShop = await FootTraffic.findAll({
      where,
      include: [{ model: Shop, as: 'shop', attributes: ['id', 'name'] }],
      attributes: [
        'shopId',
        [sequelize.fn('SUM', sequelize.col('visitorCount')), 'visitors'],
        [sequelize.fn('SUM', sequelize.col('purchaseCount')), 'purchases'],
        [sequelize.fn('SUM', sequelize.col('periodRevenue')), 'revenue']
      ],
      group: ['shopId', 'shop.id', 'shop.name'],
      raw: true,
      nest: true
    });

    // Average visitors per day
    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) || 1;
    const avgVisitorsPerDay = (totals.totalVisitors / daysDiff).toFixed(0);

    // Average revenue per visitor
    const avgRevenuePerVisitor = totals.totalVisitors > 0
      ? (totals.totalRevenue / totals.totalVisitors).toFixed(2)
      : 0;

    res.json({
      success: true,
      data: {
        summary: {
          totalVisitors: parseInt(totals.totalVisitors) || 0,
          totalPurchases: parseInt(totals.totalPurchases) || 0,
          actualSales: salesCount,
          totalRevenue: parseFloat(totals.totalRevenue) || 0,
          conversionRate: parseFloat(conversionRate),
          avgVisitorsPerDay: parseInt(avgVisitorsPerDay),
          avgRevenuePerVisitor: parseFloat(avgRevenuePerVisitor),
          period: { start, end }
        },
        trafficByPeriod,
        peakHours,
        trafficByShop
      }
    });
  } catch (error) {
    console.error('Error fetching traffic analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch traffic analytics'
    });
  }
};

/**
 * Get single foot traffic record
 * @route GET /api/foot-traffic/:id
 */
const getFootTrafficById = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;

    const record = await FootTraffic.findOne({
      where: { id, tenantId },
      include: [
        { model: Shop, as: 'shop', attributes: ['id', 'name', 'code'] },
        { model: User, as: 'recorder', attributes: ['id', 'name', 'email'] }
      ]
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        error: 'Foot traffic record not found'
      });
    }

    res.json({
      success: true,
      data: record
    });
  } catch (error) {
    console.error('Error fetching foot traffic record:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch foot traffic record'
    });
  }
};

/**
 * Create foot traffic record (manual entry)
 * @route POST /api/foot-traffic
 */
const createFootTraffic = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const userId = req.user.id;
    const {
      shopId,
      visitorCount,
      entryMethod = 'manual',
      periodType = 'daily',
      periodStart,
      periodEnd,
      purchaseCount,
      periodRevenue,
      deviceId,
      weather,
      notes,
      metadata
    } = req.body;

    // Validate required fields
    if (visitorCount === undefined || !periodStart || !periodEnd) {
      return res.status(400).json({
        success: false,
        error: 'visitorCount, periodStart, and periodEnd are required'
      });
    }

    // Calculate purchase count and revenue from sales if not provided
    let calculatedPurchaseCount = purchaseCount;
    let calculatedRevenue = periodRevenue;

    if (calculatedPurchaseCount === undefined || calculatedRevenue === undefined) {
      const salesData = await Sale.findOne({
        where: {
          tenantId,
          status: 'completed',
          createdAt: {
            [Op.between]: [new Date(periodStart), new Date(periodEnd)]
          },
          ...(shopId && { shopId })
        },
        attributes: [
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
          [sequelize.fn('SUM', sequelize.col('total')), 'revenue']
        ],
        raw: true
      });

      if (calculatedPurchaseCount === undefined) {
        calculatedPurchaseCount = parseInt(salesData.count) || 0;
      }
      if (calculatedRevenue === undefined) {
        calculatedRevenue = parseFloat(salesData.revenue) || 0;
      }
    }

    const record = await FootTraffic.create({
      tenantId,
      shopId,
      visitorCount,
      entryMethod,
      periodType,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      purchaseCount: calculatedPurchaseCount,
      periodRevenue: calculatedRevenue,
      deviceId,
      weather,
      notes,
      recordedBy: userId,
      metadata: metadata || {}
    });

    const created = await FootTraffic.findByPk(record.id, {
      include: [
        { model: Shop, as: 'shop', attributes: ['id', 'name', 'code'] },
        { model: User, as: 'recorder', attributes: ['id', 'name', 'email'] }
      ]
    });

    res.status(201).json({
      success: true,
      data: created
    });
  } catch (error) {
    console.error('Error creating foot traffic record:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create foot traffic record'
    });
  }
};

/**
 * Bulk create foot traffic records (for IoT devices)
 * @route POST /api/foot-traffic/bulk
 */
const bulkCreateFootTraffic = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const tenantId = req.tenantId;
    const { records } = req.body;

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'records array is required'
      });
    }

    if (records.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 100 records per batch'
      });
    }

    const createdRecords = await FootTraffic.bulkCreate(
      records.map(r => ({
        ...r,
        tenantId,
        periodStart: new Date(r.periodStart),
        periodEnd: new Date(r.periodEnd)
      })),
      { transaction }
    );

    await transaction.commit();

    res.status(201).json({
      success: true,
      data: {
        created: createdRecords.length,
        records: createdRecords
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error bulk creating foot traffic:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create foot traffic records'
    });
  }
};

/**
 * Update foot traffic record
 * @route PUT /api/foot-traffic/:id
 */
const updateFootTraffic = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const updates = req.body;

    const record = await FootTraffic.findOne({
      where: { id, tenantId }
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        error: 'Foot traffic record not found'
      });
    }

    // Don't allow changing tenantId
    delete updates.tenantId;

    if (updates.periodStart) {
      updates.periodStart = new Date(updates.periodStart);
    }
    if (updates.periodEnd) {
      updates.periodEnd = new Date(updates.periodEnd);
    }

    await record.update(updates);

    const updated = await FootTraffic.findByPk(id, {
      include: [
        { model: Shop, as: 'shop', attributes: ['id', 'name', 'code'] },
        { model: User, as: 'recorder', attributes: ['id', 'name', 'email'] }
      ]
    });

    res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    console.error('Error updating foot traffic record:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update foot traffic record'
    });
  }
};

/**
 * Delete foot traffic record
 * @route DELETE /api/foot-traffic/:id
 */
const deleteFootTraffic = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;

    const record = await FootTraffic.findOne({
      where: { id, tenantId }
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        error: 'Foot traffic record not found'
      });
    }

    await record.destroy();

    res.json({
      success: true,
      message: 'Foot traffic record deleted'
    });
  } catch (error) {
    console.error('Error deleting foot traffic record:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete foot traffic record'
    });
  }
};

/**
 * Quick check-in endpoint (for mobile app / customer check-in kiosk)
 * @route POST /api/foot-traffic/checkin
 */
const recordCheckIn = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { shopId } = req.body;

    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    // Find or create today's record
    let [record, created] = await FootTraffic.findOrCreate({
      where: {
        tenantId,
        shopId: shopId || null,
        periodType: 'daily',
        periodStart: startOfDay
      },
      defaults: {
        tenantId,
        shopId: shopId || null,
        visitorCount: 1,
        entryMethod: 'mobile_checkin',
        periodType: 'daily',
        periodStart: startOfDay,
        periodEnd: endOfDay,
        purchaseCount: 0,
        periodRevenue: 0
      }
    });

    if (!created) {
      // Increment visitor count
      await record.increment('visitorCount');
      await record.reload();
    }

    res.json({
      success: true,
      data: {
        todayCount: record.visitorCount,
        checkInTime: new Date()
      }
    });
  } catch (error) {
    console.error('Error recording check-in:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record check-in'
    });
  }
};

/**
 * Get today's traffic summary (for dashboard widget)
 * @route GET /api/foot-traffic/today
 */
const getTodaySummary = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { shopId } = req.query;

    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const where = {
      tenantId,
      periodStart: { [Op.gte]: startOfDay },
      periodEnd: { [Op.lte]: endOfDay }
    };

    if (shopId) {
      where.shopId = shopId;
    }

    const todayData = await FootTraffic.findOne({
      where,
      attributes: [
        [sequelize.fn('SUM', sequelize.col('visitorCount')), 'visitors'],
        [sequelize.fn('SUM', sequelize.col('purchaseCount')), 'purchases'],
        [sequelize.fn('SUM', sequelize.col('periodRevenue')), 'revenue']
      ],
      raw: true
    });

    // Get yesterday for comparison
    const yesterdayStart = new Date(startOfDay);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = new Date(endOfDay);
    yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);

    const yesterdayData = await FootTraffic.findOne({
      where: {
        tenantId,
        periodStart: { [Op.gte]: yesterdayStart },
        periodEnd: { [Op.lte]: yesterdayEnd },
        ...(shopId && { shopId })
      },
      attributes: [
        [sequelize.fn('SUM', sequelize.col('visitorCount')), 'visitors']
      ],
      raw: true
    });

    const todayVisitors = parseInt(todayData?.visitors) || 0;
    const yesterdayVisitors = parseInt(yesterdayData?.visitors) || 0;
    const change = yesterdayVisitors > 0 
      ? (((todayVisitors - yesterdayVisitors) / yesterdayVisitors) * 100).toFixed(1)
      : todayVisitors > 0 ? 100 : 0;

    // Get today's sales count
    const todaySales = await Sale.count({
      where: {
        tenantId,
        status: 'completed',
        createdAt: { [Op.between]: [startOfDay, endOfDay] },
        ...(shopId && { shopId })
      }
    });

    const conversionRate = todayVisitors > 0
      ? ((todaySales / todayVisitors) * 100).toFixed(1)
      : 0;

    res.json({
      success: true,
      data: {
        visitors: todayVisitors,
        purchases: todaySales,
        revenue: parseFloat(todayData?.revenue) || 0,
        conversionRate: parseFloat(conversionRate),
        vsYesterday: parseFloat(change)
      }
    });
  } catch (error) {
    console.error('Error fetching today summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch today summary'
    });
  }
};

module.exports = {
  getFootTraffic,
  getTrafficAnalytics,
  getFootTrafficById,
  createFootTraffic,
  bulkCreateFootTraffic,
  updateFootTraffic,
  deleteFootTraffic,
  recordCheckIn,
  getTodaySummary
};
