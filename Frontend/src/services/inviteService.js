import api from './api';

const inviteService = {
  // Generate invite token
  generateInvite: async (inviteData) => {
    return await api.post('/invites', inviteData);
  },

  // Validate invite token
  validateInvite: async (token) => {
    return await api.get(`/invites/validate/${token}`);
  },

  // Get all invites
  getAllInvites: async () => {
    return await api.get('/invites');
  },

  // Revoke invite
  revokeInvite: async (id) => {
    return await api.delete(`/invites/${id}`);
  },

  // Use invite (mark as used)
  useInvite: async (token, userId) => {
    return await api.put(`/invites/${token}/use`, { userId });
  },

  // Get seat usage
  getSeatUsage: async () => {
    return await api.get('/invites/seat-usage');
  },

  // Get storage usage
  getStorageUsage: async () => {
    return await api.get('/invites/storage-usage');
  }
};

export default inviteService;

