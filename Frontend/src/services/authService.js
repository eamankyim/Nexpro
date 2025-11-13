import api from './api';

const STORAGE_KEYS = {
  token: 'token',
  user: 'user',
  memberships: 'tenantMemberships',
  activeTenant: 'activeTenantId',
};

const persistAuthPayload = (payload = {}) => {
  const { user, token, memberships = [], defaultTenantId } = payload;

  if (token) {
    localStorage.setItem(STORAGE_KEYS.token, token);
  }

  if (user) {
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
  }

  localStorage.setItem(STORAGE_KEYS.memberships, JSON.stringify(memberships));

  const preferredTenantId =
    defaultTenantId ||
    memberships.find((membership) => membership.isDefault)?.tenantId ||
    memberships[0]?.tenantId ||
    null;

  if (preferredTenantId) {
    localStorage.setItem(STORAGE_KEYS.activeTenant, preferredTenantId);
  } else {
    localStorage.removeItem(STORAGE_KEYS.activeTenant);
  }
};

const clearAuthStorage = () => {
  Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
};

const setActiveTenantId = (tenantId) => {
  if (tenantId) {
    localStorage.setItem(STORAGE_KEYS.activeTenant, tenantId);
  } else {
    localStorage.removeItem(STORAGE_KEYS.activeTenant);
  }
};

const getStoredMemberships = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.memberships);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.warn('Failed to parse stored memberships', error);
    return [];
  }
};

const getActiveTenantId = () => localStorage.getItem(STORAGE_KEYS.activeTenant) || null;

const authService = {
  // Login
  login: async (credentials) => {
    const response = await api.post('/auth/login', credentials);
    const payload = response?.data || response || {};
    persistAuthPayload(payload);
    return { ...response, data: payload };
  },

  // Register
  register: async (userData) => {
    const response = await api.post('/auth/register', userData);
    const payload = response?.data || response || {};
    persistAuthPayload(payload);
    return { ...response, data: payload };
  },

  // Get current user
  getCurrentUser: async () => {
    return await api.get('/auth/me');
  },

  // Update user details
  updateDetails: async (userData) => {
    return await api.put('/auth/updatedetails', userData);
  },

  // Update password
  updatePassword: async (passwordData) => {
    return await api.put('/auth/updatepassword', passwordData);
  },

  // Logout
  logout: () => {
    clearAuthStorage();
  },

  // Tenant onboarding
  tenantSignup: async (payload) => {
    const response = await api.post('/tenants/signup', payload);
    const data = response?.data || response || {};
    persistAuthPayload(data);
    return { ...response, data };
  },

  persistAuthPayload,
  clearAuthStorage,
  setActiveTenantId,
  getStoredUser: () => {
    const user = localStorage.getItem(STORAGE_KEYS.user);
    return user ? JSON.parse(user) : null;
  },
  getStoredMemberships,
  getActiveTenantId,
  getToken: () => localStorage.getItem(STORAGE_KEYS.token),
};

export default authService;


