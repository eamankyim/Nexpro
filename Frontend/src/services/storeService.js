import api from './api';
import { buildScopedQueryString, withActiveShopScope } from '../utils/shopScope';

const buildQuery = (params = {}) => {
  const searchParams = new URLSearchParams();
  Object.entries(withActiveShopScope(params)).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    searchParams.append(key, value);
  });
  return searchParams.toString();
};

const storeService = {
  getSettings: async () => api.get('/store/settings'),

  updateSettings: async (payload) => api.put('/store/settings', payload),

  getSetupStatus: async () => api.get('/store/setup-status'),

  getPublicStore: async (slug) => api.get(`/public/store/${encodeURIComponent(slug || '')}`),

  getPublicStoreProducts: async (slug) => api.get(`/public/store/${encodeURIComponent(slug || '')}/products`),

  checkSlugAvailability: async (slug) => api.get(`/store/slug-availability?slug=${encodeURIComponent(slug || '')}`),

  getListings: async (params = {}) => {
    const query = buildQuery(params);
    return api.get(query ? `/store/listings?${query}` : '/store/listings');
  },

  getOrders: async (params = {}) => {
    const query = buildQuery(params);
    return api.get(query ? `/store/orders?${query}` : '/store/orders');
  },

  getOrderStats: async (params = {}) => {
    const query = buildQuery(params);
    return api.get(query ? `/store/orders/stats?${query}` : '/store/orders/stats');
  },

  getOrderById: async (id) => api.get(`/store/orders/${id}`),

  getOrder: async (id) => api.get(`/store/orders/${id}`),

  updateOrderStatus: async (id, status) => (
    api.patch(`/store/orders/${id}/status`, { status })
  ),

  createListing: async (payload) => api.post('/store/listings', payload),

  updateListing: async (id, payload) => api.patch(`/store/listings/${id}`, payload),

  getListingForProduct: async (productId) => {
    const query = buildQuery({ productId, limit: 1 });
    const response = await api.get(`/store/listings?${query}`);
    const body = response?.data ? response : response || {};
    const listings = Array.isArray(body.data) ? body.data : [];
    return listings[0] || null;
  },

  deleteListing: async (id) => api.delete(`/store/listings/${id}`),

  publishListing: async (id) => api.patch(`/store/listings/${id}/publish`),

  unpublishListing: async (id) => api.patch(`/store/listings/${id}/unpublish`),

  createOrUpdateProductListing: async (productId, payload) => (
    api.post(`/products/${productId}/store-listing`, payload)
  ),

  uploadListingImages: async (files) => {
    const formData = new FormData();
    Array.from(files || []).slice(0, 5).forEach((file) => formData.append('files', file));
    const query = buildScopedQueryString();
    const response = await api.post(`/store/listings/upload-images${query ? `?${query}` : ''}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response?.data ?? response;
  },

  uploadStoreAsset: async (file) => {
    const result = await storeService.uploadListingImages(file ? [file] : []);
    const imageUrls = result?.data?.imageUrls || result?.imageUrls || [];
    return imageUrls[0] || '';
  },
};

export default storeService;
