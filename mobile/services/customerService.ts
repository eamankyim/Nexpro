import { api } from './api';

type CustomerParams = {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
};

export const customerService = {
  getCustomers: async (params: CustomerParams = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      searchParams.append(key, String(value));
    });
    const query = searchParams.toString();
    const res = await api.get(query ? `/customers?${query}` : '/customers');
    // Backend returns: { success: true, count: N, pagination: {...}, data: [...] }
    // Mobile api returns full axios response, so res.data = { success: true, count: N, pagination: {...}, data: [...] }
    return res.data;
  },

  getCustomerById: async (id: string) => {
    const res = await api.get(`/customers/${id}`);
    // Backend returns: { success: true, data: {...} }
    return res.data;
  },

  createCustomer: async (data: {
    name: string;
    email: string;
    phone?: string;
    company?: string;
    address?: string;
  }) => {
    const res = await api.post('/customers', data);
    // Backend returns: { success: true, data: {...} }
    return res.data;
  },

  updateCustomer: async (id: string, data: object) => {
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
