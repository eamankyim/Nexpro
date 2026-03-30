const { Product, Sale, SaleItem, StockCount, StockCountItem, Notification, User, UserTenant } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { emitInventoryAlert, emitNotification } = require('./websocketService');

/**
 * Variance Detection Service
 * Detects shrinkage, revenue leakage, and suspicious patterns
 */

/**
 * Detect variance between expected and actual stock
 * @param {string} tenantId - Tenant ID
 * @param {Object} options - Detection options
 * @returns {Object} Variance detection results
 */
const detectStockVariance = async (tenantId, options = {}) => {
  const { 
    shopId = null, 
    threshold = 5, // Percentage threshold for significant variance
    daysBack = 30 
  } = options;

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Get all products
    const productWhere = { tenantId, isActive: true };
    if (shopId) productWhere.shopId = shopId;

    const products = await Product.findAll({ where: productWhere });

    const variances = [];

    for (const product of products) {
      // Calculate expected stock based on sales
      const salesData = await SaleItem.findOne({
        where: {
          productId: product.id,
          createdAt: { [Op.gte]: startDate }
        },
        attributes: [
          [sequelize.fn('SUM', sequelize.col('quantity')), 'totalSold']
        ],
        raw: true
      });

      const totalSold = parseFloat(salesData?.totalSold || 0);
      
      // Get last stock count for this product
      const lastCountItem = await StockCountItem.findOne({
        where: {
          productId: product.id,
          tenantId,
          varianceType: { [Op.ne]: 'uncounted' }
        },
        order: [['countedAt', 'DESC']]
      });

      if (lastCountItem) {
        const variancePercent = lastCountItem.systemQuantity > 0 
          ? Math.abs((lastCountItem.varianceQuantity / lastCountItem.systemQuantity) * 100)
          : 0;

        if (variancePercent >= threshold) {
          variances.push({
            productId: product.id,
            productName: product.name,
            productSku: product.sku,
            currentStock: product.quantityOnHand,
            systemQuantity: lastCountItem.systemQuantity,
            countedQuantity: lastCountItem.countedQuantity,
            varianceQuantity: lastCountItem.varianceQuantity,
            varianceValue: lastCountItem.varianceValue,
            variancePercent: variancePercent.toFixed(2),
            varianceType: lastCountItem.varianceType,
            lastCountDate: lastCountItem.countedAt,
            severity: variancePercent >= 20 ? 'high' : variancePercent >= 10 ? 'medium' : 'low'
          });
        }
      }
    }

    // Sort by severity and variance value
    variances.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity];
      }
      return Math.abs(b.varianceValue) - Math.abs(a.varianceValue);
    });

    return {
      success: true,
      data: {
        totalProducts: products.length,
        productsWithVariance: variances.length,
        variances,
        summary: {
          highSeverity: variances.filter(v => v.severity === 'high').length,
          mediumSeverity: variances.filter(v => v.severity === 'medium').length,
          lowSeverity: variances.filter(v => v.severity === 'low').length,
          totalShrinkageValue: variances
            .filter(v => v.varianceType === 'shrinkage')
            .reduce((sum, v) => sum + Math.abs(parseFloat(v.varianceValue || 0)), 0),
          totalOverageValue: variances
            .filter(v => v.varianceType === 'overage')
            .reduce((sum, v) => sum + parseFloat(v.varianceValue || 0), 0)
        }
      }
    };
  } catch (error) {
    console.error('[VarianceDetection] Error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Detect suspicious sales patterns
 * Looks for: high void rates, unusual discounts, off-hours transactions
 * @param {string} tenantId - Tenant ID
 * @param {Object} options - Detection options
 */
const detectSuspiciousPatterns = async (tenantId, options = {}) => {
  const { daysBack = 7, shopId = null } = options;

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const saleWhere = {
      tenantId,
      createdAt: { [Op.gte]: startDate }
    };
    if (shopId) saleWhere.shopId = shopId;

    // Get sales data
    const salesData = await Sale.findAll({
      where: saleWhere,
      attributes: [
        'id', 'saleNumber', 'total', 'discount', 'status', 
        'paymentMethod', 'soldBy', 'createdAt'
      ],
      include: [
        { model: User, as: 'seller', attributes: ['id', 'name'] }
      ]
    });

    const alerts = [];

    // 1. High cancellation/void rate by seller
    const sellerStats = {};
    salesData.forEach(sale => {
      const sellerId = sale.soldBy || 'unknown';
      if (!sellerStats[sellerId]) {
        sellerStats[sellerId] = { 
          name: sale.seller?.name || 'Unknown',
          total: 0, 
          cancelled: 0, 
          refunded: 0,
          totalDiscount: 0,
          totalRevenue: 0
        };
      }
      sellerStats[sellerId].total++;
      sellerStats[sellerId].totalRevenue += parseFloat(sale.total || 0);
      sellerStats[sellerId].totalDiscount += parseFloat(sale.discount || 0);
      if (sale.status === 'cancelled') sellerStats[sellerId].cancelled++;
      if (sale.status === 'refunded') sellerStats[sellerId].refunded++;
    });

    Object.entries(sellerStats).forEach(([sellerId, stats]) => {
      const cancelRate = stats.total > 10 ? (stats.cancelled / stats.total) * 100 : 0;
      const refundRate = stats.total > 10 ? (stats.refunded / stats.total) * 100 : 0;
      const avgDiscount = stats.total > 0 ? (stats.totalDiscount / stats.total) : 0;

      if (cancelRate > 10) {
        alerts.push({
          type: 'high_cancel_rate',
          severity: cancelRate > 20 ? 'high' : 'medium',
          message: `${stats.name} has ${cancelRate.toFixed(1)}% cancellation rate`,
          sellerId,
          sellerName: stats.name,
          value: cancelRate,
          metric: 'cancel_rate'
        });
      }

      if (refundRate > 5) {
        alerts.push({
          type: 'high_refund_rate',
          severity: refundRate > 15 ? 'high' : 'medium',
          message: `${stats.name} has ${refundRate.toFixed(1)}% refund rate`,
          sellerId,
          sellerName: stats.name,
          value: refundRate,
          metric: 'refund_rate'
        });
      }

      if (avgDiscount > 50) {
        alerts.push({
          type: 'high_discount_average',
          severity: avgDiscount > 100 ? 'high' : 'medium',
          message: `${stats.name} gives average discount of ${avgDiscount.toFixed(0)} per sale`,
          sellerId,
          sellerName: stats.name,
          value: avgDiscount,
          metric: 'avg_discount'
        });
      }
    });

    // 2. Off-hours transactions
    const offHoursSales = salesData.filter(sale => {
      const hour = new Date(sale.createdAt).getHours();
      return hour < 6 || hour > 22; // Before 6 AM or after 10 PM
    });

    if (offHoursSales.length > 5) {
      alerts.push({
        type: 'off_hours_sales',
        severity: offHoursSales.length > 20 ? 'high' : 'medium',
        message: `${offHoursSales.length} sales made during off-hours`,
        count: offHoursSales.length,
        metric: 'off_hours_count'
      });
    }

    // 3. Cash payment anomalies (high cash to card ratio might indicate skimming)
    const paymentMethods = {};
    salesData.forEach(sale => {
      const method = sale.paymentMethod || 'unknown';
      if (!paymentMethods[method]) {
        paymentMethods[method] = { count: 0, total: 0 };
      }
      paymentMethods[method].count++;
      paymentMethods[method].total += parseFloat(sale.total || 0);
    });

    const cashSales = paymentMethods.cash || { count: 0, total: 0 };
    const totalSales = salesData.length;
    const cashRatio = totalSales > 20 ? (cashSales.count / totalSales) * 100 : 0;

    if (cashRatio > 80) {
      alerts.push({
        type: 'high_cash_ratio',
        severity: 'medium',
        message: `${cashRatio.toFixed(1)}% of sales are cash transactions`,
        value: cashRatio,
        metric: 'cash_ratio'
      });
    }

    // Sort alerts by severity
    alerts.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    return {
      success: true,
      data: {
        alerts,
        summary: {
          totalAlerts: alerts.length,
          highSeverity: alerts.filter(a => a.severity === 'high').length,
          mediumSeverity: alerts.filter(a => a.severity === 'medium').length,
          salesAnalyzed: salesData.length,
          period: { start: startDate, end: new Date() }
        },
        sellerStats,
        paymentMethods
      }
    };
  } catch (error) {
    console.error('[SuspiciousPatterns] Error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Generate revenue leakage report
 * @param {string} tenantId - Tenant ID
 * @param {Object} options - Report options
 */
const generateLeakageReport = async (tenantId, options = {}) => {
  try {
    // Get variance data
    const varianceResult = await detectStockVariance(tenantId, options);
    
    // Get suspicious patterns
    const patternsResult = await detectSuspiciousPatterns(tenantId, options);

    // Calculate total potential leakage
    const stockShrinkage = varianceResult.success 
      ? varianceResult.data.summary.totalShrinkageValue 
      : 0;

    const report = {
      generatedAt: new Date(),
      tenantId,
      period: options.daysBack || 30,
      stockVariance: varianceResult.success ? varianceResult.data : null,
      suspiciousPatterns: patternsResult.success ? patternsResult.data : null,
      summary: {
        estimatedLeakage: stockShrinkage,
        alertCount: patternsResult.success ? patternsResult.data.summary.totalAlerts : 0,
        productsAtRisk: varianceResult.success ? varianceResult.data.productsWithVariance : 0,
        riskLevel: stockShrinkage > 5000 ? 'high' : stockShrinkage > 1000 ? 'medium' : 'low'
      },
      recommendations: []
    };

    // Generate recommendations
    if (stockShrinkage > 1000) {
      report.recommendations.push({
        priority: 'high',
        action: 'Conduct physical stock count',
        reason: `Estimated shrinkage of ${stockShrinkage.toFixed(2)} detected`
      });
    }

    if (patternsResult.success && patternsResult.data.alerts.some(a => a.type === 'high_cancel_rate')) {
      report.recommendations.push({
        priority: 'medium',
        action: 'Review cancellation policies',
        reason: 'High cancellation rates detected'
      });
    }

    if (patternsResult.success && patternsResult.data.alerts.some(a => a.type === 'high_discount_average')) {
      report.recommendations.push({
        priority: 'medium',
        action: 'Review discount authorization levels',
        reason: 'Unusually high discounts being applied'
      });
    }

    return {
      success: true,
      data: report
    };
  } catch (error) {
    console.error('[LeakageReport] Error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Create alert notifications for variance issues (one per admin/manager so notice board works).
 * @param {string} tenantId - Tenant ID
 * @param {Array} alerts - Array of alert objects
 */
const createVarianceAlerts = async (tenantId, alerts) => {
  if (!alerts || alerts.length === 0) return;
  try {
    const managerUsers = await UserTenant.findAll({
      where: {
        tenantId,
        role: { [Op.in]: ['admin', 'manager'] }
      },
      attributes: ['userId']
    });
    const recipientIds = [...new Set(managerUsers.map(ut => ut.userId).filter(Boolean))];
    if (recipientIds.length === 0) {
      console.warn('[VarianceAlerts] No admin/manager recipients for tenant', tenantId);
      return;
    }
    for (const alert of alerts) {
      const title = alert.type === 'shrinkage'
        ? 'Stock Shrinkage Detected'
        : 'Suspicious Pattern Alert';
      const payload = {
        tenantId,
        type: 'materials',
        title,
        message: alert.message,
        priority: alert.severity === 'high' ? 'high' : 'normal',
        channels: ['in_app', 'email'],
        metadata: alert
      };
      for (const userId of recipientIds) {
        const notification = await Notification.create({
          ...payload,
          userId
        });
        try {
          emitNotification(tenantId, userId, {
            id: notification.id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            priority: notification.priority,
            link: notification.link,
            createdAt: notification.createdAt,
            data: alert
          });
        } catch (wsErr) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[VarianceAlerts] WebSocket emit failed:', wsErr?.message);
          }
        }
      }
    }
  } catch (error) {
    console.error('[VarianceAlerts] Error creating alerts:', error);
  }
};

module.exports = {
  detectStockVariance,
  detectSuspiciousPatterns,
  generateLeakageReport,
  createVarianceAlerts
};
