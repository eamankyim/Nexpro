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

  // Update expense
  update: async (id, expenseData) => {
    return await api.put(`/expenses/${id}`, expenseData);
  },

  // Delete expense
  delete: async (id) => {
    return await api.delete(`/expenses/${id}`);
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
  }
};

export default expenseService;


