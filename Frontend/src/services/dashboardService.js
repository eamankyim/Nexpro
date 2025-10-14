import api from './api';

const dashboardService = {
  // Get dashboard overview
  getOverview: async () => {
    return await api.get('/dashboard/overview');
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


