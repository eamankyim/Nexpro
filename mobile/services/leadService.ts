import { api } from './api';

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
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '' || value === 'all') return;
      searchParams.append(key, String(value));
    });
    const query = searchParams.toString();
    const res = await api.get(query ? `/leads?${query}` : '/leads');
    return res.data;
  },

  getById: async (id: string) => {
    const res = await api.get(`/leads/${id}`);
    return res.data;
  },

  create: async (payload: Record<string, unknown>) => {
    const res = await api.post('/leads', payload);
    return res.data;
  },

  update: async (id: string, payload: Record<string, unknown>) => {
    const res = await api.put(`/leads/${id}`, payload);
    return res.data;
  },

  addActivity: async (id: string, payload: Record<string, unknown>) => {
    const res = await api.post(`/leads/${id}/activities`, payload);
    return res.data;
  },
};
