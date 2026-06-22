import { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import { useGoogleOAuth } from '@react-oauth/google';

import { usePublicConfig } from '../context/PublicConfigContext';

const GoogleSignInContext = createContext(null);

export const useGoogleSignIn = () => useContext(GoogleSignInContext);

let gsiInitializedClientId = null;

const ensureGoogleIdentityInitialized = (clientId, onCredential) => {
  if (!window.google?.accounts?.id || !clientId) return false;

  if (gsiInitializedClientId !== clientId) {
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: onCredential,
      auto_select: false,
      cancel_on_tap_outside: true,
    });
    gsiInitializedClientId = clientId;
  }

  return true;
};

const renderGoogleButton = (container, { text = 'signin_with', width = 300 } = {}) => {
  if (!container || !window.google?.accounts?.id) return;

  container.innerHTML = '';
  window.google.accounts.id.renderButton(container, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text,
    width: Math.max(Math.round(width), 200),
    shape: 'rectangular',
  });
};

const GoogleSignInHostInner = ({ children, googleClientId }) => {
  const { scriptLoadedSuccessfully } = useGoogleOAuth();
  const handlersRef = useRef({ onSuccess: null, onError: null });

  const registerHandlers = useCallback((handlers = {}) => {
    handlersRef.current = {
      onSuccess: handlers.onSuccess || null,
      onError: handlers.onError || null,
    };
    return () => {
      handlersRef.current = { onSuccess: null, onError: null };
    };
  }, []);

  useEffect(() => {
    if (!scriptLoadedSuccessfully || !googleClientId) return undefined;

    ensureGoogleIdentityInitialized(googleClientId, (credentialResponse) => {
      if (credentialResponse?.credential) {
        handlersRef.current.onSuccess?.(credentialResponse);
        return;
      }
      handlersRef.current.onError?.();
    });

    return undefined;
  }, [googleClientId, scriptLoadedSuccessfully]);

  const mountButton = useCallback((container, options = {}) => {
    if (!scriptLoadedSuccessfully || !googleClientId || !container) {
      return () => {};
    }

    ensureGoogleIdentityInitialized(googleClientId, (credentialResponse) => {
      if (credentialResponse?.credential) {
        handlersRef.current.onSuccess?.(credentialResponse);
        return;
      }
      handlersRef.current.onError?.();
    });

    renderGoogleButton(container, options);

    return () => {
      container.innerHTML = '';
    };
  }, [googleClientId, scriptLoadedSuccessfully]);

  return (
    <GoogleSignInContext.Provider value={{
      mountButton,
      registerHandlers,
      scriptLoadedSuccessfully,
    }}
    >
      {children}
    </GoogleSignInContext.Provider>
  );
};

const GoogleSignInHost = ({ children }) => {
  const { googleClientId, configLoaded } = usePublicConfig();

  if (!configLoaded || !googleClientId) return children;

  return (
    <GoogleSignInHostInner googleClientId={googleClientId}>
      {children}
    </GoogleSignInHostInner>
  );
};

export default GoogleSignInHost;
