import api from './api';

const customerService = {
  // Get all customers
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return await api.get(`/customers?${queryString}`);
  },

  // Get single customer
  getById: async (id) => {
    return await api.get(`/customers/${id}`);
  },

  // Create customer
  create: async (customerData) => {
    return await api.post('/customers', customerData);
  },

  // Update customer
  update: async (id, customerData) => {
    return await api.put(`/customers/${id}`, customerData);
  },

  // Delete customer
  delete: async (id) => {
    return await api.delete(`/customers/${id}`);
  }
};

export default customerService;


