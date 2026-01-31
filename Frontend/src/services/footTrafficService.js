import api from './api';

/**
 * Foot Traffic Service
 * Handles customer traffic/foot traffic tracking API calls
 */
const footTrafficService = {
  /**
   * Get all foot traffic records
   * @param {Object} params - Query parameters
   * @param {number} params.page - Page number
   * @param {number} params.limit - Items per page
   * @param {string} params.shopId - Filter by shop
   * @param {string} params.startDate - Filter start date
   * @param {string} params.endDate - Filter end date
   * @param {string} params.entryMethod - Filter by entry method
   * @param {string} params.periodType - Filter by period type
   * @returns {Promise} API response
   */
  getFootTraffic: async (params = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      searchParams.append(key, value);
    });
    const query = searchParams.toString();
    return api.get(query ? `/foot-traffic?${query}` : '/foot-traffic');
  },

  /**
   * Get foot traffic analytics
   * @param {Object} params - Query parameters
   * @param {string} params.shopId - Filter by shop
   * @param {string} params.startDate - Analytics start date
   * @param {string} params.endDate - Analytics end date
   * @param {string} params.groupBy - Group by: hour, day, week, month
   * @returns {Promise} API response with analytics data
   */
  getAnalytics: async (params = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      searchParams.append(key, value);
    });
    const query = searchParams.toString();
    return api.get(query ? `/foot-traffic/analytics?${query}` : '/foot-traffic/analytics');
  },

  /**
   * Get today's traffic summary
   * @param {string} shopId - Optional shop filter
   * @returns {Promise} API response with today's summary
   */
  getTodaySummary: async (shopId = null) => {
    const params = shopId ? `?shopId=${shopId}` : '';
    return api.get(`/foot-traffic/today${params}`);
  },

  /**
   * Get foot traffic record by ID
   * @param {string} id - Record ID
   * @returns {Promise} API response
   */
  getFootTrafficById: async (id) => {
    return api.get(`/foot-traffic/${id}`);
  },

  /**
   * Create a new foot traffic record (manual entry)
   * @param {Object} payload - Traffic data
   * @param {string} payload.shopId - Shop ID
   * @param {number} payload.visitorCount - Number of visitors
   * @param {string} payload.periodStart - Period start datetime
   * @param {string} payload.periodEnd - Period end datetime
   * @param {string} payload.entryMethod - Entry method (manual, iot_counter, camera, mobile_checkin)
   * @param {string} payload.periodType - Period type (hourly, daily, custom)
   * @param {number} payload.purchaseCount - Optional purchase count
   * @param {number} payload.periodRevenue - Optional revenue
   * @param {string} payload.weather - Optional weather condition
   * @param {string} payload.notes - Optional notes
   * @returns {Promise} API response
   */
  createFootTraffic: async (payload) => {
    return api.post('/foot-traffic', payload);
  },

  /**
   * Bulk create foot traffic records (for IoT devices)
   * @param {Array} records - Array of traffic records
   * @returns {Promise} API response
   */
  bulkCreateFootTraffic: async (records) => {
    return api.post('/foot-traffic/bulk', { records });
  },

  /**
   * Update foot traffic record
   * @param {string} id - Record ID
   * @param {Object} payload - Updated data
   * @returns {Promise} API response
   */
  updateFootTraffic: async (id, payload) => {
    return api.put(`/foot-traffic/${id}`, payload);
  },

  /**
   * Delete foot traffic record
   * @param {string} id - Record ID
   * @returns {Promise} API response
   */
  deleteFootTraffic: async (id) => {
    return api.delete(`/foot-traffic/${id}`);
  },

  /**
   * Record a customer check-in
   * @param {string} shopId - Optional shop ID
   * @returns {Promise} API response with today's count
   */
  recordCheckIn: async (shopId = null) => {
    return api.post('/foot-traffic/checkin', { shopId });
  }
};

export default footTrafficService;
