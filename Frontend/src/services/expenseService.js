import api from './api';

const expenseService = {
  // Get all expenses
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return await api.get(`/expenses?${queryString}`);
  },

  // Get single expense
  getById: async (id) => {
    return await api.get(`/expenses/${id}`);
  },

  // Create expense
  create: async (expenseData) => {
    return await api.post('/expenses', expenseData);
  },

  // Create multiple expenses (bulk)
  createBulk: async (expenses, commonFields) => {
    return await api.post('/expenses/bulk', { expenses, commonFields });
  },

  // Update expense
  update: async (id, expenseData) => {
    return await api.put(`/expenses/${id}`, expenseData);
  },

  // Archive expense
  archive: async (id) => {
    return await api.put(`/expenses/${id}/archive`);
  },

  // Mark expense as paid
  markPaid: async (id) => {
    return await api.put(`/expenses/${id}`, { status: 'paid' });
  },

  // Get expense statistics
  getStats: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return await api.get(`/expenses/stats/overview?${queryString}`);
  },

  // Get expenses by job
  getByJob: async (jobId, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return await api.get(`/expenses/by-job/${jobId}?${queryString}`);
  },

  // Submit expense for approval
  submit: async (id) => {
    return await api.post(`/expenses/${id}/submit`);
  },

  // Approve expense
  approve: async (id) => {
    return await api.post(`/expenses/${id}/approve`);
  },

  // Reject expense
  reject: async (id, rejectionReason) => {
    return await api.post(`/expenses/${id}/reject`, { rejectionReason });
  },

  // Get expense activities
  getActivities: async (id) => {
    return await api.get(`/expenses/${id}/activities`);
  },

  // Add expense activity
  addActivity: async (id, activityData) => {
    return await api.post(`/expenses/${id}/activities`, activityData);
  }
};

export default expenseService;


