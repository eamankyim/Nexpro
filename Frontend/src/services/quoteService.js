import api from './api';
import { buildScopedQueryString } from '../utils/shopScope';

const quoteService = {
  getAll: async (params = {}) => {
    const queryString = buildScopedQueryString(params);
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

  updateStatus: async (id, status) => {
    return await api.patch(`/quotes/${id}/status`, { status });
  },

  delete: async (id) => {
    return await api.delete(`/quotes/${id}`);
  },

  convertToJob: async (id, jobData = {}) => {
    return await api.post(`/quotes/${id}/convert`, jobData);
  },

  convertToSale: async (id, paymentMethod = 'credit', shopId = null) => {
    return await api.post(`/quotes/${id}/convert-to-sale`, {
      paymentMethod,
      shopId
    });
  },

  // Get quote activities
  getActivities: async (quoteId) => {
    return await api.get(`/quotes/${quoteId}/activities`);
  },

  // Add quote activity
  addActivity: async (quoteId, activityData) => {
    return await api.post(`/quotes/${quoteId}/activities`, activityData);
  },

  uploadAttachment: async (id, file, type = 'other') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    return await api.post(`/quotes/${id}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  deleteAttachment: async (id, attachmentId) => {
    return await api.delete(`/quotes/${id}/attachments/${attachmentId}`);
  },
};

export default quoteService;



