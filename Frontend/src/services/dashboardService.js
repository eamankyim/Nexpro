import api from './api';
import { buildScopedQueryString } from '../utils/shopScope';

const scopedGet = (path, params = {}) => {
  const queryString = buildScopedQueryString(params);
  return api.get(queryString ? `${path}?${queryString}` : path);
};

const dashboardService = {
  // Get dashboard overview (optionally includes comparison when filterType provided)
  getOverview: async (startDate = null, endDate = null, filterType = null) => {
    const params = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (filterType) params.filterType = filterType;
    return scopedGet('/dashboard/overview', params);
  },

  // Get revenue by month
  getRevenueByMonth: async (year) => {
    return scopedGet('/dashboard/revenue-by-month', year ? { year } : {});
  },

  // Get expenses by category
  getExpensesByCategory: async () => {
    return scopedGet('/dashboard/expenses-by-category');
  },

  // Get top customers
  getTopCustomers: async (limit = 10) => {
    return scopedGet('/dashboard/top-customers', { limit });
  },

  // Get job status distribution
  getJobStatusDistribution: async () => {
    return scopedGet('/dashboard/job-status-distribution');
  }
};

export default dashboardService;


