import axios, { CancelTokenSource, AxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

import { logger } from '@/utils/logger';
import { STORAGE_KEYS } from '@/constants';

// Extend AxiosRequestConfig to support metadata
declare module 'axios' {
  export interface AxiosRequestConfig {
    metadata?: {
      requestId?: string;
    };
  }
}

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.apiUrl ||
  'http://localhost:5001';

logger.info('API', 'Base URL:', API_BASE_URL);

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Request cancellation map for canceling stale requests
const cancelTokenSources = new Map<string, CancelTokenSource>();

/**
 * Create a cancel token for a request
 * @param requestId - Unique identifier for the request
 * @returns Cancel token source
 */
export const createCancelToken = (requestId: string): CancelTokenSource => {
  // Cancel previous request with same ID if it exists
  const existingSource = cancelTokenSources.get(requestId);
  if (existingSource) {
    existingSource.cancel('Request superseded by new request');
  }

  // Create new cancel token source
  const source = axios.CancelToken.source();
  cancelTokenSources.set(requestId, source);

  // Clean up after request completes (with delay to allow cancellation)
  setTimeout(() => {
    cancelTokenSources.delete(requestId);
  }, 5000);

  return source;
};

const isPublicEndpoint = (url?: string) =>
  url?.includes('/auth/login') ||
  url?.includes('/auth/register') ||
  url?.includes('/auth/google') ||
  url?.includes('/auth/config') ||
  url?.includes('/auth/sso') ||
  url?.includes('/tenants/signup') ||
  url?.includes('/invites/validate');

api.interceptors.request.use(
  async (config) => {
    logger.debug('API', `→ ${config.method?.toUpperCase()} ${config.url}`);

    const token = await SecureStore.getItemAsync('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (!isPublicEndpoint(config.url)) {
      const tenantId = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_TENANT_ID);
      if (tenantId) {
        config.headers['x-tenant-id'] = tenantId;
      } else {
        logger.warn('API', 'No activeTenantId for tenant-scoped request:', config.url);
      }
    }

    // Add cancel token if requestId is provided in config metadata
    if (config.metadata?.requestId) {
      const cancelToken = createCancelToken(config.metadata.requestId);
      config.cancelToken = cancelToken.token;
    }

    return config;
  },
  (error) => {
    logger.error('API', 'Request error:', error?.message);
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    logger.debug('API', `← ${response.status} ${response.config.url}`);
    return response;
  },
  async (error) => {
    if (axios.isCancel(error)) {
      logger.debug('API', 'Request canceled:', error.message);
      return Promise.reject(error);
    }

    const url = error.config?.url?.replace(error.config.baseURL || '', '') || 'unknown';
    const status = error.response?.status;
    const msg = error.response?.data?.error || error.response?.data?.message || error.message;
    const isNetworkError =
      error.code === 'ECONNREFUSED' ||
      error.code === 'ECONNABORTED' ||
      error.message === 'Network Error' ||
      (typeof error.message === 'string' && error.message.toLowerCase().includes('timeout'));

    if (isNetworkError) {
      logger.warn('API', `← ${url}: ${error.message || 'unreachable'}. Check backend is running and EXPO_PUBLIC_API_URL.`);
    } else {
      logger.error('API', `← ${status || 'ERR'} ${url}:`, msg || error.message);
    }

    if (status === 401) {
      logger.info('API', '401 Unauthorized - clearing token');
      await SecureStore.deleteItemAsync('token');
    }

    return Promise.reject(error);
  }
);

export { api, API_BASE_URL };
