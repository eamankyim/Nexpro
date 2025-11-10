import api from './api';

const quoteService = {
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `/quotes?${queryString}` : '/quotes';
    return await api.get(url, {
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache'
      }
    });
  },

  getById: async (id) => {
    return await api.get(`/quotes/${id}`);
  },

  create: async (quoteData) => {
    return await api.post('/quotes', quoteData);
  },

  update: async (id, quoteData) => {
    return await api.put(`/quotes/${id}`, quoteData);
  },

  delete: async (id) => {
    return await api.delete(`/quotes/${id}`);
  },

  convertToJob: async (id) => {
    return await api.post(`/quotes/${id}/convert`);
  }
};

export default quoteService;



