import { useState, useEffect } from 'react';
import { api } from '@/services/api';

export function usePublicConfig() {
  const [googleClientId, setGoogleClientId] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/auth/config')
      .then((res) => {
        if (cancelled) return;
        const id = (res?.data?.googleClientId ?? '').trim();
        setGoogleClientId(id);
      })
      .catch(() => {
        if (!cancelled) setGoogleClientId('');
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { googleClientId, configLoaded: loaded };
}
