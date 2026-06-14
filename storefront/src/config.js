const normalizeOrigin = (value, fallback) => {
  const raw = String(value || fallback).trim() || fallback;
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProtocol.replace(/\/+$/g, '');
};

export const DASHBOARD_URL = normalizeOrigin(
  import.meta.env.VITE_DASHBOARD_URL,
  'http://localhost:3000',
);

export const STOREFRONT_URL = normalizeOrigin(
  import.meta.env.VITE_STOREFRONT_URL,
  typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3002',
);

export const dashboardLink = (path = '/') => `${DASHBOARD_URL}${path.startsWith('/') ? path : `/${path}`}`;
