const {
  detectStockVariance,
  detectSuspiciousPatterns,
  generateLeakageReport,
  createVarianceAlerts
} = require('../services/varianceDetectionService');

/**
 * Get stock variance report
 * @route GET /api/variance/stock
 */
exports.getStockVariance = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { shopId, threshold, daysBack } = req.query;

    const result = await detectStockVariance(tenantId, {
      shopId,
      threshold: threshold ? parseInt(threshold) : 5,
      daysBack: daysBack ? parseInt(daysBack) : 30
    });

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error getting stock variance:', error);
    res.status(500).json({ success: false, error: 'Failed to get stock variance' });
  }
};

/**
 * Get suspicious patterns report
 * @route GET /api/variance/patterns
 */
exports.getSuspiciousPatterns = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { shopId, daysBack } = req.query;

    const result = await detectSuspiciousPatterns(tenantId, {
      shopId,
      daysBack: daysBack ? parseInt(daysBack) : 7
    });

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error getting suspicious patterns:', error);
    res.status(500).json({ success: false, error: 'Failed to get suspicious patterns' });
  }
};

/**
 * Get revenue leakage report
 * @route GET /api/variance/leakage-report
 */
exports.getLeakageReport = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { shopId, daysBack } = req.query;

    const result = await generateLeakageReport(tenantId, {
      shopId,
      daysBack: daysBack ? parseInt(daysBack) : 30
    });

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error generating leakage report:', error);
    res.status(500).json({ success: false, error: 'Failed to generate leakage report' });
  }
};

/**
 * Run variance detection and create alerts
 * @route POST /api/variance/detect
 */
exports.runDetection = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { shopId, threshold, daysBack } = req.body;

    // Run variance detection
    const varianceResult = await detectStockVariance(tenantId, {
      shopId,
      threshold: threshold || 5,
      daysBack: daysBack || 30
    });

    // Run pattern detection
    const patternsResult = await detectSuspiciousPatterns(tenantId, {
      shopId,
      daysBack: daysBack || 7
    });

    // Collect high-severity alerts
    const alerts = [];

    if (varianceResult.success) {
      varianceResult.data.variances
        .filter(v => v.severity === 'high')
        .forEach(v => {
          alerts.push({
            type: v.varianceType,
            severity: 'high',
            message: `${v.productName}: ${Math.abs(v.varianceQuantity)} units ${v.varianceType} (${v.varianceValue} value)`,
            productId: v.productId
          });
        });
    }

    if (patternsResult.success) {
      patternsResult.data.alerts
        .filter(a => a.severity === 'high')
        .forEach(a => alerts.push(a));
    }

    // Create notifications for high-severity alerts
    if (alerts.length > 0) {
      await createVarianceAlerts(tenantId, alerts);
    }

    res.json({
      success: true,
      data: {
        varianceDetected: varianceResult.success ? varianceResult.data.productsWithVariance : 0,
        patternsDetected: patternsResult.success ? patternsResult.data.summary.totalAlerts : 0,
        alertsCreated: alerts.length,
        summary: {
          stockVariance: varianceResult.success ? varianceResult.data.summary : null,
          patterns: patternsResult.success ? patternsResult.data.summary : null
        }
      }
    });
  } catch (error) {
    console.error('Error running variance detection:', error);
    res.status(500).json({ success: false, error: 'Failed to run variance detection' });
  }
};

/**
 * Get dashboard summary of leakage metrics
 * @route GET /api/variance/dashboard
 */
exports.getDashboardSummary = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { shopId } = req.query;

    // Get last 30 days variance
    const varianceResult = await detectStockVariance(tenantId, { shopId, daysBack: 30 });
    
    // Get last 7 days patterns
    const patternsResult = await detectSuspiciousPatterns(tenantId, { shopId, daysBack: 7 });

    const summary = {
      estimatedShrinkage: varianceResult.success 
        ? varianceResult.data.summary.totalShrinkageValue 
        : 0,
      productsAtRisk: varianceResult.success 
        ? varianceResult.data.summary.highSeverity 
        : 0,
      activeAlerts: patternsResult.success 
        ? patternsResult.data.summary.totalAlerts 
        : 0,
      riskLevel: 'low'
    };

    // Determine overall risk level
    if (summary.estimatedShrinkage > 5000 || summary.productsAtRisk > 10) {
      summary.riskLevel = 'high';
    } else if (summary.estimatedShrinkage > 1000 || summary.productsAtRisk > 5) {
      summary.riskLevel = 'medium';
    }

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error getting dashboard summary:', error);
    res.status(500).json({ success: false, error: 'Failed to get dashboard summary' });
  }
};
