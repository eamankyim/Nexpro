import api from './api';

const getProfile = async () => api.get('/settings/profile');

const updateProfile = async (payload) => api.put('/settings/profile', payload);

const uploadProfilePicture = async (file) => {
  console.log('[Settings Service] Uploading profile picture:', {
    name: file?.name,
    type: file?.type,
    size: file?.size,
    isFile: file instanceof File,
    hasOriginFileObj: !!file?.originFileObj
  });

  // Handle Ant Design Upload file wrapper
  const actualFile = file.originFileObj || file;
  
  if (!actualFile) {
    throw new Error('No file provided');
  }

  const formData = new FormData();
  formData.append('file', actualFile);
  
  console.log('[Settings Service] FormData created, sending request...');
  
  try {
    const response = await api.post('/settings/profile/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    console.log('[Settings Service] Upload response:', response);
    return response;
  } catch (error) {
    console.error('[Settings Service] Upload error:', error);
    throw error;
  }
};

const getOrganization = async () => api.get('/settings/organization');
const getOrganizationSettings = getOrganization;

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

const getPOSConfig = async () => api.get('/settings/pos-config');

const updatePOSConfig = async (payload) => api.put('/settings/pos-config', payload);

const getCustomerSources = async () => {
  const res = await api.get('/settings/customer-sources');
  return res?.data ?? [];
};

const getLeadSources = async () => {
  const res = await api.get('/settings/lead-sources');
  return res?.data ?? [];
};

export default {
  getProfile,
  updateProfile,
  uploadProfilePicture,
  getOrganization,
  getOrganizationSettings,
  updateOrganization,
  uploadOrganizationLogo,
  getSubscription,
  updateSubscription,
  getPOSConfig,
  updatePOSConfig,
  getCustomerSources,
  getLeadSources
};

