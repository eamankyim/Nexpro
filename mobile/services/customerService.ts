import { api } from './api';
import { buildScopedQueryString, withActiveShopScope } from '@/utils/shopScope';

type CustomerParams = {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  shopId?: string;
};

export type CustomerPayload = {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  address?: string;
  city?: string;
  state?: string;
  howDidYouHear?: string;
  referralName?: string;
};

export const customerService = {
  getCustomers: async (params: CustomerParams = {}) => {
    const query = await buildScopedQueryString(params);
    const res = await api.get(query ? `/customers?${query}` : '/customers');
    // Backend returns: { success: true, count: N, pagination: {...}, data: [...] }
    // Mobile api returns full axios response, so res.data = { success: true, count: N, pagination: {...}, data: [...] }
    return res.data;
  },

  getStats: async () => {
    const query = await buildScopedQueryString({});
    const res = await api.get(query ? `/customers/stats?${query}` : '/customers/stats');
    return res.data?.data ?? res.data;
  },

  getCustomerById: async (id: string) => {
    const res = await api.get(`/customers/${id}`);
    // Backend returns: { success: true, data: {...} }
    return res.data;
  },

  createCustomer: async (data: CustomerPayload) => {
    const scoped = await withActiveShopScope(data);
    const res = await api.post('/customers', scoped);
    // Backend returns: { success: true, data: {...} }
    return res.data;
  },

  updateCustomer: async (id: string, data: Partial<CustomerPayload>) => {
    const res = await api.put(`/customers/${id}`, data);
    // Backend returns: { success: true, data: {...} }
    return res.data;
  },

  findOrCreate: async (phone: string, name?: string) => {
    const res = await api.post('/customers/find-or-create', { phone, name });
    // Backend returns: { success: true, data: {...} }
    return res.data;
  },
};
