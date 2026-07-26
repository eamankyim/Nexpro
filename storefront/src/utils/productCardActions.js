/** Allowed Online Store product card CTAs (metadata.productCardActions). */
export const PRODUCT_CARD_ACTION_ALLOWLIST = new Set([
  'view',
  'add_to_cart',
  'buy_now',
  'contact_for_price',
  'whatsapp',
]);

export const DEFAULT_PRODUCT_CARD_ACTIONS = ['view', 'add_to_cart'];
export const MAX_PRODUCT_CARD_ACTIONS = 2;

/**
 * Sanitize product card CTA list (unique, allowlisted, length 1–2).
 * @param {unknown} value
 * @returns {string[]}
 */
export const sanitizeProductCardActions = (value) => {
  const raw = Array.isArray(value) ? value : [];
  const seen = new Set();
  const actions = [];
  raw.forEach((entry) => {
    const key = String(entry || '').trim().toLowerCase();
    if (!PRODUCT_CARD_ACTION_ALLOWLIST.has(key) || seen.has(key)) return;
    seen.add(key);
    actions.push(key);
  });
  if (!actions.length) return [...DEFAULT_PRODUCT_CARD_ACTIONS];
  return actions.slice(0, MAX_PRODUCT_CARD_ACTIONS);
};

/**
 * Resolve configured actions for a store/product card, hiding WA when no phone.
 * @param {unknown} configured
 * @param {{ whatsappNumber?: string|null, contactPhone?: string|null }|null|undefined} store
 * @param {{ resolvePhone?: (store: object) => string }} [options]
 * @returns {string[]}
 */
export const resolveVisibleProductCardActions = (configured, store, { resolvePhone } = {}) => {
  const actions = sanitizeProductCardActions(configured);
  const phone = typeof resolvePhone === 'function'
    ? resolvePhone(store)
    : String(store?.whatsappNumber || store?.contactPhone || '').replace(/[^\d]/g, '');
  const visible = actions.filter((action) => {
    if (action === 'whatsapp' || action === 'contact_for_price') return Boolean(phone);
    return true;
  }).slice(0, MAX_PRODUCT_CARD_ACTIONS);
  return visible.length ? visible : [...DEFAULT_PRODUCT_CARD_ACTIONS];
};
