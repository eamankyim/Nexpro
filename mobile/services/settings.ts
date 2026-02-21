import { api } from './api';

export type ProfilePayload = {
  name?: string;
  email?: string;
  profilePicture?: string;
  currentPassword?: string;
  newPassword?: string;
};

export const settingsService = {
  getProfile: async () => {
    const res = await api.get('/settings/profile');
    // Backend returns: { success: true, data: {...} }
    return res.data;
  },

  updateProfile: async (payload: ProfilePayload) => {
    const res = await api.put('/settings/profile', payload);
    // Backend returns: { success: true, data: {...} }
    return res.data;
  },
};
