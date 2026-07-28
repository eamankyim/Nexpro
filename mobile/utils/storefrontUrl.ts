import Constants from 'expo-constants';

const LOCAL_ONLINE_STORE_ORIGIN = 'http://localhost:3002';
/** ABS Online Store host (not Sabito marketplace, not marketing www). */
const PRODUCTION_ONLINE_STORE_ORIGIN = 'https://store.absghana.com';

const addProtocol = (url: string): string => {
  if (/^https?:\/\//i.test(url)) return url;
  const localhostLike = /^(localhost|127(?:\.\d{1,3}){3}|192\.168\.)/i.test(url);
  return `${localhostLike ? 'http' : 'https'}://${url}`;
};

const normalizeOrigin = (configuredUrl: string, defaultOrigin: string): string => {
  const trimmedUrl = String(configuredUrl || defaultOrigin).trim() || defaultOrigin;
  const withProtocol = addProtocol(trimmedUrl);
  return withProtocol.replace(/\/+$/g, '').replace(/\/(stores?|template|shop)$/i, '');
};

const getDefaultOnlineStoreOrigin = (): string => (
  __DEV__ ? LOCAL_ONLINE_STORE_ORIGIN : PRODUCTION_ONLINE_STORE_ORIGIN
);

/**
 * ABS Online Store origin. Prefers EXPO_PUBLIC_ONLINE_STORE_URL so Sabito /
 * marketing hosts do not leak into share / open / go-live links.
 */
export const getOnlineStoreBaseUrl = (): string => {
  const defaultOrigin = getDefaultOnlineStoreOrigin();
  const configured =
    process.env.EXPO_PUBLIC_ONLINE_STORE_URL
    || Constants.expoConfig?.extra?.onlineStoreUrl
    || defaultOrigin;
  return normalizeOrigin(String(configured), defaultOrigin);
};

/**
 * Hostnames that should never be treated as a merchant custom domain.
 */
const isReservedOnlineStoreHost = (host: string): boolean => {
  const h = String(host || '').trim().toLowerCase();
  return (
    h === 'store.absghana.com'
    || h === 'www.store.absghana.com'
    || h === 'absghana.com'
    || h === 'www.absghana.com'
    || h === 'sabitostore.com'
    || h === 'www.sabitostore.com'
    || h === 'templates.absghana.com'
    || h.endsWith('.absghana.com')
    || h.endsWith('.sabitostore.com')
  );
};

/**
 * Normalize a merchant custom domain to a bare hostname (no protocol/path).
 */
export const normalizeCustomDomainHost = (value: string | null | undefined): string => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const { hostname } = new URL(withProtocol);
    return hostname.replace(/\.$/, '') || '';
  } catch {
    return raw
      .replace(/^https?:\/\//i, '')
      .split('/')[0]
      .split('?')[0]
      .split('#')[0]
      .replace(/\.$/, '')
      .trim();
  }
};

/**
 * Prefer custom domain when connected (pending or verified). Pending is treated
 * as live when DNS already points at the store — same as web / CORS allowlist.
 */
export const shouldPreferCustomDomain = (
  customDomain: string | null | undefined,
  customDomainStatus: string | null | undefined
): boolean => {
  const host = normalizeCustomDomainHost(customDomain);
  if (!host || isReservedOnlineStoreHost(host)) return false;
  const status = String(customDomainStatus || '').trim().toLowerCase();
  return status === 'pending' || status === 'verified';
};

export type BuildOnlineStoreUrlOpts = {
  preview?: boolean;
  customDomain?: string | null;
  customDomainStatus?: string | null;
};

/**
 * Live Online Store (merchant shop) URL.
 * Prefers `https://{customDomain}` when pending|verified; else
 * `store.absghana.com/shop/:slug`.
 */
export const buildOnlineStoreUrl = (
  slug: string,
  opts: BuildOnlineStoreUrlOpts = {}
): string => {
  const { preview = false, customDomain, customDomainStatus } = opts;
  if (shouldPreferCustomDomain(customDomain, customDomainStatus)) {
    const host = normalizeCustomDomainHost(customDomain);
    const base = addProtocol(host).replace(/\/+$/g, '');
    return preview ? `${base}?preview=1` : base;
  }
  if (!slug) return '';
  const base = `${getOnlineStoreBaseUrl()}/shop/${encodeURIComponent(slug)}`;
  return preview ? `${base}?preview=1` : base;
};
