import api from './api';

const expenseService = {
  /**
   * Get expense categories (business-type and shop-type specific + custom).
   * @returns {Promise<{ data: string[], custom: string[] }>} categories list and custom-only list
   */
  getCategories: async () => {
    const res = await api.get('/expenses/categories');
    return {
      data: Array.isArray(res?.data) ? res.data : [],
      custom: Array.isArray(res?.custom) ? res.custom : []
    };
  },

  /** Add a custom expense category for the current tenant */
  addCustomCategory: async (name) => {
    const res = await api.post('/expenses/categories', { name: String(name).trim() });
    return res;
  },

  /** Remove a custom expense category (query param name) */
  removeCustomCategory: async (name) => {
    const res = await api.delete('/expenses/categories', {
      params: { name: String(name).trim() }
    });
    return res;
  },

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
  },

  // Upload expense receipt (image or PDF)
  uploadReceipt: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post('/expenses/upload-receipt', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res?.data;
  }
};

export default expenseService;


