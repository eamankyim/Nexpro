const LOCAL_STOREFRONT_ORIGIN = 'http://localhost:3002';
const PRODUCTION_STOREFRONT_ORIGIN = 'https://www.absghana.com';

const getDefaultStorefrontOrigin = () => (
  import.meta.env.PROD ? PRODUCTION_STOREFRONT_ORIGIN : LOCAL_STOREFRONT_ORIGIN
);

const addProtocol = (url) => {
  if (/^https?:\/\//i.test(url)) return url;
  const localhostLike = /^(localhost|127(?:\.\d{1,3}){3}|192\.168\.)/i.test(url);
  return `${localhostLike ? 'http' : 'https'}://${url}`;
};

export const getStorefrontBaseUrl = () => {
  const defaultOrigin = getDefaultStorefrontOrigin();
  const configuredUrl = (
    import.meta.env.VITE_STOREFRONT_URL ||
    import.meta.env.VITE_PUBLIC_STORE_URL ||
    import.meta.env.VITE_PUBLIC_SITE_URL ||
    defaultOrigin
  );
  const trimmedUrl = String(configuredUrl || defaultOrigin).trim() || defaultOrigin;
  const withProtocol = addProtocol(trimmedUrl);
  return withProtocol.replace(/\/+$/g, '').replace(/\/stores?$/i, '');
};

export const buildStorefrontStoreUrl = (slug) => {
  if (!slug) return '';
  return `${getStorefrontBaseUrl()}/store/${encodeURIComponent(slug)}`;
};

export const buildStorefrontProductUrl = (storeSlug, productSlug) => {
  if (!storeSlug || !productSlug) return '';
  return `${buildStorefrontStoreUrl(storeSlug)}/products/${encodeURIComponent(productSlug)}`;
};

/** Base path for store URL inputs, without protocol (e.g. localhost:3002/store). */
export const getStorefrontDisplayBaseUrl = () => (
  `${getStorefrontBaseUrl().replace(/^https?:\/\//i, '')}/store`
);

/** Full public store path for display, without protocol (e.g. localhost:3002/store/my-shop). */
export const getStorefrontDisplayStoreUrl = (slug) => {
  if (!slug) return '';
  return buildStorefrontStoreUrl(slug).replace(/^https?:\/\//i, '');
};
