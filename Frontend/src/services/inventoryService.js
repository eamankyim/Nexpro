import api from './api';

const inventoryService = {
  getCategories: async () => api.get('/inventory/categories'),
  createCategory: async (payload) => api.post('/inventory/categories', payload),
  updateCategory: async (id, payload) => api.put(`/inventory/categories/${id}`, payload),

  getItems: async (params = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      searchParams.append(key, value);
    });
    const query = searchParams.toString();
    return api.get(query ? `/inventory/items?${query}` : '/inventory/items');
  },

  getSummary: async () => api.get('/inventory/items/summary'),
  getMovements: async (params = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      searchParams.append(key, value);
    });
    const query = searchParams.toString();
    return api.get(query ? `/inventory/items/movements?${query}` : '/inventory/items/movements');
  },

  getById: async (id) => api.get(`/inventory/items/${id}`),
  createItem: async (payload) => api.post('/inventory/items', payload),
  updateItem: async (id, payload) => api.put(`/inventory/items/${id}`, payload),
  deleteItem: async (id) => api.delete(`/inventory/items/${id}`),

  restock: async (id, payload) => api.post(`/inventory/items/${id}/restock`, payload),
  adjust: async (id, payload) => api.post(`/inventory/items/${id}/adjust`, payload),
  recordUsage: async (id, payload) => api.post(`/inventory/items/${id}/usage`, payload)
};

export default inventoryService;


