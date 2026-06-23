import { api } from './api';
import { buildScopedQueryString } from '@/utils/shopScope';

type DealerListParams = {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
};

export type DealerPayload = {
  businessName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  creditTerms?: string;
  creditLimit?: number;
  openingBalance?: number;
  notes?: string;
};

export type DealerPaymentPayload = {
  amount: number;
  paymentMethod: string;
  referenceNumber?: string;
  notes?: string;
};

const buildQueryString = (params: Record<string, unknown> = {}) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });
  return searchParams.toString();
};

export const dealerService = {
  getAll: async (params: DealerListParams = {}) => {
    const query = buildQueryString(params);
    const res = await api.get(query ? `/dealers?${query}` : '/dealers');
    return res.data;
  },

  getStats: async () => {
    const res = await api.get('/dealers/stats');
    return res.data?.data ?? res.data;
  },

  getById: async (id: string) => {
    const res = await api.get(`/dealers/${id}`);
    return res.data;
  },

  create: async (data: DealerPayload) => {
    const res = await api.post('/dealers', data);
    return res.data;
  },

  update: async (id: string, data: Partial<DealerPayload>) => {
    const res = await api.put(`/dealers/${id}`, data);
    return res.data;
  },

  patch: async (id: string, data: Partial<DealerPayload>) => {
    const res = await api.patch(`/dealers/${id}`, data);
    return res.data;
  },

  posSearch: async (params: { search?: string; limit?: number } = {}) => {
    const query = buildQueryString(params);
    const res = await api.get(query ? `/dealers/pos-search?${query}` : '/dealers/pos-search');
    return res.data;
  },

  getLedger: async (id: string, params: { page?: number; limit?: number; shopId?: string } = {}) => {
    const query = buildQueryString(params);
    const res = await api.get(query ? `/dealers/${id}/ledger?${query}` : `/dealers/${id}/ledger`);
    return res.data;
  },

  recordPayment: async (id: string, data: DealerPaymentPayload) => {
    const res = await api.post(`/dealers/${id}/payments`, data);
    return res.data;
  },

  getStatement: async (id: string, params: { startDate?: string; endDate?: string } = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) searchParams.append(key, String(value));
    });
    const qs = searchParams.toString();
    const res = await api.get(qs ? `/dealers/${id}/statement?${qs}` : `/dealers/${id}/statement`);
    return res.data;
  },
};
