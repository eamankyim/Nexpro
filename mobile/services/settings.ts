import { api } from './api';

export type ProfilePayload = {
  name?: string;
  profilePicture?: string;
  currentPassword?: string;
  password?: string;
};

export const settingsService = {
  getOrganizationSettings: async () => {
    const res = await api.get('/settings/organization');
    return res?.data?.data ?? res?.data ?? res;
  },

  getCustomerSources: async () => {
    const res = await api.get('/settings/customer-sources');
    const data = res?.data?.data ?? res?.data ?? [];
    return Array.isArray(data) ? data : [];
  },

  getLeadSources: async () => {
    const res = await api.get('/settings/lead-sources');
    const data = res?.data?.data ?? res?.data ?? [];
    return Array.isArray(data) ? data : [];
  },

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

  uploadProfilePicture: async (uri: string, mimeType = 'image/jpeg') => {
    const formData = new FormData();
    const ext = mimeType.includes('png') ? 'png' : 'jpg';
    formData.append('file', {
      uri,
      name: `avatar.${ext}`,
      type: mimeType,
    } as unknown as Blob);
    const res = await api.post('/settings/profile/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  requestDataDeletion: async (payload: { reason?: string } = {}) => {
    const res = await api.post('/settings/data-deletion-request', payload);
    return res.data;
  },
};
