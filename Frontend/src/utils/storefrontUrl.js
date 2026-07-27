const LOCAL_STOREFRONT_ORIGIN = 'http://localhost:3002';
/** Sabito marketplace host (not ABS Online Store). */
const PRODUCTION_STOREFRONT_ORIGIN = 'https://sabitostore.com';
/** ABS Online Store host (not Sabito marketplace, not marketing www). */
const PRODUCTION_ONLINE_STORE_ORIGIN = 'https://store.absghana.com';
const PRODUCTION_TEMPLATES_ORIGIN = 'https://templates.absghana.com';

const getDefaultStorefrontOrigin = () => (
  import.meta.env.PROD ? PRODUCTION_STOREFRONT_ORIGIN : LOCAL_STOREFRONT_ORIGIN
);

const getDefaultOnlineStoreOrigin = () => (
  import.meta.env.PROD ? PRODUCTION_ONLINE_STORE_ORIGIN : LOCAL_STOREFRONT_ORIGIN
);

const getDefaultTemplatesGalleryOrigin = () => (
  import.meta.env.PROD ? PRODUCTION_TEMPLATES_ORIGIN : LOCAL_STOREFRONT_ORIGIN
);

const addProtocol = (url) => {
  if (/^https?:\/\//i.test(url)) return url;
  const localhostLike = /^(localhost|127(?:\.\d{1,3}){3}|192\.168\.)/i.test(url);
  return `${localhostLike ? 'http' : 'https'}://${url}`;
};

const normalizeOrigin = (configuredUrl, defaultOrigin) => {
  const trimmedUrl = String(configuredUrl || defaultOrigin).trim() || defaultOrigin;
  const withProtocol = addProtocol(trimmedUrl);
  return withProtocol.replace(/\/+$/g, '').replace(/\/(stores?|template|shop)$/i, '');
};

export const getStorefrontBaseUrl = () => {
  const defaultOrigin = getDefaultStorefrontOrigin();
  const configuredUrl = (
    import.meta.env.VITE_STOREFRONT_URL ||
    import.meta.env.VITE_PUBLIC_STORE_URL ||
    import.meta.env.VITE_PUBLIC_SITE_URL ||
    defaultOrigin
  );
  return normalizeOrigin(configuredUrl, defaultOrigin);
};

/**
 * ABS Online Store origin. Prefers VITE_ONLINE_STORE_URL so Sabito's
 * VITE_STOREFRONT_URL (e.g. sabitostore.com) and marketing SITE_URL do not leak
 * into Online Store previews / live shop links.
 */
export const getOnlineStoreBaseUrl = () => {
  const defaultOrigin = getDefaultOnlineStoreOrigin();
  const configuredUrl = (
    import.meta.env.VITE_ONLINE_STORE_URL ||
    (import.meta.env.PROD ? defaultOrigin : (import.meta.env.VITE_STOREFRONT_URL || defaultOrigin))
  );
  return normalizeOrigin(configuredUrl, defaultOrigin);
};

/** @deprecated Use getOnlineStoreBaseUrl */
export const getOnlineStoreTemplateBaseUrl = getOnlineStoreBaseUrl;

/**
 * Public template gallery origin (templates.absghana.com).
 * Locally defaults to the storefront origin so /templates works on :3002.
 */
export const getTemplatesGalleryBaseUrl = () => {
  const defaultOrigin = getDefaultTemplatesGalleryOrigin();
  const configuredUrl = (
    import.meta.env.VITE_TEMPLATES_GALLERY_URL ||
    import.meta.env.VITE_ONLINE_STORE_URL ||
    (import.meta.env.PROD ? defaultOrigin : (import.meta.env.VITE_STOREFRONT_URL || defaultOrigin))
  );
  return normalizeOrigin(configuredUrl, defaultOrigin);
};

/** Sabito / shared marketplace store path: /store/:slug */
export const buildStorefrontStoreUrl = (slug) => {
  if (!slug) return '';
  return `${getStorefrontBaseUrl()}/store/${encodeURIComponent(slug)}`;
};

/**
 * Hostnames that should never be treated as a merchant custom domain.
 * @param {string} host
 * @returns {boolean}
 */
const isReservedOnlineStoreHost = (host) => {
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
 * @param {string} value
 * @returns {string}
 */
export const normalizeCustomDomainHost = (value) => {
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
 * as live when DNS already points at the store — same as CORS allowlist.
 * @param {string|null|undefined} customDomain
 * @param {string|null|undefined} customDomainStatus
 * @returns {boolean}
 */
export const shouldPreferCustomDomain = (customDomain, customDomainStatus) => {
  const host = normalizeCustomDomainHost(customDomain);
  if (!host || isReservedOnlineStoreHost(host)) return false;
  const status = String(customDomainStatus || '').trim().toLowerCase();
  return status === 'pending' || status === 'verified';
};

/**
 * Live Online Store (merchant shop) URL.
 * Prefers `https://{customDomain}` when a custom domain is pending|verified
 * (shop is served at `/` on owned domains). Falls back to
 * store.absghana.com/shop/:slug.
 *
 * @param {string} slug - Store slug (required when no usable custom domain)
 * @param {{
 *   preview?: boolean,
 *   customDomain?: string|null,
 *   customDomainStatus?: string|null,
 * }} [opts] - When preview is true, append ?preview=1 so draft stores can be
 *   opened from Store Setup.
 * @returns {string}
 * @example
 * buildOnlineStoreUrl('my-shop'); // https://store.absghana.com/shop/my-shop
 * buildOnlineStoreUrl('my-shop', { customDomain: 'www.gapconnects.com', customDomainStatus: 'verified' });
 * // https://www.gapconnects.com
 * buildOnlineStoreUrl('my-shop', { preview: true }); // .../shop/my-shop?preview=1
 */
export const buildOnlineStoreUrl = (slug, opts = {}) => {
  const { preview = false, customDomain, customDomainStatus } = opts;
  if (shouldPreferCustomDomain(customDomain, customDomainStatus)) {
    const host = normalizeCustomDomainHost(customDomain);
    const base = `${addProtocol(host)}`.replace(/\/+$/g, '');
    return preview ? `${base}?preview=1` : base;
  }
  if (!slug) return '';
  const base = `${getOnlineStoreBaseUrl()}/shop/${encodeURIComponent(slug)}`;
  return preview ? `${base}?preview=1` : base;
};

/** @deprecated Use buildOnlineStoreUrl — live shop is /shop/:slug, not a template */
export const buildOnlineStoreTemplateUrl = buildOnlineStoreUrl;

/**
 * Gallery listing URL.
 * @returns {string}
 */
export const buildStoreTemplatesGalleryUrl = () => `${getTemplatesGalleryBaseUrl()}/templates`;

/**
 * Demo preview for a visual template (sample brand).
 * @param {string} templateId
 * @returns {string}
 */
export const buildStoreTemplatePreviewUrl = (templateId) => {
  if (!templateId) return '';
  return `${getTemplatesGalleryBaseUrl()}/templates/${encodeURIComponent(templateId)}/preview`;
};

/**
 * Personalized preview iframe URL for ABS (tenant branding + sample products).
 * Pass only query-safe logo URLs (absolute http(s) or short paths).
 * Organization data: logos and oversized assets must be delivered via postMessage
 * from TemplatePreviewFrame — they will be truncated if stuffed into the query string.
 *
 * @param {string} templateId
 * @param {{
 *   businessName?: string,
 *   logoUrl?: string,
 *   primaryColor?: string,
 *   secondaryColor?: string,
 *   tertiaryColor?: string,
 *   description?: string,
 *   contactPhone?: string,
 *   whatsappNumber?: string,
 *   contactEmail?: string,
 *   currency?: string,
 * }} [opts]
 * @returns {string}
 */
export const buildStoreTemplateTenantPreviewUrl = (templateId, opts = {}) => {
  if (!templateId) return '';
  const params = new URLSearchParams();
  if (opts.businessName) params.set('businessName', opts.businessName);
  if (opts.logoUrl) params.set('logoUrl', opts.logoUrl);
  if (opts.primaryColor) params.set('primaryColor', opts.primaryColor);
  if (opts.secondaryColor) params.set('secondaryColor', opts.secondaryColor);
  if (opts.tertiaryColor) params.set('tertiaryColor', opts.tertiaryColor);
  if (opts.description) params.set('description', opts.description);
  if (opts.contactPhone) params.set('contactPhone', opts.contactPhone);
  if (opts.whatsappNumber) params.set('whatsappNumber', opts.whatsappNumber);
  if (opts.contactEmail) params.set('contactEmail', opts.contactEmail);
  if (opts.currency) params.set('currency', opts.currency);
  const qs = params.toString();
  return `${getTemplatesGalleryBaseUrl()}/templates/${encodeURIComponent(templateId)}/preview-tenant${qs ? `?${qs}` : ''}`;
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
