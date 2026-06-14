/**
 * Build marketplace product search URL with optional filters.
 * @param {{ search?: string, category?: string, storeSlug?: string }} params
 * @returns {string}
 */
export const buildProductsSearchPath = ({ search = '', category = '', storeSlug = '' } = {}) => {
  const params = new URLSearchParams();
  const trimmedSearch = String(search || '').trim();
  if (trimmedSearch) params.set('search', trimmedSearch);
  if (category && category !== 'all') params.set('category', category);
  if (storeSlug) params.set('storeSlug', storeSlug);
  const query = params.toString();
  return query ? `/products?${query}` : '/products';
};

/**
 * Build marketplace store search URL.
 * @param {string} search
 * @returns {string}
 */
export const buildStoresSearchPath = (search = '') => {
  const trimmed = String(search || '').trim();
  return trimmed ? `/stores?search=${encodeURIComponent(trimmed)}` : '/stores';
};

/**
 * Build marketplace service search URL with optional filters.
 * @param {{ search?: string, category?: string, studioSlug?: string }} params
 * @returns {string}
 */
export const buildServicesSearchPath = ({ search = '', category = '', studioSlug = '' } = {}) => {
  const params = new URLSearchParams();
  const trimmedSearch = String(search || '').trim();
  if (trimmedSearch) params.set('search', trimmedSearch);
  if (category && category !== 'all') params.set('category', category);
  if (studioSlug) params.set('studioSlug', studioSlug);
  const query = params.toString();
  return query ? `/services?${query}` : '/services';
};
