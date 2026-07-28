import { api } from './api';
import { buildScopedQueryString } from '@/utils/shopScope';

type StoreParams = Record<string, string | number | boolean | undefined | null>;

/** ABS Online Store (direct-pay). Distinct from Sabito marketplace. */
export const ONLINE_STORE_COMMERCE_CHANNEL = 'online_store' as const;

async function buildQuery(params: StoreParams = {}): Promise<string> {
  return buildScopedQueryString(params);
}

/**
 * Online Store order list/stats always scope to a commerce channel so Sabito
 * marketplace rows cannot mix into Online Store surfaces (and vice versa).
 */
function withOnlineStoreChannel(params: StoreParams = {}): StoreParams {
  const hasChannel = params.commerceChannel != null && params.commerceChannel !== '';
  return {
    ...params,
    commerceChannel: hasChannel ? params.commerceChannel : ONLINE_STORE_COMMERCE_CHANNEL,
  };
}

export const storeService = {
  getSettings: async () => {
    const res = await api.get('/store/settings');
    return res.data;
  },

  updateSettings: async (payload: object) => {
    const body = { ...payload } as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(body, 'currency') && body.currency != null) {
      body.currency = String(body.currency).trim().toUpperCase() || 'GHS';
    }
    const res = await api.put('/store/settings', body);
    return res.data;
  },

  getSetupStatus: async () => {
    const res = await api.get('/store/setup-status');
    return res.data;
  },

  checkSlugAvailability: async (slug: string) => {
    const res = await api.get(`/store/slug-availability?slug=${encodeURIComponent(slug || '')}`);
    return res.data;
  },

  createOrUpdateProductListing: async (productId: string, payload: object) => {
    const res = await api.post(`/products/${productId}/store-listing`, payload);
    return res.data;
  },

  uploadListingImages: async (uri: string, mimeType = 'image/jpeg', fileName?: string | null) => {
    const formData = new FormData();
    const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
    formData.append('files', {
      uri,
      name: fileName || `listing.${ext}`,
      type: mimeType,
    } as unknown as Blob);
    const query = await buildQuery();
    const res = await api.post(
      query ? `/store/listings/upload-images?${query}` : '/store/listings/upload-images',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      }
    );
    return res.data;
  },

  uploadStoreAsset: async (uri: string, mimeType = 'image/jpeg', fileName?: string | null) => {
    const result = await storeService.uploadListingImages(uri, mimeType, fileName);
    const imageUrls =
      (result as { data?: { imageUrls?: string[] }; imageUrls?: string[] })?.data?.imageUrls ||
      (result as { imageUrls?: string[] })?.imageUrls ||
      [];
    return imageUrls[0] || '';
  },

  getListings: async (params: StoreParams = {}) => {
    const query = await buildQuery(params);
    const res = await api.get(query ? `/store/listings?${query}` : '/store/listings');
    return res.data;
  },

  getOrders: async (params: StoreParams = {}) => {
    const query = await buildQuery(withOnlineStoreChannel(params));
    const res = await api.get(query ? `/store/orders?${query}` : '/store/orders');
    return res.data;
  },

  getOrderStats: async (params: StoreParams = {}) => {
    const query = await buildQuery(withOnlineStoreChannel(params));
    const res = await api.get(query ? `/store/orders/stats?${query}` : '/store/orders/stats');
    return res.data;
  },

  getOrderById: async (id: string) => {
    const res = await api.get(`/store/orders/${id}`);
    return res.data;
  },

  updateOrderStatus: async (id: string, status: string, payload: object = {}) => {
    const res = await api.patch(`/store/orders/${id}/status`, { ...payload, status });
    return res.data;
  },

  publishListing: async (id: string) => {
    const res = await api.patch(`/store/listings/${id}/publish`);
    return res.data;
  },

  unpublishListing: async (id: string) => {
    const res = await api.patch(`/store/listings/${id}/unpublish`);
    return res.data;
  },

  getServiceListings: async (params: StoreParams = {}) => {
    const query = await buildQuery(params);
    const res = await api.get(query ? `/store/service-listings?${query}` : '/store/service-listings');
    return res.data;
  },

  publishServiceListing: async (id: string) => {
    const res = await api.patch(`/store/service-listings/${id}/publish`);
    return res.data;
  },

  unpublishServiceListing: async (id: string) => {
    const res = await api.patch(`/store/service-listings/${id}/unpublish`);
    return res.data;
  },
};
