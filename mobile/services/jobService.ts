import { api } from './api';

type JobParams = {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
};

export const jobService = {
  getJobs: async (params: JobParams = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      searchParams.append(key, String(value));
    });
    const query = searchParams.toString();
    const res = await api.get(query ? `/jobs?${query}` : '/jobs');
    // Backend returns: { success: true, count: N, pagination: {...}, data: [...] }
    return res.data;
  },

  getJobById: async (id: string) => {
    const res = await api.get(`/jobs/${id}`);
    // Backend returns: { success: true, data: {...} }
    return res.data;
  },

  createJob: async (data: {
    customerId: string;
    title: string;
    description?: string;
    dueDate?: string;
    status?: string;
  }) => {
    const res = await api.post('/jobs', data);
    // Backend returns: { success: true, data: {...} }
    return res.data;
  },

  updateJob: async (id: string, data: object) => {
    const res = await api.put(`/jobs/${id}`, data);
    // Backend returns: { success: true, data: {...} }
    return res.data;
  },
};
