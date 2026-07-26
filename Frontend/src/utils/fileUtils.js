/**
 * File and image URL utilities for consistent display across the app.
 * Resolves relative paths (e.g. /uploads/...) to full URLs using the API base.
 */

import { API_BASE_URL } from '../services/api';

/**
 * Soft cap for image URLs embedded in iframe query strings.
 * Organization logos are often data: URLs (100KB+) and get truncated in iframe src.
 */
export const PREVIEW_QUERY_IMAGE_MAX_LENGTH = 1800;

/**
 * Decode HTML entities in URL (e.g. &#x2F; from backend sanitizer) so img src works.
 * @param {string} url - URL that may contain &#x2F; etc.
 * @returns {string}
 */
function decodeUrlEntities(url) {
  if (!url || typeof url !== 'string') return url;
  return url
    .replace(/&#x2F;/gi, '/')
    .replace(/&#47;/g, '/');
}

/**
 * Resolve an image or file URL for display (img src, download link, etc.).
 * - data: URLs (base64) and http(s) URLs are returned as-is.
 * - Relative paths (e.g. /uploads/products/...) are prefixed with API_BASE_URL.
 * - When API_BASE_URL is empty (Vite proxy mode), host-relative paths stay relative
 *   so same-origin pages (Organization, Store Setup) keep working via the proxy.
 * - Decodes HTML entities (e.g. &#x2F;) that may come from backend sanitizer.
 * @param {string|null|undefined} url - Raw URL from API (path, data URL, or absolute URL)
 * @returns {string} URL safe for use in img src or href
 */
export function resolveImageUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const decoded = decodeUrlEntities(url.trim());
  if (!decoded) return '';
  if (decoded.startsWith('data:')) return decoded;
  if (decoded.startsWith('blob:')) return decoded;
  if (decoded.startsWith('http://') || decoded.startsWith('https://')) return decoded;
  if (API_BASE_URL) {
    const path = decoded.startsWith('/') ? decoded : `/${decoded}`;
    return `${API_BASE_URL.replace(/\/$/, '')}${path}`;
  }
  return decoded.startsWith('/') ? decoded : `/${decoded}`;
}

/**
 * Absolute asset URL for cross-origin consumers (storefront iframe on :3002).
 * In Vite proxy mode API_BASE_URL is '', so relative /uploads/... must be expanded
 * to the ABS app origin (which proxies /uploads to the backend).
 *
 * @param {string|null|undefined} url
 * @returns {string}
 * @example
 * toAbsoluteAssetUrl('/uploads/logo.png'); // http://localhost:3000/uploads/logo.png
 */
export function toAbsoluteAssetUrl(url) {
  const resolved = resolveImageUrl(url);
  if (!resolved) return '';
  if (
    resolved.startsWith('data:') ||
    resolved.startsWith('blob:') ||
    resolved.startsWith('http://') ||
    resolved.startsWith('https://')
  ) {
    return resolved;
  }
  if (resolved.startsWith('/') && typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${resolved}`;
  }
  return resolved;
}

/**
 * Image URL safe to embed in a storefront iframe query string.
 * Returns '' for data:/blob: URLs and oversized values — those must use postMessage.
 *
 * @param {string|null|undefined} url
 * @returns {string}
 */
export function toPreviewQueryImageUrl(url) {
  const absolute = toAbsoluteAssetUrl(url);
  if (!absolute) return '';
  if (absolute.startsWith('data:') || absolute.startsWith('blob:')) return '';
  if (absolute.length > PREVIEW_QUERY_IMAGE_MAX_LENGTH) return '';
  return absolute;
}
