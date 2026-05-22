/** @typedef {Record<string, unknown>} ShopScopeParams */

export const ACTIVE_SHOP_STORAGE_KEY = 'activeShopId';

/**
 * Active shop id from localStorage (set by ShopContext).
 * @returns {string|null}
 */
export function getActiveShopIdForScope() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACTIVE_SHOP_STORAGE_KEY);
}

/**
 * Attach active shop to list/query params when not already set.
 * @param {ShopScopeParams} [params]
 * @returns {ShopScopeParams}
 */
export function withActiveShopScope(params = {}) {
  const activeShopId = getActiveShopIdForScope();
  if (!activeShopId || params.shopId) return params;
  return { ...params, shopId: activeShopId };
}

/**
 * Append shopId to URLSearchParams when scoped.
 * @param {URLSearchParams} searchParams
 * @returns {URLSearchParams}
 */
export function appendShopScopeToSearchParams(searchParams) {
  const activeShopId = getActiveShopIdForScope();
  if (activeShopId && !searchParams.has('shopId')) {
    searchParams.append('shopId', activeShopId);
  }
  return searchParams;
}

/**
 * Build query string from params with shop scope applied.
 * @param {ShopScopeParams} [params]
 * @returns {string}
 */
export function buildScopedQueryString(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(withActiveShopScope(params)).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    searchParams.append(key, String(value));
  });
  return searchParams.toString();
}
