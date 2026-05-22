import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Persists dashboard-only banner dismissals per banner and scope.
 * @param {string} bannerKey - Stable banner identifier.
 * @param {string|null|undefined} scopeId - Tenant/user scope identifier.
 * @param {boolean} active - Whether the banner condition is currently active.
 * @returns {{ dismissed: boolean, dismiss: () => void }}
 */
export function useDismissibleDashboardBanner(bannerKey, scopeId, active = true) {
  const storageKey = useMemo(() => {
    if (!bannerKey || !scopeId) return null;
    return `dashboardBannerDismissed:${bannerKey}:${scopeId}`;
  }, [bannerKey, scopeId]);

  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!storageKey || !active || typeof window === 'undefined') {
      setDismissed(false);
      return;
    }
    setDismissed(localStorage.getItem(storageKey) === 'true');
  }, [storageKey, active]);

  const dismiss = useCallback(() => {
    if (!storageKey || typeof window === 'undefined') return;
    localStorage.setItem(storageKey, 'true');
    setDismissed(true);
  }, [storageKey]);

  return { dismissed, dismiss };
}

export default useDismissibleDashboardBanner;
