import api from './api';

const leadService = {
  getAll: async (params = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '' || value === 'all') return;
      searchParams.append(key, value);
    });
    const query = searchParams.toString();
    return api.get(query ? `/leads?${query}` : '/leads');
  },

  getSummary: async () => api.get('/leads/summary'),

  getById: async (id) => api.get(`/leads/${id}`),

  create: async (payload) => api.post('/leads', payload),

  update: async (id, payload) => api.put(`/leads/${id}`, payload),

  archive: async (id) => api.delete(`/leads/${id}`),

  addActivity: async (id, payload) => api.post(`/leads/${id}/activities`, payload),

  getActivities: async (id) => api.get(`/leads/${id}/activities`),

  convert: async (id, payload = {}) => api.post(`/leads/${id}/convert`, payload)
};

export default leadService;




