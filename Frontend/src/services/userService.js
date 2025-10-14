import api from './api';

const userService = {
  // Get all users
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return await api.get(`/users?${queryString}`);
  },

  // Get single user
  getById: async (id) => {
    return await api.get(`/users/${id}`);
  },

  // Create user
  create: async (userData) => {
    return await api.post('/users', userData);
  },

  // Update user
  update: async (id, userData) => {
    return await api.put(`/users/${id}`, userData);
  },

  // Delete user
  delete: async (id) => {
    return await api.delete(`/users/${id}`);
  },

  // Toggle user status
  toggleStatus: async (id) => {
    return await api.put(`/users/${id}/toggle-status`);
  }
};

export default userService;


