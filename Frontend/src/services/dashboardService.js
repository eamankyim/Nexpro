import api from './api';

const dashboardService = {
  // Get dashboard overview (optionally includes comparison when filterType provided)
  getOverview: async (startDate = null, endDate = null, filterType = null) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (filterType) params.append('filterType', filterType);

    const queryString = params.toString();
    const url = queryString ? `/dashboard/overview?${queryString}` : '/dashboard/overview';
    return await api.get(url);
  },

  // Get revenue by month
  getRevenueByMonth: async (year) => {
    const params = year ? `?year=${year}` : '';
    return await api.get(`/dashboard/revenue-by-month${params}`);
  },

  // Get expenses by category
  getExpensesByCategory: async () => {
    return await api.get('/dashboard/expenses-by-category');
  },

  // Get top customers
  getTopCustomers: async (limit = 10) => {
    return await api.get(`/dashboard/top-customers?limit=${limit}`);
  },

  // Get job status distribution
  getJobStatusDistribution: async () => {
    return await api.get('/dashboard/job-status-distribution');
  }
};

export default dashboardService;


