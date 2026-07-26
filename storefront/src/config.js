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

/** Hostname for ABS Online Store shared SPA (store.absghana.com) — not marketing www. */
export const ABS_ONLINE_STORE_HOST = String(
  import.meta.env.VITE_ONLINE_STORE_HOST
  || (import.meta.env.VITE_ONLINE_STORE_URL
    ? String(import.meta.env.VITE_ONLINE_STORE_URL).replace(/^https?:\/\//i, '').replace(/\/+$/g, '').split('/')[0]
    : '')
  || 'store.absghana.com',
).trim().toLowerCase().replace(/^https?:\/\//i, '').replace(/\/+$/g, '') || 'store.absghana.com';

/** Hostname for the public template gallery (templates.absghana.com). */
export const TEMPLATES_GALLERY_HOST = String(
  import.meta.env.VITE_TEMPLATES_HOST || 'templates.absghana.com',
).trim().toLowerCase().replace(/^https?:\/\//i, '').replace(/\/+$/g, '') || 'templates.absghana.com';

/**
 * True when this host is the ABS Online Store shared storefront (not marketing, not Sabito).
 * Path-based `/shop/:slug` mode applies; do not force marketplace chrome for Online Store routes.
 * @param {string} [hostname]
 */
export const isAbsOnlineStoreHost = (hostname) => {
  const host = String(hostname || (typeof window !== 'undefined' ? window.location.hostname : '')).toLowerCase();
  if (!host) return false;
  if (host === ABS_ONLINE_STORE_HOST) return true;
  if (host === `www.${ABS_ONLINE_STORE_HOST}`) return true;
  if (host === 'store.absghana.com' || host === 'www.store.absghana.com') return true;
  if (host === 'store.africanbusinesssuite.com') return true;
  return false;
};

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
