import api from './api';

const paymentService = {
  // Get all payments
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return await api.get(`/payments?${queryString}`);
  },

  // Get single payment
  getById: async (id) => {
    return await api.get(`/payments/${id}`);
  },

  // Create payment
  create: async (paymentData) => {
    return await api.post('/payments', paymentData);
  },

  // Update payment
  update: async (id, paymentData) => {
    return await api.put(`/payments/${id}`, paymentData);
  },

  // Delete payment
  delete: async (id) => {
    return await api.delete(`/payments/${id}`);
  },

  // Get payment statistics
  getStats: async () => {
    return await api.get('/payments/stats/overview');
  }
};

export default paymentService;


