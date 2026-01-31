const config = require('../config/config');

/**
 * Normalize and cap pagination from request query.
 * Ensures limit does not exceed maxPageSize to prevent heavy queries.
 *
 * @param {object} req - Express request (req.query.page, req.query.limit)
 * @param {object} [options] - Optional: { defaultPageSize }
 * @returns {{ page: number, limit: number, offset: number }}
 */
function getPagination(req, options = {}) {
  const defaultPageSize = options.defaultPageSize ?? config.pagination.defaultPageSize;
  const maxPageSize = config.pagination.maxPageSize;

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const requestedLimit = parseInt(req.query.limit, 10) || defaultPageSize;
  const limit = Math.min(Math.max(1, requestedLimit), maxPageSize);
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

module.exports = { getPagination };
