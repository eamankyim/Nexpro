import { createContext, useContext, useState, useEffect, useRef } from 'react';
import api from '../services/api';

const PublicConfigContext = createContext({
  googleClientId: '',
  selfSignupEnabled: true,
  configLoaded: false
});

/**
 * Fetches public config from backend (e.g. GOOGLE_CLIENT_ID) so the Google
 * sign-in button can be shown when the client ID is set only in Backend .env.
 */
const maskId = (id) => (id ? `${id.substring(0, 15)}...` : '(empty)');

export function PublicConfigProvider({ children }) {
  const envGoogleId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
  const [googleClientId, setGoogleClientId] = useState(envGoogleId);
  const [selfSignupEnabled, setSelfSignupEnabled] = useState(true);
  const [configLoaded, setConfigLoaded] = useState(false);

  useEffect(() => {
    console.log('[PublicConfig] env VITE_GOOGLE_CLIENT_ID:', maskId(envGoogleId), 'length=', envGoogleId.length);
    if (envGoogleId) {
      setConfigLoaded(true);
      console.log('[PublicConfig] using env client ID, button should show');
    }
    // Always fetch from API so backend GOOGLE_CLIENT_ID is used when env is missing (e.g. dev server not restarted)
    api
      .get('auth/config')
      .then((body) => {
        // api.js response interceptor returns axios response.data (unwrapped), not the full AxiosResponse
        const id = String(body?.googleClientId ?? body?.data?.googleClientId ?? '').trim();
        const selfSignupFlag = body?.selfSignupEnabled ?? body?.data?.selfSignupEnabled;
        console.log('[PublicConfig] API auth/config response:', maskId(id), 'length=', id.length);
        if (id) {
          setGoogleClientId(id);
          setConfigLoaded(true);
        }
        if (typeof selfSignupFlag !== 'undefined') {
          setSelfSignupEnabled(selfSignupFlag !== false);
        }
      })
      .catch((err) => {
        console.warn('[PublicConfig] auth/config fetch failed:', err?.message || err);
      })
      .finally(() => setConfigLoaded((c) => true));
  }, [envGoogleId]);

  const value = { googleClientId, selfSignupEnabled, configLoaded };
  const logged = useRef(false);
  useEffect(() => {
    if (configLoaded && !logged.current) {
      console.log(
        '[PublicConfig] providing googleClientId:',
        maskId(googleClientId),
        'selfSignupEnabled=',
        selfSignupEnabled,
        'configLoaded=',
        configLoaded
      );
      logged.current = true;
    }
  }, [configLoaded, googleClientId, selfSignupEnabled]);
  return (
    <PublicConfigContext.Provider value={value}>
      {children}
    </PublicConfigContext.Provider>
  );
}

export function usePublicConfig() {
  const context = useContext(PublicConfigContext);
  if (!context) {
    throw new Error('usePublicConfig must be used within PublicConfigProvider');
  }
  return context;
}
