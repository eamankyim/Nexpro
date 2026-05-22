const { Op } = require('sequelize');

/**
 * Parse YYYY-MM-DD query dates into an inclusive local-day Sequelize between filter.
 * Normalizes start to 00:00:00.000 and end to 23:59:59.999 (matches dashboard overview).
 * @param {string|null|undefined} startDate
 * @param {string|null|undefined} endDate
 * @returns {Object|null} `{ [Op.between]: [start, end] }` or null when incomplete
 */
const parseReportDateRange = (startDate, endDate) => {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return null;
  start.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  if (Number.isNaN(end.getTime())) return null;
  end.setHours(23, 59, 59, 999);

  if (start > end) return null;

  return { [Op.between]: [start, end] };
};

/**
 * @param {Object} [query]
 * @returns {Object} date filter object (empty when no valid range)
 */
const buildDateFilterFromQuery = (query = {}) =>
  parseReportDateRange(query.startDate, query.endDate) || {};

module.exports = {
  parseReportDateRange,
  buildDateFilterFromQuery,
};
