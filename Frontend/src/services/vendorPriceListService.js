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
  },

  // Upload image for price list item
  uploadImage: async (vendorId, itemId, file) => {
    console.log('[Frontend] Starting image upload...');
    console.log('[Frontend] Vendor ID:', vendorId);
    console.log('[Frontend] Item ID:', itemId);
    console.log('[Frontend] File info:', {
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified
    });
    
    const formData = new FormData();
    formData.append('file', file);
    
    console.log('[Frontend] FormData created, sending request...');
    try {
      const response = await api.post(`/vendors/${vendorId}/price-list/${itemId}/image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      console.log('[Frontend] ✅ Upload successful:', response);
      return response;
    } catch (error) {
      console.error('[Frontend] ❌ Upload failed:', error);
      console.error('[Frontend] Error response:', error.response);
      console.error('[Frontend] Error message:', error.message);
      throw error;
    }
  }
};

export default vendorPriceListService;









