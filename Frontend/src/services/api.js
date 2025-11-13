import axios from 'axios';

const deriveApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    return envUrl.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    const fallbackPort = import.meta.env.VITE_API_PORT ?? '5000';
    const portSegment = fallbackPort ? `:${fallbackPort}` : '';

    return `${protocol}//${hostname}${portSegment}`;
  }

  return 'http://localhost:5000';
};

export const API_BASE_URL = deriveApiBaseUrl();

// Create axios instance
const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const tenantId = localStorage.getItem('activeTenantId');
    if (tenantId) {
      config.headers['x-tenant-id'] = tenantId;
    } else {
      delete config.headers['x-tenant-id'];
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;


