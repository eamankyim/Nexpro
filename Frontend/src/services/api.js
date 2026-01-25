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
    
    // Skip tenantId check for public endpoints (signup, login, register)
    const isPublicEndpoint = config.url?.includes('/tenants/signup') ||
                            config.url?.includes('/auth/login') ||
                            config.url?.includes('/auth/register') ||
                            config.url?.includes('/auth/sso') ||
                            config.url?.includes('/invites/validate');
    
    if (isPublicEndpoint) {
      // Don't add tenant-id header for public endpoints
      return config;
    }
    
    let tenantId = localStorage.getItem('activeTenantId');
    
    // If no tenantId, try to get it from memberships
    if (!tenantId) {
      try {
        // Storage key is 'tenantMemberships' (from authService.STORAGE_KEYS.memberships)
        const membershipsStr = localStorage.getItem('tenantMemberships') || '[]';
        console.log('[API] 🔍 Checking memberships for tenantId:', {
          hasMembershipsStr: !!membershipsStr,
          membershipsStrLength: membershipsStr.length,
          membershipsStr: membershipsStr.substring(0, 200) // First 200 chars
        });
        
        const memberships = JSON.parse(membershipsStr);
        console.log('[API] 🔍 Parsed memberships:', {
          isArray: Array.isArray(memberships),
          length: memberships?.length || 0,
          firstMembership: memberships?.[0]
        });
        
        if (memberships && Array.isArray(memberships) && memberships.length > 0) {
          const defaultTenantId = memberships.find(m => m.isDefault)?.tenantId || memberships[0]?.tenantId;
          console.log('[API] 🔍 Found tenantId from memberships:', {
            defaultTenantId,
            hasDefaultTenantId: !!defaultTenantId,
            allTenantIds: memberships.map(m => m.tenantId)
          });
          
          if (defaultTenantId) {
            console.log('[API] 🔧 Setting activeTenantId from memberships:', defaultTenantId);
            localStorage.setItem('activeTenantId', defaultTenantId);
            tenantId = defaultTenantId;
          }
        } else {
          console.warn('[API] ⚠️ No memberships found or empty array');
        }
      } catch (e) {
        console.error('[API] ❌ Error parsing memberships from localStorage:', e);
      }
    }
    
    if (tenantId) {
      config.headers['x-tenant-id'] = tenantId;
      console.log('[API] ✅ Adding x-tenant-id header:', tenantId);
    } else {
      delete config.headers['x-tenant-id'];
      console.error('[API] ❌ No activeTenantId available - request will likely fail');
      console.log('[API] 🔍 localStorage contents:', {
        hasToken: !!localStorage.getItem('token'),
        hasUser: !!localStorage.getItem('user'),
        hasMemberships: !!localStorage.getItem('tenantMemberships'),
        hasActiveTenantId: !!localStorage.getItem('activeTenantId'),
        allKeys: Object.keys(localStorage)
      });
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor with retry logic
api.interceptors.response.use(
  (response) => response.data,
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

      console.log(`[API] Retrying request (attempt ${config.__retryCount}/${MAX_RETRIES}) after ${delay}ms:`, config.url);

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));

      // Retry the request
      return api(config);
    }

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

// Export helper function to cancel requests
export const createCancelToken = () => {
  const abortController = new AbortController();
  return {
    signal: abortController.signal,
    cancel: () => abortController.abort(),
  };
};

export default api;


