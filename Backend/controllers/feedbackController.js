const { CustomerFeedback } = require('../models');

/**
 * GET /api/feedback
 * Query: page, limit (max 100)
 */
exports.listTenantFeedback = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const offset = (page - 1) * limit;

    const { rows, count } = await CustomerFeedback.findAndCountAll({
      where: { tenantId: req.tenantId },
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      attributes: [
        'id',
        'rating',
        'comment',
        'contactName',
        'contactEmail',
        'contactPhone',
        'source',
        'sourceRef',
        'metadata',
        'createdAt'
      ]
    });

    const pages = Math.ceil(count / limit) || 1;

    res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page,
        limit,
        pages
      }
    });
  } catch (error) {
    next(error);
  }
};
