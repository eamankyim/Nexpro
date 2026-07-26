const normalizeOrigin = (value, fallback) => {
  const raw = String(value || fallback).trim() || fallback;
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProtocol.replace(/\/+$/g, '');
};

export const DASHBOARD_URL = normalizeOrigin(
  import.meta.env.VITE_DASHBOARD_URL,
  'http://localhost:3000',
);

/** ABS merchant app origin (template CTA deep-links). */
export const ABS_APP_URL = normalizeOrigin(
  import.meta.env.VITE_ABS_APP_URL || import.meta.env.VITE_DASHBOARD_URL,
  'http://localhost:3000',
);

export const STOREFRONT_URL = normalizeOrigin(
  import.meta.env.VITE_STOREFRONT_URL,
  typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3002',
);

/** Hostname for the public template gallery (templates.absghana.com). */
export const TEMPLATES_GALLERY_HOST = String(
  import.meta.env.VITE_TEMPLATES_HOST || 'templates.absghana.com',
).trim().toLowerCase().replace(/^https?:\/\//i, '').replace(/\/+$/g, '') || 'templates.absghana.com';

/**
 * True when the current page should render the template gallery as the site home.
 * @param {string} [hostname]
 */
export const isTemplatesGalleryHost = (hostname) => {
  const host = String(hostname || (typeof window !== 'undefined' ? window.location.hostname : '')).toLowerCase();
  if (!host) return false;
  if (host === TEMPLATES_GALLERY_HOST) return true;
  if (host.startsWith('templates.')) return true;
  return false;
};

export const dashboardLink = (path = '/') => `${DASHBOARD_URL}${path.startsWith('/') ? path : `/${path}`}`;
export const absAppLink = (path = '/') => `${ABS_APP_URL}${path.startsWith('/') ? path : `/${path}`}`;
