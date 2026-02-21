import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { api } from './api';
import { logger } from '@/utils/logger';
import { STORAGE_KEYS } from '@/constants';

const AUTH_STORAGE_KEYS = {
  token: 'token',
  user: 'user',
  memberships: 'tenantMemberships',
  activeTenant: STORAGE_KEYS.ACTIVE_TENANT_ID,
};

async function persistAuthPayload(payload: {
  user?: object;
  token?: string;
  memberships?: Array<{ tenantId: string; isDefault?: boolean }>;
  defaultTenantId?: string;
}) {
  const { user, token, memberships = [], defaultTenantId } = payload;

  if (token) await SecureStore.setItemAsync(AUTH_STORAGE_KEYS.token, token);
  if (user) await AsyncStorage.setItem(AUTH_STORAGE_KEYS.user, JSON.stringify(user));
  await AsyncStorage.setItem(AUTH_STORAGE_KEYS.memberships, JSON.stringify(memberships));

  const preferredTenantId =
    defaultTenantId ||
    memberships.find((m) => m.isDefault)?.tenantId ||
    memberships[0]?.tenantId ||
    null;

  if (preferredTenantId) {
    await AsyncStorage.setItem(AUTH_STORAGE_KEYS.activeTenant, preferredTenantId);
  } else {
    await AsyncStorage.removeItem(AUTH_STORAGE_KEYS.activeTenant);
  }
}

async function clearAuthStorage() {
  await SecureStore.deleteItemAsync(AUTH_STORAGE_KEYS.token);
  await AsyncStorage.multiRemove([
    AUTH_STORAGE_KEYS.user,
    AUTH_STORAGE_KEYS.memberships,
    AUTH_STORAGE_KEYS.activeTenant,
  ]);
}

export const authService = {
  login: async (credentials: { email: string; password: string }) => {
    logger.info('Auth', 'Login attempt:', credentials.email);
    try {
      const response = await api.post('/auth/login', credentials);
      // Backend returns: { success: true, data: { user, token, memberships, defaultTenantId } }
      // Mobile API doesn't unwrap response.data, so we need response.data.data
      const payload = response?.data?.data ?? response?.data ?? response ?? {};
      const memberships = payload.memberships ?? payload.tenantMemberships ?? [];
      const defaultTenantId =
        payload.defaultTenantId ??
        memberships.find((m: { isDefault?: boolean }) => m.isDefault)?.tenantId ??
        memberships[0]?.tenantId ??
        null;
      
      logger.info('Auth', 'Login success:', {
        membershipsCount: memberships?.length ?? 0,
        defaultTenantId,
        hasUser: !!payload.user,
        hasToken: !!payload.token,
        membershipTenantIds: memberships?.map((m: { tenantId: string }) => m.tenantId) ?? [],
      });

      await persistAuthPayload({
        user: payload.user,
        token: payload.token,
        memberships,
        defaultTenantId,
      });
      return { ...response, data: payload };
    } catch (err) {
      logger.error('Auth', 'Login failed:', err);
      throw err;
    }
  },

  getCurrentUser: async () => {
    logger.debug('Auth', 'Fetching current user');
    const res = await api.get('/auth/me');
    logger.info('Auth', 'Current user fetched');
    return res;
  },

  logout: async () => {
    logger.info('Auth', 'Logging out');
    await clearAuthStorage();
  },

  setActiveTenantId: async (tenantId: string | null) => {
    if (tenantId) await AsyncStorage.setItem(AUTH_STORAGE_KEYS.activeTenant, tenantId);
    else await AsyncStorage.removeItem(AUTH_STORAGE_KEYS.activeTenant);
  },

  getStoredUser: async () => {
    const raw = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.user);
    return raw ? JSON.parse(raw) : null;
  },

  getStoredMemberships: async () => {
    const raw = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.memberships);
    try {
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  getActiveTenantId: async () => {
    return (await AsyncStorage.getItem(AUTH_STORAGE_KEYS.activeTenant)) || null;
  },

  getToken: () => SecureStore.getItemAsync(STORAGE_KEYS.token),

  persistAuthPayload,
};
