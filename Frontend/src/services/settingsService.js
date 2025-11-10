import api from './api';

const getProfile = async () => api.get('/settings/profile');

const updateProfile = async (payload) => api.put('/settings/profile', payload);

const uploadProfilePicture = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/settings/profile/avatar', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
};

const getOrganization = async () => api.get('/settings/organization');

const updateOrganization = async (payload) => api.put('/settings/organization', payload);

const uploadOrganizationLogo = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/settings/organization/logo', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
};

const getSubscription = async () => api.get('/settings/subscription');

const updateSubscription = async (payload) => api.put('/settings/subscription', payload);

export default {
  getProfile,
  updateProfile,
  uploadProfilePicture,
  getOrganization,
  updateOrganization,
  uploadOrganizationLogo,
  getSubscription,
  updateSubscription
};

