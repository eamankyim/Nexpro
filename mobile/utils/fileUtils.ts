/**
 * File and image URL utilities for consistent display across the mobile app.
 * Resolves relative paths (e.g. /uploads/...) to full URLs using the API base.
 */

import { API_BASE_URL } from '../services/api';

/**
 * Decode HTML entities in URL (e.g. &#x2F; from backend sanitizer) so img src works.
 * @param url - URL that may contain &#x2F; etc.
 * @returns Decoded URL
 */
function decodeUrlEntities(url: string): string {
  if (!url || typeof url !== 'string') return url;
  return url.replace(/&#x2F;/gi, '/').replace(/&#47;/g, '/');
}

/**
 * Resolve an image or file URL for display (img src, download link, etc.).
 * - data: URLs (base64) and http(s) URLs are returned as-is.
 * - Relative paths (e.g. /uploads/products/...) are prefixed with API_BASE_URL.
 * - Decodes HTML entities (e.g. &#x2F;) that may come from backend sanitizer.
 * @param url - Raw URL from API (path, data URL, or absolute URL)
 * @returns URL safe for use in Image component
 */
export function resolveImageUrl(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') return '';
  const decoded = decodeUrlEntities(url);
  if (decoded.startsWith('data:')) return decoded;
  if (decoded.startsWith('http://') || decoded.startsWith('https://')) return decoded;
  if (API_BASE_URL) {
    const path = decoded.startsWith('/') ? decoded : `/${decoded}`;
    return `${API_BASE_URL.replace(/\/$/, '')}${path}`;
  }
  return decoded;
}
