import { useEffect, useRef } from 'react';

/**
 * Registers the PWA service worker (prod only) and applies waiting updates
 * silently (SKIP_WAITING). No toast/banner — new SW takes effect on the
 * next natural navigation/reload.
 */
export default function PWAUpdatePrompt() {
  const registrationRef = useRef(null);

  useEffect(() => {
    if (!import.meta.env.PROD || typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return undefined;
    }

    let intervalId;
    let cancelled = false;

    const activateWaiting = (registration) => {
      if (cancelled || !registration?.waiting) return;
      try {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      } catch {
        // Ignore — next page load will pick up the update.
      }
    };

    const onUpdateFound = (registration) => {
      const installing = registration.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          activateWaiting(registration);
        }
      });
    };

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        if (cancelled) return;
        registrationRef.current = registration;
        registration.addEventListener('updatefound', () => onUpdateFound(registration));
        activateWaiting(registration);

        const checkUpdate = () => {
          const reg = registrationRef.current;
          if (!reg) return;
          activateWaiting(reg);
          reg.update?.().catch(() => {});
        };
        checkUpdate();
        intervalId = setInterval(checkUpdate, 60 * 60 * 1000);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  return null;
}
