import axios from 'axios';

const deriveApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    let url = envUrl.trim().replace(/\/$/, '');
    // Ensure URL has a protocol (http:// or https://)
    if (url && !url.match(/^https?:\/\//i)) {
      // Default to https for production URLs
      url = `https://${url}`;
      console.warn(`VITE_API_URL missing protocol, auto-added https://. Original: ${envUrl}, Fixed: ${url}`);
    }
    console.log(`[API] Using base URL: ${url}`);
    return url;
  }

  // In production (Vercel, etc.), don't use frontend domain with port
  if (typeof window !== 'undefined') {
    const { hostname } = window.location;
    const isProduction = hostname.includes('vercel.app') || 
                        hostname.includes('netlify.app') || 
                        (hostname !== 'localhost' && !hostname.startsWith('127.0.0.1') && !hostname.startsWith('192.168.'));
    
    if (isProduction) {
      // In production without VITE_API_URL, show clear error
      const errorMsg = '❌ VITE_API_URL environment variable is not set! Please configure it in your Vercel project settings.';
      console.error(errorMsg);
      // Show user-facing error
      if (typeof document !== 'undefined') {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#ff4444;color:white;padding:1rem;text-align:center;z-index:9999;font-weight:bold;';
        errorDiv.textContent = errorMsg;
        document.body.appendChild(errorDiv);
      }
      // Return empty to prevent incorrect API calls
      return '';
    }

    // Development fallback: use localhost
    const fallbackPort = import.meta.env.VITE_API_PORT ?? '5000';
    return `http://localhost:${fallbackPort}`;
  }

  return 'http://localhost:5000';
};

export const API_BASE_URL = deriveApiBaseUrl();

// Validate API_BASE_URL before creating axios instance
if (!API_BASE_URL && typeof window !== 'undefined') {
  const { hostname } = window.location;
  const isProduction = hostname.includes('vercel.app') || hostname.includes('netlify.app');
  if (isProduction) {
    console.error('[API] Cannot create API client: VITE_API_URL is required in production');
  }
}

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL ? `${API_BASE_URL}/api` : '/api',
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
    // Don't redirect on 401 for login/register endpoints - let them handle the error
    const isAuthEndpoint = error.config?.url?.includes('/auth/login') || 
                          error.config?.url?.includes('/auth/register') ||
                          error.config?.url?.includes('/tenants/signup');
    
    if (error.response?.status === 401 && !isAuthEndpoint) {
      // Only redirect for authenticated endpoints, not for login failures
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;


