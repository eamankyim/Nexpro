import { useQuery } from '@tanstack/react-query';
import storeService from '../services/storeService';
import { STOREFRONT_URL } from '../config';

const ABS_STOREFRONT_HOSTS = new Set([
  'absghana.com',
  'www.absghana.com',
  'store.absghana.com',
  'africanbusinesssuite.com',
  'www.africanbusinesssuite.com',
  'store.africanbusinesssuite.com',
  'sabitostore.com',
  'www.sabitostore.com',
]);

/**
 * Hosts that always mean "shared marketplace / ABS template domain" — skip the domain lookup network
 * round-trip on the common paths (local dev, Vite preview, the configured storefront origin).
 */
const isKnownMarketplaceHost = (hostname) => {
  if (!hostname) return true;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
  if (ABS_STOREFRONT_HOSTS.has(hostname)) return true;
  try {
    if (hostname === new URL(STOREFRONT_URL).hostname) return true;
  } catch {
    // ignore malformed STOREFRONT_URL
  }
  return false;
};

/**
 * Resolves whether the storefront is currently loaded on a merchant's connected custom
 * domain ("Online Store" product) rather than the shared Sabito marketplace domain.
 * When matched, the app should render a single-store experience (no marketplace chrome,
 * `/` maps straight to that store) instead of the marketplace home/discovery pages.
 *
 * @returns {{ isLoading: boolean, matched: boolean, slug: string|null, launched: boolean, displayName: string|null }}
 */
export const useCustomDomainStore = () => {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const skip = isKnownMarketplaceHost(hostname);

  const { data, isLoading } = useQuery({
    queryKey: ['custom-domain-resolve', hostname],
    queryFn: () => storeService.resolveDomain(hostname),
    enabled: !skip,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  if (skip) {
    return { isLoading: false, matched: false, slug: null, launched: false, displayName: null };
  }

  const payload = data?.data?.data || data?.data || {};
  return {
    isLoading,
    matched: Boolean(payload.matched),
    slug: payload.slug || null,
    launched: Boolean(payload.launched),
    displayName: payload.displayName || null,
  };
};

export default useCustomDomainStore;
