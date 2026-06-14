import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';

import authService from '../services/authService';

const StorefrontAuthContext = createContext(null);
export const STOREFRONT_PURCHASE_INTENT_KEY = 'sabito_storefront_purchase_intent';

const buildDefaultIntent = (intent = {}) => {
  const currentPath = typeof window !== 'undefined'
    ? `${window.location.pathname}${window.location.search || ''}`
    : '/';

  return {
    action: intent.action || 'home',
    returnTo: intent.returnTo || currentPath || '/',
    productId: intent.productId || null,
    productSlug: intent.productSlug || null,
    storeSlug: intent.storeSlug || null,
  };
};

export const StorefrontAuthProvider = ({ children }) => {
  const [customer, setCustomer] = useState(() => authService.getStoredCustomer());
  const [googleClientId, setGoogleClientId] = useState(() => (
    String(import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim()
  ));
  const [googleConfigLoaded, setGoogleConfigLoaded] = useState(() => Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID));
  const [isLoading, setIsLoading] = useState(() => Boolean(authService.getToken()));
  const [authModal, setAuthModal] = useState({
    isOpen: false,
    mode: 'signup',
    intent: null,
  });

  useEffect(() => {
    let mounted = true;
    if (!authService.getToken()) {
      setIsLoading(false);
      return undefined;
    }

    authService.getMe()
      .then((data) => {
        if (mounted) setCustomer(data.customer || null);
      })
      .catch(() => {
        authService.logout();
        if (mounted) setCustomer(null);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (googleClientId) {
      setGoogleConfigLoaded(true);
      return undefined;
    }

    let mounted = true;
    authService.getPublicConfig()
      .then((config) => {
        if (!mounted) return;
        const clientId = String(config?.googleClientId || '').trim();
        if (clientId) setGoogleClientId(clientId);
      })
      .catch(() => {
        // Google is optional; keep password/OTP auth available if config cannot load.
      })
      .finally(() => {
        if (mounted) setGoogleConfigLoaded(true);
      });

    return () => {
      mounted = false;
    };
  }, [googleClientId]);

  const login = useCallback(async (payload) => {
    const data = await authService.login(payload);
    setCustomer(data.customer || null);
    return data;
  }, []);

  const googleAuth = useCallback(async (idToken, options = {}) => {
    const data = await authService.googleAuth(idToken, options);
    setCustomer(data.customer || null);
    return data;
  }, []);

  const verifyLoginOtp = useCallback(async (payload) => {
    const data = await authService.verifyLoginOtp(payload);
    setCustomer(data.customer || null);
    return data;
  }, []);

  const sendLoginOtp = useCallback(async (payload) => {
    const data = await authService.sendLoginOtp(payload);
    return data;
  }, []);

  const register = useCallback(async (payload) => {
    const data = await authService.register(payload);
    if (data?.token) setCustomer(data.customer || null);
    return data;
  }, []);

  const verifyEmail = useCallback(async (payload) => {
    const data = await authService.verifyEmail(payload);
    setCustomer(data.customer || null);
    return data;
  }, []);

  const resendVerification = useCallback(async (payload) => {
    const data = await authService.resendVerification(payload);
    return data;
  }, []);

  const updateProfile = useCallback(async (payload) => {
    const data = await authService.updateProfile(payload);
    setCustomer(data.customer || null);
    return data;
  }, []);

  const uploadAvatar = useCallback(async (file) => {
    const data = await authService.uploadAvatar(file);
    setCustomer(data.customer || null);
    return data;
  }, []);

  const removeAvatar = useCallback(async () => {
    const data = await authService.removeAvatar();
    setCustomer(data.customer || null);
    return data;
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setCustomer(null);
  }, []);

  const openShopperAuthModal = useCallback((options = {}) => {
    const intent = buildDefaultIntent(options.intent);

    try {
      window.localStorage.setItem(STOREFRONT_PURCHASE_INTENT_KEY, JSON.stringify(intent));
    } catch {
      // Purchase intent is a convenience only; auth should still proceed if storage is unavailable.
    }

    setAuthModal({
      isOpen: true,
      mode: options.mode || 'signup',
      intent,
    });
  }, []);

  const closeShopperAuthModal = useCallback(() => {
    setAuthModal((current) => ({
      ...current,
      isOpen: false,
    }));
  }, []);

  const value = useMemo(() => ({
    authModal,
    closeShopperAuthModal,
    customer,
    googleAuth,
    googleClientId,
    googleConfigLoaded,
    isAuthenticated: Boolean(customer && authService.getToken()),
    isLoading,
    login,
    logout,
    openShopperAuthModal,
    register,
    removeAvatar,
    resendVerification,
    sendLoginOtp,
    uploadAvatar,
    updateProfile,
    verifyLoginOtp,
    verifyEmail,
  }), [
    authModal,
    closeShopperAuthModal,
    customer,
    googleAuth,
    googleClientId,
    googleConfigLoaded,
    isLoading,
    login,
    logout,
    openShopperAuthModal,
    register,
    removeAvatar,
    resendVerification,
    sendLoginOtp,
    uploadAvatar,
    updateProfile,
    verifyEmail,
    verifyLoginOtp,
  ]);

  return (
    <GoogleOAuthProvider clientId={googleClientId || ''}>
      <StorefrontAuthContext.Provider value={value}>
        {children}
      </StorefrontAuthContext.Provider>
    </GoogleOAuthProvider>
  );
};

export const useStorefrontAuth = () => {
  const context = useContext(StorefrontAuthContext);
  if (!context) {
    throw new Error('useStorefrontAuth must be used within StorefrontAuthProvider');
  }
  return context;
};
