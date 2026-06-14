import { API_BASE_URL } from '../services/api';

function decodeUrlEntities(url) {
  if (!url || typeof url !== 'string') return url;
  return url
    .replace(/&#x2F;/gi, '/')
    .replace(/&#47;/g, '/');
}

export function resolveImageUrl(url) {
  if (url == null) return '';
  if (typeof url === 'object') {
    return resolveImageUrl(url.url);
  }
  if (typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  const decoded = decodeUrlEntities(trimmed);
  if (decoded.startsWith('data:')) return decoded;
  if (decoded.startsWith('blob:')) return decoded;
  if (decoded.startsWith('http://') || decoded.startsWith('https://')) return decoded;
  const path = decoded.startsWith('/') ? decoded : `/${decoded}`;
  if (API_BASE_URL) {
    return `${API_BASE_URL.replace(/\/$/, '')}${path}`;
  }
  return path;
}

/**
 * Resolve a store hero/banner image from common API field names.
 * @param {object|null|undefined} store
 * @returns {string}
 */
export function resolveStoreBannerImageUrl(store) {
  if (!store || typeof store !== 'object') return '';
  const metadata = store.metadata && typeof store.metadata === 'object' ? store.metadata : {};
  const candidates = [
    store.bannerImageUrl,
    store.bannerUrl,
    store.heroImageUrl,
    store.coverImageUrl,
    metadata.bannerImageUrl,
    metadata.bannerUrl,
    metadata.heroImageUrl,
    metadata.coverImageUrl,
  ];
  const raw = candidates.find((value) => typeof value === 'string' && value.trim());
  return raw ? resolveImageUrl(raw) : '';
}
