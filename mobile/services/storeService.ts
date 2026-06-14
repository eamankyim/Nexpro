import { api } from './api';
import { buildScopedQueryString } from '@/utils/shopScope';

type StoreParams = Record<string, string | number | boolean | undefined | null>;

async function buildQuery(params: StoreParams = {}): Promise<string> {
  return buildScopedQueryString(params);
}

export const storeService = {
  getSettings: async () => {
    const res = await api.get('/store/settings');
    return res.data;
  },

  updateSettings: async (payload: object) => {
    const res = await api.put('/store/settings', payload);
    return res.data;
  },

  getSetupStatus: async () => {
    const res = await api.get('/store/setup-status');
    return res.data;
  },

  getListings: async (params: StoreParams = {}) => {
    const query = await buildQuery(params);
    const res = await api.get(query ? `/store/listings?${query}` : '/store/listings');
    return res.data;
  },

  getOrders: async (params: StoreParams = {}) => {
    const query = await buildQuery(params);
    const res = await api.get(query ? `/store/orders?${query}` : '/store/orders');
    return res.data;
  },

  getOrderStats: async (params: StoreParams = {}) => {
    const query = await buildQuery(params);
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

  getTradeAssuranceDashboard: async (params: StoreParams = {}) => {
    const query = await buildQuery(params);
    const res = await api.get(
      query ? `/store/trade-assurance/dashboard?${query}` : '/store/trade-assurance/dashboard'
    );
    return res.data;
  },

  refundTradeAssuranceOrder: async (orderId: string, payload: object = {}) => {
    const res = await api.post(`/store/trade-assurance/orders/${orderId}/refund`, payload);
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
