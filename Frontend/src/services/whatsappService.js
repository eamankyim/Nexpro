import api from './api';

const whatsappService = {
  // Get WhatsApp settings
  getSettings: async () => {
    return await api.get('/settings/whatsapp');
  },

  // Update WhatsApp settings
  updateSettings: async (settings) => {
    return await api.put('/settings/whatsapp', settings);
  },

  // Test WhatsApp connection
  testConnection: async (accessToken, phoneNumberId) => {
    return await api.post('/settings/whatsapp/test', {
      accessToken,
      phoneNumberId
    });
  }
};

export default whatsappService;
