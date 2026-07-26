import { useQuery } from '@tanstack/react-query';
import storeService from '../services/storeService';
import {
  isAbsOnlineStoreHost,
  isTemplatesGalleryHost,
  STOREFRONT_URL,
} from '../config';

/** Sabito marketplace shared hosts — skip custom-domain lookup. */
const MARKETPLACE_SHARED_HOSTS = new Set([
  'sabitostore.com',
  'www.sabitostore.com',
]);

/** ABS Online Store shared hosts (not marketing www) — skip custom-domain lookup. */
const ABS_ONLINE_STORE_HOSTS = new Set([
  'store.absghana.com',
  'www.store.absghana.com',
  'store.africanbusinesssuite.com',
]);

/**
 * Platform hosts that are never a merchant custom domain (marketing apex, etc.).
 * Kept so a mis-pointed DNS does not trigger resolveDomain round-trips.
 */
const PLATFORM_SKIP_HOSTS = new Set([
  'absghana.com',
  'www.absghana.com',
  'africanbusinesssuite.com',
  'www.africanbusinesssuite.com',
]);

/**
 * Hosts that always mean "shared platform domain" — skip the domain lookup network
 * round-trip on the common paths (local dev, Vite preview, configured storefront origin).
 */
const isKnownSharedStorefrontHost = (hostname) => {
  if (!hostname) return true;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
  if (isTemplatesGalleryHost(hostname)) return true;
  if (isAbsOnlineStoreHost(hostname)) return true;
  if (ABS_ONLINE_STORE_HOSTS.has(hostname)) return true;
  if (MARKETPLACE_SHARED_HOSTS.has(hostname)) return true;
  if (PLATFORM_SKIP_HOSTS.has(hostname)) return true;
  try {
    if (hostname === new URL(STOREFRONT_URL).hostname) return true;
  } catch {
    // ignore malformed STOREFRONT_URL
  }
  return false;
};

/**
 * Resolves whether the storefront is currently loaded on a merchant's connected custom
 * domain ("Online Store" product) rather than the shared Sabito marketplace / ABS Online Store host.
 * When matched, the app should render a single-store experience (no marketplace chrome,
 * `/` maps straight to that store) instead of the marketplace home/discovery pages.
 * Template gallery host (`templates.*`) is never treated as a custom store domain.
 * ABS Online Store host (`store.absghana.com`) stays on the shared SPA (path-based /shop/:slug).
 *
 * @returns {{
 *   isLoading: boolean,
 *   matched: boolean,
 *   slug: string|null,
 *   launched: boolean,
 *   displayName: string|null,
 *   isTemplatesHost: boolean,
 *   isAbsOnlineStoreHost: boolean,
 * }}
 */
export const useCustomDomainStore = () => {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isTemplatesHost = isTemplatesGalleryHost(hostname);
  const onAbsOnlineStoreHost = isAbsOnlineStoreHost(hostname) || ABS_ONLINE_STORE_HOSTS.has(hostname);
  const skip = isKnownSharedStorefrontHost(hostname);

  const { data, isLoading } = useQuery({
    queryKey: ['custom-domain-resolve', hostname],
    queryFn: () => storeService.resolveDomain(hostname),
    enabled: !skip,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  if (skip) {
    return {
      isLoading: false,
      matched: false,
      slug: null,
      launched: false,
      displayName: null,
      isTemplatesHost,
      isAbsOnlineStoreHost: onAbsOnlineStoreHost,
    };
  }

  const payload = data?.data?.data || data?.data || {};
  return {
    isLoading,
    matched: Boolean(payload.matched),
    slug: payload.slug || null,
    launched: Boolean(payload.launched),
    displayName: payload.displayName || null,
    isTemplatesHost: false,
    isAbsOnlineStoreHost: false,
  };
};

export default useCustomDomainStore;
