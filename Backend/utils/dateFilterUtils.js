/**
 * Date Filter Utilities
 * 
 * Provides consistent date filter handling across all controllers.
 * Ensures proper time boundaries (start of day to end of day) for accurate filtering.
 */

const { Op } = require('sequelize');

/**
 * Creates a date filter object for Sequelize queries
 * @param {string|Date} startDate - Start date (ISO string or Date object)
 * @param {string|Date} endDate - End date (ISO string or Date object)
 * @returns {Object|null} Sequelize date filter object or null if dates are invalid
 */
const createDateFilter = (startDate, endDate) => {
  if (!startDate || !endDate) {
    return null;
  }

  try {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return null;
    }

    // Set start date to beginning of day (00:00:00.000)
    start.setHours(0, 0, 0, 0);

    // Set end date to end of day (23:59:59.999)
    end.setHours(23, 59, 59, 999);

    return {
      [Op.between]: [start, end]
    };
  } catch (error) {
    console.error('[DateFilterUtils] Error creating date filter:', error);
    return null;
  }
};

/**
 * Checks if a date filter object has content
 * Since Op.between is a Symbol, Object.keys() won't detect it
 * @param {Object} dateFilter - Date filter object to check
 * @returns {boolean} True if date filter has content
 */
const hasDateFilter = (dateFilter) => {
  return dateFilter && (Object.keys(dateFilter).length > 0 || dateFilter[Op.between] !== undefined);
};

/**
 * Creates a date filter for a specific date field
 * @param {string|Date} startDate - Start date
 * @param {string|Date} endDate - End date
 * @param {string} fieldName - Name of the date field (e.g., 'createdAt', 'paidDate', 'expenseDate')
 * @returns {Object} Sequelize where clause object with date filter
 */
const createDateFilterForField = (startDate, endDate, fieldName = 'createdAt') => {
  const dateFilter = createDateFilter(startDate, endDate);
  if (!dateFilter) {
    return {};
  }
  return {
    [fieldName]: dateFilter
  };
};

/**
 * Parses date filter from query parameters
 * @param {Object} query - Express request query object
 * @param {string} startParam - Name of start date parameter (default: 'startDate')
 * @param {string} endParam - Name of end date parameter (default: 'endDate')
 * @returns {Object|null} Date filter object or null
 */
const parseDateFilterFromQuery = (query, startParam = 'startDate', endParam = 'endDate') => {
  const startDate = query[startParam];
  const endDate = query[endParam];
  return createDateFilter(startDate, endDate);
};

module.exports = {
  createDateFilter,
  hasDateFilter,
  createDateFilterForField,
  parseDateFilterFromQuery
};
