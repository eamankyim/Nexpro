import api from './api';

const materialsService = {
  getCategories: async () => api.get('/materials/categories'),
  createCategory: async (payload) => api.post('/materials/categories', payload),
  updateCategory: async (id, payload) => api.put(`/materials/categories/${id}`, payload),

  getItems: async (params = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      searchParams.append(key, value);
    });
    const query = searchParams.toString();
    return api.get(query ? `/materials/items?${query}` : '/materials/items');
  },

  getSummary: async () => api.get('/materials/items/summary'),
  getMovements: async (params = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      searchParams.append(key, value);
    });
    const query = searchParams.toString();
    return api.get(query ? `/materials/items/movements?${query}` : '/materials/items/movements');
  },

  getById: async (id) => api.get(`/materials/items/${id}`),
  createItem: async (payload) => api.post('/materials/items', payload),
  updateItem: async (id, payload) => api.put(`/materials/items/${id}`, payload),
  deleteItem: async (id) => api.delete(`/materials/items/${id}`),

  restock: async (id, payload) => api.post(`/materials/items/${id}/restock`, payload),
  adjust: async (id, payload) => api.post(`/materials/items/${id}/adjust`, payload),
  recordUsage: async (id, payload) => api.post(`/materials/items/${id}/usage`, payload)
};

export default materialsService;
