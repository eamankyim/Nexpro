import api from './api';
import { buildScopedQueryString } from '../utils/shopScope';

const pricingService = {
  // Get all pricing templates
  getAll: async (params = {}) => {
    const queryString = buildScopedQueryString(params);
    return await api.get(queryString ? `/pricing?${queryString}` : '/pricing');
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
  },

  getPublicPlans: async (channel = '') => {
    const params = channel ? { channel } : undefined;
    const response = await api.get('/public/pricing', { params });
    return response.data;
  }
};

export default pricingService;


