import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { QUERY_CACHE } from '../constants';
import storeService from '../services/storeService';

const PREFETCH_STALE_TIME = QUERY_CACHE.STALE_TIME_DEFAULT * 2;
const DEFAULT_PRODUCT_QUERY_KEY = ['marketplace', 'products', 'products', '', 'all', ''];

const scheduleWhenIdle = (callback) => {
  if (typeof window === 'undefined') return null;
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(callback, { timeout: 1800 });
    return () => window.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(callback, 900);
  return () => window.clearTimeout(id);
};

const prefetchQuery = (queryClient, options) => (
  queryClient.prefetchQuery({
    staleTime: PREFETCH_STALE_TIME,
    retry: false,
    ...options,
  }).catch(() => undefined)
);

const seedProductModeCaches = (queryClient, response) => {
  ['foods', 'deals', 'arrivals'].forEach((mode) => {
    queryClient.setQueryData(['marketplace', 'products', mode, '', 'all', ''], response);
  });
};

/**
 * Warms likely marketplace routes after the first paint so navigation does not
 * show avoidable loading states for data we can safely fetch in advance.
 */
export const useStorefrontBackgroundPrefetch = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    const cancelIdle = scheduleWhenIdle(() => {
      if (cancelled) return;

      prefetchQuery(queryClient, {
        queryKey: ['marketplace', 'home'],
        queryFn: () => storeService.getMarketplaceHome(),
      });

      prefetchQuery(queryClient, {
        queryKey: ['marketplace', 'categories'],
        queryFn: () => storeService.getMarketplaceCategories(),
      });

      prefetchQuery(queryClient, {
        queryKey: ['marketplace', 'service-categories'],
        queryFn: () => storeService.getMarketplaceServiceCategories(),
      });

      prefetchQuery(queryClient, {
        queryKey: ['marketplace', 'stores', ''],
        queryFn: () => storeService.getMarketplaceStores({ limit: 48 }),
      });

      prefetchQuery(queryClient, {
        queryKey: ['marketplace', 'studios', ''],
        queryFn: () => storeService.getMarketplaceStudios({ limit: 48 }),
      });

      prefetchQuery(queryClient, {
        queryKey: ['marketplace', 'services', '', 'all', ''],
        queryFn: () => storeService.getMarketplaceServices({ limit: 48 }),
      });

      queryClient.fetchQuery({
        queryKey: DEFAULT_PRODUCT_QUERY_KEY,
        queryFn: () => storeService.getMarketplaceProducts({ limit: 48 }),
        staleTime: PREFETCH_STALE_TIME,
        retry: false,
      })
        .then((response) => {
          if (!cancelled) seedProductModeCaches(queryClient, response);
        })
        .catch(() => undefined);
    });

    return () => {
      cancelled = true;
      cancelIdle?.();
    };
  }, [queryClient]);
};
