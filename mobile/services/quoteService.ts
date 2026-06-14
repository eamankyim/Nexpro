import { api } from './api';
import { buildScopedQueryString } from '@/utils/shopScope';

type QuoteParams = {
  page?: number;
  limit?: number;
  status?: string;
  customerId?: string;
  search?: string;
};

export const quoteService = {
  getQuotes: async (params: QuoteParams = {}) => {
    const query = await buildScopedQueryString(params);
    const res = await api.get(query ? `/quotes?${query}` : '/quotes');
    return res.data;
  },

  getQuoteById: async (id: string) => {
    const res = await api.get(`/quotes/${id}`);
    return res.data;
  },

  createQuote: async (data: object) => {
    const query = await buildScopedQueryString({});
    const res = await api.post(query ? `/quotes?${query}` : '/quotes', data);
    return res.data;
  },

  updateQuote: async (id: string, data: object) => {
    const query = await buildScopedQueryString({});
    const res = await api.put(query ? `/quotes/${id}?${query}` : `/quotes/${id}`, data);
    return res.data;
  },

  updateStatus: async (id: string, status: string) => {
    const res = await api.patch(`/quotes/${id}/status`, { status });
    return res.data;
  },

  convertToJob: async (id: string) => {
    const res = await api.post(`/quotes/${id}/convert`);
    return res.data;
  },

  convertToSale: async (id: string, payload: { paymentMethod?: string; shopId?: string | null } = {}) => {
    const res = await api.post(`/quotes/${id}/convert-to-sale`, {
      paymentMethod: payload.paymentMethod || 'credit',
      shopId: payload.shopId || null,
    });
    return res.data;
  },

  deleteQuote: async (id: string) => {
    const res = await api.delete(`/quotes/${id}`);
    return res.data;
  },
};
