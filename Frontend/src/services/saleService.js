import api from './api';

const saleService = {
  // Get all sales
  getSales: async (params = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      searchParams.append(key, value);
    });
    const query = searchParams.toString();
    return api.get(query ? `/sales?${query}` : '/sales');
  },

  // Get sale by ID
  getSaleById: async (id) => {
    return api.get(`/sales/${id}`);
  },

  // Create a new sale
  createSale: async (payload) => {
    return api.post('/sales', payload);
  },

  // Update a sale
  updateSale: async (id, payload) => {
    return api.put(`/sales/${id}`, payload);
  },

  // Delete a sale
  deleteSale: async (id) => {
    return api.delete(`/sales/${id}`);
  },

  // Get sales statistics
  getSalesStats: async (startDate = null, endDate = null) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const query = params.toString();
    return api.get(query ? `/sales/stats?${query}` : '/sales/stats');
  },

  // Get top selling products
  getTopProducts: async (limit = 10, startDate = null, endDate = null) => {
    const params = new URLSearchParams();
    params.append('limit', limit);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return api.get(`/sales/top-products?${params.toString()}`);
  },

  // Get sale activities
  getActivities: async (saleId) => {
    return api.get(`/sales/${saleId}/activities`);
  },

  // Add sale activity
  addActivity: async (saleId, activityData) => {
    return api.post(`/sales/${saleId}/activities`, activityData);
  },

  // Send receipt via SMS/WhatsApp/Email
  sendReceipt: async (saleId, { channels, phone, email }) => {
    return api.post(`/sales/${saleId}/send-receipt`, { channels, phone, email });
  }
};

export default saleService;
