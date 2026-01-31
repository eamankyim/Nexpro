import api from './api';

const smsService = {
  // Get SMS settings
  getSettings: async () => {
    return await api.get('/settings/sms');
  },

  // Update SMS settings
  updateSettings: async (settings) => {
    return await api.put('/settings/sms', settings);
  },

  // Test SMS connection
  testConnection: async (config) => {
    return await api.post('/settings/sms/test', config);
  }
};

export default smsService;
