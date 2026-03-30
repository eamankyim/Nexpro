import axios from 'axios';

/** Production API URL when app is served from ABS / African Business Suite production domains */
const ABS_API_URL = 'https://api.africanbusinesssuite.com';

const deriveApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    let url = envUrl.trim().replace(/\/$/, '');
    // Ensure URL has a protocol (http:// or https://)
    if (url && !url.match(/^https?:\/\//i)) {
      // Default to https for production URLs
      url = `https://${url}`;
      if (import.meta.env.DEV && import.meta.env.VITE_DEBUG_API === 'true') {
        console.warn(`VITE_API_URL missing protocol, auto-added https://. Original: ${envUrl}, Fixed: ${url}`);
      }
    }
    if (import.meta.env.DEV && import.meta.env.VITE_DEBUG_API === 'true') {
      console.log(`[API] Using base URL: ${url}`);
    }
    return url;
  }

  // In production, use appropriate API URL
  if (typeof window !== 'undefined') {
    const { hostname } = window.location;
    // ABS production: app at myapp.africanbusinesssuite.com or africanbusinesssuite.com → API at api.africanbusinesssuite.com
    if (hostname === 'myapp.africanbusinesssuite.com' || hostname === 'africanbusinesssuite.com') {
      if (import.meta.env.DEV && import.meta.env.VITE_DEBUG_API === 'true') {
        console.log(`[API] Using base URL: ${ABS_API_URL}`);
      }
      return ABS_API_URL;
    }
    const isProduction = hostname.includes('vercel.app') ||
                        hostname.includes('netlify.app') ||
                        (hostname !== 'localhost' && !hostname.startsWith('127.0.0.1') && !hostname.startsWith('192.168.'));

    if (isProduction) {
      // Other production without VITE_API_URL
      const errorMsg = '❌ VITE_API_URL environment variable is not set! Please configure it in your project settings.';
      console.error(errorMsg);
      if (typeof document !== 'undefined') {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#ff4444;color:white;padding:1rem;text-align:center;z-index:9999;font-weight:bold;';
        errorDiv.textContent = errorMsg;
        document.body.appendChild(errorDiv);
      }
      return '';
    }

    // Development fallback: use localhost
    const fallbackPort = import.meta.env.VITE_API_PORT ?? '5001';
    return `http://localhost:${fallbackPort}`;
  }

  return 'http://localhost:5001';
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

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000; // 1 second base delay

/**
 * Calculate exponential backoff delay
 * @param {number} attempt - Current retry attempt (0-indexed)
 * @returns {number} Delay in milliseconds
 */
const getRetryDelay = (attempt) => {
  return RETRY_DELAY_BASE * Math.pow(2, attempt);
};

/**
 * Check if error should be retried
 * @param {Error} error - Axios error object
 * @returns {boolean} Whether to retry
 */
const shouldRetry = (error) => {
  // Don't retry if request was cancelled
  if (axios.isCancel(error)) {
    return false;
  }

  // Retry on network errors
  if (!error.response) {
    return true;
  }

  // Retry on 5xx server errors
  const status = error.response.status;
  if (status >= 500 && status < 600) {
    return true;
  }

  // Retry on 429 (Too Many Requests)
  if (status === 429) {
    return true;
  }

  // Don't retry on 4xx client errors (except 429)
  return false;
};

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL ? `${API_BASE_URL}/api` : '/api',
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest', // Satisfies backend CSRF check (state-changing requests)
  },
  timeout: 30000, // 30 second timeout
});

// Request interceptor to add auth token and AbortController
api.interceptors.request.use(
  (config) => {
    // Create AbortController if not already present
    if (!config.signal) {
      const abortController = new AbortController();
      config.signal = abortController.signal;
      config.abortController = abortController; // Store for potential cancellation
    }

    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Skip tenantId check for public endpoints and user-scoped endpoints
    const isPublicEndpoint = config.url?.includes('/tenants/signup') ||
                            config.url?.includes('/auth/login') ||
                            config.url?.includes('/auth/register') ||
                            config.url?.includes('/auth/sso') ||
                            config.url?.includes('/auth/check-email') ||
                            config.url?.includes('/auth/config') ||
                            config.url?.includes('/invites/validate');
    const isUserScopedEndpoint = config.url?.includes('/user-workspace');
    
    if (isPublicEndpoint || isUserScopedEndpoint) {
      // Don't add tenant-id header for public or user-scoped endpoints
      return config;
    }
    
    let tenantId = localStorage.getItem('activeTenantId');
    
    // If no tenantId, try to get it from memberships
    if (!tenantId) {
      try {
        // Storage key is 'tenantMemberships' (from authService.STORAGE_KEYS.memberships)
        const membershipsStr = localStorage.getItem('tenantMemberships') || '[]';
        const memberships = JSON.parse(membershipsStr);

        if (memberships && Array.isArray(memberships) && memberships.length > 0) {
          const defaultTenantId = memberships.find(m => m.isDefault)?.tenantId || memberships[0]?.tenantId;
          if (defaultTenantId) {
            localStorage.setItem('activeTenantId', defaultTenantId);
            tenantId = defaultTenantId;
          }
        }
      } catch (e) {
        if (import.meta.env.DEV && import.meta.env.VITE_DEBUG_API === 'true') {
          console.error('[API] Error parsing memberships from localStorage:', e);
        }
      }
    }
    
    if (tenantId) {
      config.headers['x-tenant-id'] = tenantId;
    } else {
      delete config.headers['x-tenant-id'];
      if (import.meta.env.DEV && import.meta.env.VITE_DEBUG_API === 'true') {
        console.warn('[API] No activeTenantId available - request may fail');
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor with retry logic
api.interceptors.response.use(
  (response) => {
    const rt = response.config?.responseType;
    if (rt === 'blob' || rt === 'arraybuffer') {
      return response;
    }
    return response.data;
  },
  async (error) => {
    const config = error.config;

    // Initialize retry count if not present
    if (!config.__retryCount) {
      config.__retryCount = 0;
    }

    // Check if we should retry
    if (shouldRetry(error) && config.__retryCount < MAX_RETRIES) {
      config.__retryCount += 1;
      const delay = getRetryDelay(config.__retryCount - 1);

      if (import.meta.env.DEV && import.meta.env.VITE_DEBUG_API === 'true') {
        console.log(`[API] Retrying request (attempt ${config.__retryCount}/${MAX_RETRIES}) after ${delay}ms:`, config.url);
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));

      // Retry the request
      return api(config);
    }

    // Don't redirect on 401 for login/register endpoints - let them handle the error
    const isAuthEndpoint = error.config?.url?.includes('/auth/login') ||
                          error.config?.url?.includes('/auth/register') ||
                          error.config?.url?.includes('/tenants/signup');
    // Don't redirect on 401 for tour status - avoids reload loop when token expired and tour refetches
    const isTourEndpoint = error.config?.url?.includes('/tours/status');

    if (error.response?.status === 401 && !isAuthEndpoint && !isTourEndpoint) {
      const existingToken = localStorage.getItem('token');
      // Only redirect when we actually had a session token.
      // This prevents redirect/reload loops on public pages making optional requests.
      if (existingToken) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Export helper function to cancel requests
export const createCancelToken = () => {
  const abortController = new AbortController();
  return {
    signal: abortController.signal,
    cancel: () => abortController.abort(),
  };
};

export default api;


