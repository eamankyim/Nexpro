import api from './api';

const pricingService = {
  // Get all pricing templates
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return await api.get(`/pricing?${queryString}`);
  },

  // Get single pricing template
  getById: async (id) => {
    return await api.get(`/pricing/${id}`);
  },

  // Create pricing template
  create: async (pricingData) => {
    return await api.post('/pricing', pricingData);
  },

  // Update pricing template
  update: async (id, pricingData) => {
    return await api.put(`/pricing/${id}`, pricingData);
  },

  // Delete pricing template
  delete: async (id) => {
    return await api.delete(`/pricing/${id}`);
  },

  // Calculate price
  calculatePrice: async (jobDetails) => {
    return await api.post('/pricing/calculate', jobDetails);
  }
};

export default pricingService;


