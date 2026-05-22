import api from './api';

const shopService = {
  getAccess: async () => {
    const response = await api.get('/shops/access');
    return response?.data || response;
  },

  getAll: async (params = {}) => {
    const response = await api.get('/shops', { params });
    return response;
  },

  getById: async (id) => {
    const response = await api.get(`/shops/${id}`);
    return response?.data || response;
  },

  create: async (payload) => {
    const response = await api.post('/shops', payload);
    return response?.data || response;
  },

  update: async (id, payload) => {
    const response = await api.put(`/shops/${id}`, payload);
    return response?.data || response;
  },

  remove: async (id) => {
    const response = await api.delete(`/shops/${id}`);
    return response;
  },

  getUserAssignments: async (userId) => {
    const response = await api.get(`/shops/users/${userId}/assignments`);
    return response?.data || response;
  },

  setUserAssignments: async (userId, shopIds) => {
    const response = await api.put(`/shops/users/${userId}/assignments`, { shopIds });
    return response?.data || response;
  },

  uploadLogo: async (id, file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`/shops/${id}/logo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response?.data || response;
  },
};

export default shopService;
