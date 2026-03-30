import { useEffect, useState, useCallback, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Registers the PWA service worker (prod only) and shows a banner when a new version is available.
 * Uses manual registration so dev (no virtual:pwa-register) works without errors.
 */
export default function PWAUpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const registrationRef = useRef(null);
  const REFRESH_PENDING_KEY = 'pwa-refresh-pending';

  useEffect(() => {
    if (!import.meta.env.PROD || typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }
    let intervalId;
    const onControllerChange = () => {
      // Avoid reload loops: only reload after user explicitly accepted refresh.
      if (sessionStorage.getItem(REFRESH_PENDING_KEY) === '1') {
        sessionStorage.removeItem(REFRESH_PENDING_KEY);
        window.location.reload();
      }
    };

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        registrationRef.current = registration;
        navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

        const checkUpdate = () => {
          const reg = registrationRef.current;
          if (reg?.waiting) setNeedRefresh(true);
          else reg?.update?.();
        };
        checkUpdate();
        intervalId = setInterval(checkUpdate, 60 * 60 * 1000);
      })
      .catch(() => {});

    return () => {
      clearInterval(intervalId);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  const handleRefresh = useCallback(() => {
    const reg = registrationRef.current;
    sessionStorage.setItem(REFRESH_PENDING_KEY, '1');
    if (reg?.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
      window.location.reload();
    }
  }, [REFRESH_PENDING_KEY]);

  if (!needRefresh) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-[280px] rounded-lg border border-gray-200 bg-white px-3 py-2.5"
      role="alert"
      aria-live="polite"
    >
      <span className="text-xs text-gray-600">
        A new version is available. Refresh to get the latest.
      </span>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setNeedRefresh(false)}>
          Later
        </Button>
        <Button
          size="sm"
          className="h-8 text-xs bg-brand text-white hover:bg-brand-dark"
          onClick={handleRefresh}
        >
          <RefreshCw className="mr-1 h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>
    </div>
  );
}
