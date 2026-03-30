import api from './api';

const quoteService = {
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `/quotes?${queryString}` : '/quotes';
    return await api.get(url, {
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache'
      }
    });
  },

  getById: async (id) => {
    return await api.get(`/quotes/${id}`);
  },

  create: async (quoteData) => {
    return await api.post('/quotes', quoteData);
  },

  update: async (id, quoteData) => {
    return await api.put(`/quotes/${id}`, quoteData);
  },

  updateStatus: async (id, status) => {
    return await api.patch(`/quotes/${id}/status`, { status });
  },

  delete: async (id) => {
    return await api.delete(`/quotes/${id}`);
  },

  convertToJob: async (id, jobData = {}) => {
    return await api.post(`/quotes/${id}/convert`, jobData);
  },

  convertToSale: async (id, paymentMethod = 'credit', shopId = null) => {
    return await api.post(`/quotes/${id}/convert-to-sale`, {
      paymentMethod,
      shopId
    });
  },

  // Get quote activities
  getActivities: async (quoteId) => {
    return await api.get(`/quotes/${quoteId}/activities`);
  },

  // Add quote activity
  addActivity: async (quoteId, activityData) => {
    return await api.post(`/quotes/${quoteId}/activities`, activityData);
  }
};

export default quoteService;



