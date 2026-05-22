import api from './api';

const studioLocationService = {
  getAccess: async () => {
    const response = await api.get('/studio-locations/access');
    return response?.data || response;
  },

  getAll: async (params = {}) => {
    const response = await api.get('/studio-locations', { params });
    return response;
  },

  getById: async (id) => {
    const response = await api.get(`/studio-locations/${id}`);
    return response?.data || response;
  },

  create: async (payload) => {
    const response = await api.post('/studio-locations', payload);
    return response?.data || response;
  },

  update: async (id, payload) => {
    const response = await api.put(`/studio-locations/${id}`, payload);
    return response?.data || response;
  },

  remove: async (id) => {
    const response = await api.delete(`/studio-locations/${id}`);
    return response;
  },

  getUserAssignments: async (userId) => {
    const response = await api.get(`/studio-locations/users/${userId}/assignments`);
    return response?.data || response;
  },

  setUserAssignments: async (userId, studioLocationIds) => {
    const response = await api.put(`/studio-locations/users/${userId}/assignments`, {
      studioLocationIds,
    });
    return response?.data || response;
  },

  uploadLogo: async (id, file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`/studio-locations/${id}/logo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response?.data || response;
  },
};

export default studioLocationService;
