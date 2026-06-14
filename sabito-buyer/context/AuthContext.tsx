import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEYS } from '@/constants';
import { authApi, getStoredCustomer, type StorefrontCustomer } from '@/services/authApi';
import { getApiAuthToken, setApiAuthToken } from '@/services/api';

type AuthContextValue = {
  customer: StorefrontCustomer | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: { name: string; email: string; phone: string; password: string }) => Promise<void>;
  googleAuth: (idToken: string, signUp?: boolean) => Promise<void>;
  verifyOtp: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  updateProfile: (payload: { name?: string; phone?: string }) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<StorefrontCustomer | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    const token = await getApiAuthToken();
    if (!token) {
      setCustomer(null);
      return;
    }
    try {
      const res = await authApi.getMe();
      setCustomer(res?.data?.customer || (await getStoredCustomer()));
    } catch {
      setCustomer(await getStoredCustomer());
    }
  }, []);

  useEffect(() => {
    (async () => {
      const token = await SecureStore.getItemAsync(STORAGE_KEYS.token);
      setApiAuthToken(token);
      const stored = await getStoredCustomer();
      setCustomer(stored);
      if (token) {
        try {
          await refreshSession();
        } catch {
          /* keep stored customer */
        }
      }
      setIsLoading(false);
    })();
  }, [refreshSession]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    setCustomer(res?.data?.customer || null);
  }, []);

  const register = useCallback(
    async (payload: { name: string; email: string; phone: string; password: string }) => {
      const res = await authApi.register(payload);
      setCustomer(res?.data?.customer || null);
    },
    [],
  );

  const verifyOtp = useCallback(async (email: string, code: string) => {
    const res = await authApi.verifyLoginOtp({ email, code });
    setCustomer(res?.data?.customer || null);
  }, []);

  const googleAuth = useCallback(async (idToken: string, signUp = false) => {
    const res = await authApi.googleAuth(idToken, signUp);
    setCustomer(res?.data?.customer || null);
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setCustomer(null);
  }, []);

  const updateProfile = useCallback(async (payload: { name?: string; phone?: string }) => {
    const res = await authApi.updateProfile(payload);
    setCustomer(res?.data?.customer || null);
  }, []);

  const value = useMemo(
    () => ({
      customer,
      isAuthenticated: Boolean(customer),
      isLoading,
      login,
      register,
      googleAuth,
      verifyOtp,
      logout,
      refreshSession,
      updateProfile,
    }),
    [customer, isLoading, login, register, googleAuth, verifyOtp, logout, refreshSession, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
