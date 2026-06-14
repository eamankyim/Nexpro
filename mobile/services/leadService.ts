import { api } from './api';
import { buildScopedQueryString } from '@/utils/shopScope';

export type LeadListParams = {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  priority?: string;
  assignedTo?: string;
  source?: string;
  isActive?: string | boolean;
};

export const leadService = {
  getAll: async (params: LeadListParams = {}) => {
    const filteredParams = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== 'all')
    );
    const query = await buildScopedQueryString(filteredParams);
    const res = await api.get(query ? `/leads?${query}` : '/leads');
    return res.data;
  },

  getById: async (id: string) => {
    const res = await api.get(`/leads/${id}`);
    return res.data;
  },

  create: async (payload: Record<string, unknown>) => {
    const query = await buildScopedQueryString({});
    const res = await api.post(query ? `/leads?${query}` : '/leads', payload);
    return res.data;
  },

  update: async (id: string, payload: Record<string, unknown>) => {
    const query = await buildScopedQueryString({});
    const res = await api.put(query ? `/leads/${id}?${query}` : `/leads/${id}`, payload);
    return res.data;
  },

  addActivity: async (id: string, payload: Record<string, unknown>) => {
    const res = await api.post(`/leads/${id}/activities`, payload);
    return res.data;
  },

  convertToCustomer: async (id: string) => {
    const res = await api.post(`/leads/${id}/convert`);
    return res.data;
  },
};
