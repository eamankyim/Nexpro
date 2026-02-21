import api from './api';

const equipmentService = {
  getCategories: async () => api.get('/equipment/categories'),
  createCategory: async (payload) => api.post('/equipment/categories', payload),
  updateCategory: async (id, payload) => api.put(`/equipment/categories/${id}`, payload),

  getItems: async (params = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      searchParams.append(key, value);
    });
    const query = searchParams.toString();
    return api.get(query ? `/equipment/items?${query}` : '/equipment/items');
  },

  getById: async (id) => api.get(`/equipment/items/${id}`),
  createItem: async (payload) => api.post('/equipment/items', payload),
  updateItem: async (id, payload) => api.put(`/equipment/items/${id}`, payload),
  deleteItem: async (id) => api.delete(`/equipment/items/${id}`)
};

export default equipmentService;
