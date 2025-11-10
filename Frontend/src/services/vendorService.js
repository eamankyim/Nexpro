import api from './api';

const vendorService = {
  // Get all vendors
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return await api.get(`/vendors?${queryString}`);
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


