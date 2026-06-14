import axios from 'axios';

/** Local backend URL used when VITE_API_DIRECT=true without a VITE_API_URL override. */
const LOCAL_API_URL = 'http://localhost:5002';
const ABS_API_URL = 'https://api.africanbusinesssuite.com';
const ABS_PRODUCTION_HOSTS = new Set([
  'store.absghana.com',
  'store.africanbusinesssuite.com',
  'absghana.com',
  'www.absghana.com',
  'africanbusinesssuite.com',
  'www.africanbusinesssuite.com',
]);
const PRODUCTION_API_HOSTS = new Set(['api.africanbusinesssuite.com']);

const normalizeEnvApiUrl = (envUrl) => {
  if (!envUrl) return '';
  let url = envUrl.trim().replace(/\/$/, '').replace(/\/api\/?$/i, '');
  if (url && !/^https?:\/\//i.test(url)) {
    const localhostLike = /^(localhost|127(?:\.\d{1,3}){3}|192\.168\.)/i.test(url);
    url = `${localhostLike ? 'http' : 'https'}://${url}`;
  }
  return url;
};

const isLocalHost = (hostname) => (
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname.startsWith('192.168.')
);

const getUrlHostname = (url) => {
  try {
    const withProtocol = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return new URL(withProtocol).hostname;
  } catch {
    return '';
  }
};

const isProductionApiUrl = (url) => PRODUCTION_API_HOSTS.has(getUrlHostname(url));

/**
 * Use same-origin /api in dev so Vite can proxy to the correct local backend port.
 * Avoids CORS and macOS AirPlay occupying port 5000 when the backend binds to 5001+.
 */
const useViteDevProxy = () => (
  import.meta.env.DEV && import.meta.env.VITE_API_DIRECT !== 'true'
);

const resolveLocalDevApiBaseUrl = (envUrl) => {
  if (useViteDevProxy()) {
    return '';
  }

  if (!envUrl) {
    return LOCAL_API_URL;
  }

  const normalized = normalizeEnvApiUrl(envUrl);
  if (isProductionApiUrl(normalized)) {
    console.warn(
      `[API] VITE_API_URL points at production (${normalized}) during local dev; using ${LOCAL_API_URL}.`
    );
    return LOCAL_API_URL;
  }

  return normalized || LOCAL_API_URL;
};

const deriveApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';

  if (isLocalHost(hostname)) {
    return resolveLocalDevApiBaseUrl(envUrl);
  }

  if (envUrl) {
    return normalizeEnvApiUrl(envUrl);
  }

  if (ABS_PRODUCTION_HOSTS.has(hostname)) {
    return ABS_API_URL;
  }

  return '';
};

export const API_BASE_URL = deriveApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL ? `${API_BASE_URL}/api` : '/api',
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined'
    ? window.localStorage.getItem('sabito_storefront_token')
    : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    if (typeof config.headers?.delete === 'function') {
      config.headers.delete('Content-Type');
      config.headers.delete('content-type');
    } else if (config.headers) {
      delete config.headers['Content-Type'];
      delete config.headers['content-type'];
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => Promise.reject(error),
);

export default api;
