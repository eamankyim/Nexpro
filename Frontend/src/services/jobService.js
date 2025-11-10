import api from './api';

const jobService = {
  // Get all jobs
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return await api.get(`/jobs?${queryString}`);
  },

  // Get single job
  getById: async (id) => {
    return await api.get(`/jobs/${id}`);
  },

  // Create job
  create: async (jobData) => {
    return await api.post('/jobs', jobData);
  },

  // Update job
  update: async (id, jobData) => {
    return await api.put(`/jobs/${id}`, jobData);
  },

  // Delete job
  delete: async (id) => {
    return await api.delete(`/jobs/${id}`);
  },

  uploadAttachment: async (id, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return await api.post(`/jobs/${id}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  deleteAttachment: async (id, attachmentId) => {
    return await api.delete(`/jobs/${id}/attachments/${attachmentId}`);
  },

  // Get job statistics
  getStats: async () => {
    return await api.get('/jobs/stats/overview');
  }
};

export default jobService;


