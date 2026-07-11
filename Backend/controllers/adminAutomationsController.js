const {
  getAutomationsMessagingOverview,
  getMessagingUsage,
} = require('../services/adminAutomationsMessagingService');

/**
 * GET /api/admin/automations/overview
 * Cross-tenant automation observability (privacy-safe fields only).
 */
exports.getAdminAutomationsOverview = async (req, res, next) => {
  try {
    const data = await getAutomationsMessagingOverview({
      from: req.query.from,
      to: req.query.to,
      status: req.query.status,
      tenantId: req.query.tenantId,
      q: req.query.q,
      page: req.query.page,
      limit: req.query.limit,
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/messaging/usage
 * Platform SMS quota + channel send counts; optional Arkesel balance.
 */
exports.getAdminMessagingUsage = async (req, res, next) => {
  try {
    const data = await getMessagingUsage(
      {
        yearMonth: req.query.yearMonth,
        from: req.query.from,
        to: req.query.to,
        includeBalance: req.query.includeBalance,
      },
      {
        userId: req.user?.id,
        requestId: req.requestId || req.id,
      }
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
