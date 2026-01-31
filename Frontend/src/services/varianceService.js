import api from './api';

/**
 * Variance Detection Service
 * Handles revenue leakage and shrinkage detection API calls
 */
const varianceService = {
  /**
   * Get dashboard summary of variance/leakage metrics
   * @param {string} shopId - Optional shop filter
   * @returns {Promise} Dashboard summary with risk level
   */
  getDashboardSummary: async (shopId = null) => {
    const params = shopId ? `?shopId=${shopId}` : '';
    return api.get(`/variance/dashboard${params}`);
  },

  /**
   * Get stock variance report
   * @param {Object} params - Query parameters
   * @param {string} params.shopId - Filter by shop
   * @param {number} params.threshold - Variance threshold percentage (default: 5)
   * @param {number} params.daysBack - Days to analyze (default: 30)
   * @returns {Promise} Stock variance data
   */
  getStockVariance: async (params = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, value);
      }
    });
    const query = searchParams.toString();
    return api.get(query ? `/variance/stock?${query}` : '/variance/stock');
  },

  /**
   * Get suspicious patterns report
   * @param {Object} params - Query parameters
   * @param {string} params.shopId - Filter by shop
   * @param {number} params.daysBack - Days to analyze (default: 7)
   * @returns {Promise} Suspicious patterns data
   */
  getSuspiciousPatterns: async (params = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, value);
      }
    });
    const query = searchParams.toString();
    return api.get(query ? `/variance/patterns?${query}` : '/variance/patterns');
  },

  /**
   * Get comprehensive revenue leakage report
   * @param {Object} params - Query parameters
   * @param {string} params.shopId - Filter by shop
   * @param {number} params.daysBack - Days to analyze (default: 30)
   * @returns {Promise} Full leakage report with recommendations
   */
  getLeakageReport: async (params = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, value);
      }
    });
    const query = searchParams.toString();
    return api.get(query ? `/variance/leakage-report?${query}` : '/variance/leakage-report');
  },

  /**
   * Run variance detection and create alerts
   * @param {Object} payload - Detection parameters
   * @param {string} payload.shopId - Optional shop filter
   * @param {number} payload.threshold - Variance threshold
   * @param {number} payload.daysBack - Days to analyze
   * @returns {Promise} Detection results with alerts created
   */
  runDetection: async (payload = {}) => {
    return api.post('/variance/detect', payload);
  },

  /**
   * Get risk level color
   * @param {string} level - Risk level (high, medium, low)
   * @returns {Object} Color configuration
   */
  getRiskLevelColor: (level) => {
    const colors = {
      high: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
      medium: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
      low: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' }
    };
    return colors[level] || colors.low;
  },

  /**
   * Format variance type for display
   * @param {string} type - Variance type
   * @returns {string} Formatted display text
   */
  formatVarianceType: (type) => {
    const types = {
      shrinkage: 'Stock Shrinkage (Loss)',
      overage: 'Stock Overage (Excess)',
      match: 'Matched',
      uncounted: 'Not Counted'
    };
    return types[type] || type;
  },

  /**
   * Format alert type for display
   * @param {string} type - Alert type
   * @returns {string} Formatted display text
   */
  formatAlertType: (type) => {
    const types = {
      high_cancel_rate: 'High Cancellation Rate',
      high_refund_rate: 'High Refund Rate',
      high_discount_average: 'High Average Discount',
      off_hours_sales: 'Off-Hours Transactions',
      high_cash_ratio: 'High Cash Transaction Ratio'
    };
    return types[type] || type;
  }
};

export default varianceService;
