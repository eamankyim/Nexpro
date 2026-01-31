import api from './api';

const customerService = {
  // Get all customers
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return await api.get(`/customers?${queryString}`);
  },

  // Get all customers (alias for getAll, used by POS)
  getCustomers: async (params = {}) => {
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
  },

  /**
   * Find customer by phone or create new one if not found
   * Used for quick customer creation during POS checkout
   * 
   * @param {string} phone - Customer phone number (required)
   * @param {string} [name] - Customer name (optional)
   * @returns {Promise<Object>} - Customer object (existing or newly created)
   */
  findOrCreate: async (phone, name) => {
    return await api.post('/customers/find-or-create', { phone, name });
  }
};

export default customerService;


