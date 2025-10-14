import api from './api';

const vendorPriceListService = {
  // Get all price list items for a vendor
  getAll: async (vendorId) => {
    return await api.get(`/vendors/${vendorId}/price-list`);
  },

  // Create price list item
  create: async (vendorId, itemData) => {
    return await api.post(`/vendors/${vendorId}/price-list`, itemData);
  },

  // Update price list item
  update: async (vendorId, itemId, itemData) => {
    return await api.put(`/vendors/${vendorId}/price-list/${itemId}`, itemData);
  },

  // Delete price list item
  delete: async (vendorId, itemId) => {
    return await api.delete(`/vendors/${vendorId}/price-list/${itemId}`);
  }
};

export default vendorPriceListService;




