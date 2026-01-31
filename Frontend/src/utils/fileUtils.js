/**
 * File and image URL utilities for consistent display across the app.
 * Resolves relative paths (e.g. /uploads/...) to full URLs using the API base.
 */

import { API_BASE_URL } from '../services/api';

/**
 * Resolve an image or file URL for display (img src, download link, etc.).
 * - data: URLs (base64) and http(s) URLs are returned as-is.
 * - Relative paths (e.g. /uploads/products/...) are prefixed with API_BASE_URL.
 * @param {string|null|undefined} url - Raw URL from API (path, data URL, or absolute URL)
 * @returns {string} URL safe for use in img src or href
 */
export function resolveImageUrl(url) {
  if (!url || typeof url !== 'string') return '';
  if (url.startsWith('data:')) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (API_BASE_URL) {
    const path = url.startsWith('/') ? url : `/${url}`;
    return `${API_BASE_URL.replace(/\/$/, '')}${path}`;
  }
  return url;
}
