import { useEffect, useState, useCallback, useRef } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const REFRESH_PENDING_KEY = 'pwa-refresh-pending';
/** Must sit above react-toastify (z-index 9999) so Refresh stays clickable. */
const PROMPT_Z_INDEX = 10050;
const RELOAD_FALLBACK_MS = 200;

/**
 * Registers the PWA service worker (prod only) and shows a banner when a new version is available.
 * Uses manual registration so dev (no virtual:pwa-register) works without errors.
 */
export default function PWAUpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const registrationRef = useRef(null);
  const reloadFallbackRef = useRef(null);

  const clearReloadFallback = useCallback(() => {
    if (reloadFallbackRef.current != null) {
      window.clearTimeout(reloadFallbackRef.current);
      reloadFallbackRef.current = null;
    }
  }, []);

  const reloadNow = useCallback(() => {
    clearReloadFallback();
    sessionStorage.removeItem(REFRESH_PENDING_KEY);
    window.location.reload();
  }, [clearReloadFallback]);

  useEffect(() => {
    if (!import.meta.env.PROD || typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return undefined;
    }

    let intervalId;
    let cancelled = false;

    const onControllerChange = () => {
      // Avoid reload loops: only reload after user explicitly accepted refresh.
      if (sessionStorage.getItem(REFRESH_PENDING_KEY) === '1') {
        reloadNow();
      }
    };

    const onSwMessage = (event) => {
      if (event.data?.type === 'CHUNK_LOAD_FAILED') {
        setNeedRefresh(true);
      }
    };

    const watchWaiting = (registration) => {
      if (cancelled || !registration) return;
      if (registration.waiting) {
        setNeedRefresh(true);
      }
    };

    const onUpdateFound = (registration) => {
      const installing = registration.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          setNeedRefresh(true);
        }
      });
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    navigator.serviceWorker.addEventListener('message', onSwMessage);

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        if (cancelled) return;
        registrationRef.current = registration;
        registration.addEventListener('updatefound', () => onUpdateFound(registration));
        watchWaiting(registration);

        const checkUpdate = () => {
          const reg = registrationRef.current;
          if (!reg) return;
          watchWaiting(reg);
          reg.update?.().catch(() => {});
        };
        checkUpdate();
        intervalId = setInterval(checkUpdate, 60 * 60 * 1000);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      clearReloadFallback();
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      navigator.serviceWorker.removeEventListener('message', onSwMessage);
    };
  }, [clearReloadFallback, reloadNow]);

  const handleRefresh = useCallback(() => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    sessionStorage.setItem(REFRESH_PENDING_KEY, '1');

    const waiting = registrationRef.current?.waiting;
    // Always fall back to a hard reload so Refresh never appears dead if controllerchange never fires.
    clearReloadFallback();
    reloadFallbackRef.current = window.setTimeout(reloadNow, RELOAD_FALLBACK_MS);

    if (waiting) {
      try {
        waiting.postMessage({ type: 'SKIP_WAITING' });
      } catch {
        reloadNow();
      }
      return;
    }

    reloadNow();
  }, [clearReloadFallback, isRefreshing, reloadNow]);

  if (!needRefresh) return null;

  return (
    <div
      className="fixed bottom-4 right-4 flex flex-col gap-2 max-w-[280px] rounded-lg border border-gray-200 bg-white px-3 py-2.5"
      style={{ zIndex: PROMPT_Z_INDEX }}
      role="alert"
      aria-live="polite"
    >
      <span className="text-xs text-gray-600">
        A new version is available. Refresh to get the latest.
      </span>
      <div className="flex gap-2 justify-end">
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          disabled={isRefreshing}
          onClick={() => setNeedRefresh(false)}
        >
          Later
        </Button>
        <Button
          size="sm"
          className="h-8 text-xs bg-brand text-white hover:bg-brand-dark"
          disabled={isRefreshing}
          onClick={handleRefresh}
        >
          {isRefreshing ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
          )}
          {isRefreshing ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>
    </div>
  );
}
