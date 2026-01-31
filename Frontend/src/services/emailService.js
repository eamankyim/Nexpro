import api from './api';

const emailService = {
  // Get Email settings
  getSettings: async () => {
    return await api.get('/settings/email');
  },

  // Update Email settings
  updateSettings: async (settings) => {
    return await api.put('/settings/email', settings);
  },

  // Test Email connection
  testConnection: async (config) => {
    return await api.post('/settings/email/test', config);
  }
};

export default emailService;
