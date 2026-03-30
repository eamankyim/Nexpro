import { api } from './api';

type QuoteParams = {
  page?: number;
  limit?: number;
  status?: string;
  customerId?: string;
  search?: string;
};

export const quoteService = {
  getQuotes: async (params: QuoteParams = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      searchParams.append(key, String(value));
    });
    const query = searchParams.toString();
    const res = await api.get(query ? `/quotes?${query}` : '/quotes');
    return res.data;
  },

  getQuoteById: async (id: string) => {
    const res = await api.get(`/quotes/${id}`);
    return res.data;
  },

  createQuote: async (data: object) => {
    const res = await api.post('/quotes', data);
    return res.data;
  },

  updateQuote: async (id: string, data: object) => {
    const res = await api.put(`/quotes/${id}`, data);
    return res.data;
  },

  convertToJob: async (id: string) => {
    const res = await api.post(`/quotes/${id}/convert`);
    return res.data;
  },
};
