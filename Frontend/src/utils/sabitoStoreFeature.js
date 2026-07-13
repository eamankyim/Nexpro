/**
 * Whether merchant-facing Sabito Store UI is enabled in the ABS frontend.
 * Backend Sabito APIs and the separate storefront app are unaffected.
 * @returns {boolean}
 */
export function isSabitoStoreEnabled() {
  const raw = import.meta.env.VITE_SABITO_STORE_ENABLED?.trim().toLowerCase();
  return raw === 'true' || raw === '1';
}
