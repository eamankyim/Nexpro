/**
 * File and image URL utilities for consistent display across the app.
 * Resolves relative paths (e.g. /uploads/...) to full URLs using the API base.
 */

import { API_BASE_URL } from '../services/api';

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
 * - Decodes HTML entities (e.g. &#x2F;) that may come from backend sanitizer.
 * @param {string|null|undefined} url - Raw URL from API (path, data URL, or absolute URL)
 * @returns {string} URL safe for use in img src or href
 */
export function resolveImageUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const decoded = decodeUrlEntities(url);
  if (decoded.startsWith('data:')) return decoded;
  if (decoded.startsWith('blob:')) return decoded;
  if (decoded.startsWith('http://') || decoded.startsWith('https://')) return decoded;
  if (API_BASE_URL) {
    const path = decoded.startsWith('/') ? decoded : `/${decoded}`;
    return `${API_BASE_URL.replace(/\/$/, '')}${path}`;
  }
  return decoded;
}
