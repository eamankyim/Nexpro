import api from './api';
import { buildScopedQueryString } from '../utils/shopScope';

const vendorService = {
  // Get vendor categories (business-type and shop-type specific)
  getCategories: async () => {
    const res = await api.get('/vendors/categories');
    return res?.data ?? [];
  },

  // Get all vendors
  getAll: async (params = {}) => {
    const queryString = buildScopedQueryString(params);
    return await api.get(queryString ? `/vendors?${queryString}` : '/vendors');
  },

  getVendors: async (params = {}) => vendorService.getAll(params),

  // Get single vendor
  getById: async (id) => {
    return await api.get(`/vendors/${id}`);
  },

  // Create vendor
  create: async (vendorData) => {
    return await api.post('/vendors', vendorData);
  },

  // Update vendor
  update: async (id, vendorData) => {
    return await api.put(`/vendors/${id}`, vendorData);
  },

  // Delete vendor
  delete: async (id) => {
    return await api.delete(`/vendors/${id}`);
  }
};

export default vendorService;


