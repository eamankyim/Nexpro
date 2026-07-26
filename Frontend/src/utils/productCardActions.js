/** Allowed Online Store product card CTAs (metadata.productCardActions). */
export const PRODUCT_CARD_ACTIONS = [
  { id: 'view', label: 'View', shortLabel: 'View' },
  { id: 'add_to_cart', label: 'Add to cart', shortLabel: 'Add' },
  { id: 'buy_now', label: 'Buy now', shortLabel: 'Buy now' },
  { id: 'contact_for_price', label: 'Contact for price', shortLabel: 'Price' },
  { id: 'whatsapp', label: 'WhatsApp', shortLabel: 'WhatsApp' },
];

export const PRODUCT_CARD_ACTION_IDS = PRODUCT_CARD_ACTIONS.map((item) => item.id);
export const DEFAULT_PRODUCT_CARD_ACTIONS = ['view', 'add_to_cart'];
export const MAX_PRODUCT_CARD_ACTIONS = 2;

const ALLOWLIST = new Set(PRODUCT_CARD_ACTION_IDS);

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
    if (!ALLOWLIST.has(key) || seen.has(key)) return;
    seen.add(key);
    actions.push(key);
  });
  if (!actions.length) return [...DEFAULT_PRODUCT_CARD_ACTIONS];
  return actions.slice(0, MAX_PRODUCT_CARD_ACTIONS);
};

/**
 * @param {string} id
 * @returns {{ id: string, label: string, shortLabel: string } | undefined}
 */
export const getProductCardActionMeta = (id) => (
  PRODUCT_CARD_ACTIONS.find((item) => item.id === id)
);
