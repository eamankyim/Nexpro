/** Route keys users may hide from the sidebar (optional items only). */
const CONFIGURABLE_SIDEBAR_KEYS = [
  'store',
  '/store',
  '/store/listings',
  '/store/services',
  '/store/orders',
  '/store/settings',
  'company-assets',
  '/materials',
  '/equipment',
  'advanced',
  '/reviews',
  '/deliveries',
  '/tasks',
  '/automations',
  '/leads',
  '/marketing',
  '/vendors',
  '/payroll',
  '/accounting',
  '/quotes',
  '/employees',
  '/shops',
  '/pharmacies',
  '/prescriptions',
  '/drugs',
  '/pricing',
  '/studio-locations',
  'reports',
  '/reports/overview',
  '/reports/smart-report',
  '/reports/compliance',
  '/export-data',
  '/users',
];

/** Core navigation items that must always remain visible. */
const LOCKED_SIDEBAR_KEYS = [
  '/dashboard',
  '/settings',
  '/profile',
  '/sales',
  '/orders',
  '/products',
  '/jobs',
  '/customers',
  '/invoices',
  '/expenses',
];

const CONFIGURABLE_KEY_SET = new Set(CONFIGURABLE_SIDEBAR_KEYS);
const LOCKED_KEY_SET = new Set(LOCKED_SIDEBAR_KEYS);

/**
 * Normalize stored hidden sidebar keys from user-tenant metadata.
 * @param {unknown} metadata - UserTenant.metadata
 * @returns {string[]}
 */
const getHiddenSidebarKeys = (metadata) => {
  const raw = metadata?.hiddenSidebarKeys;
  if (!Array.isArray(raw)) return [];
  return sanitizeHiddenSidebarKeys(raw);
};

/**
 * Keep only configurable keys; drop locked and unknown values.
 * @param {unknown} keys
 * @returns {string[]}
 */
const sanitizeHiddenSidebarKeys = (keys) => {
  if (!Array.isArray(keys)) return [];
  const seen = new Set();
  const result = [];
  for (const key of keys) {
    if (typeof key !== 'string') continue;
    const trimmed = key.trim();
    if (!trimmed || LOCKED_KEY_SET.has(trimmed) || !CONFIGURABLE_KEY_SET.has(trimmed)) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
};

/**
 * Build API payload for sidebar preferences.
 * @param {object|null|undefined} membership - UserTenant instance or plain object
 * @returns {{ hiddenSidebarKeys: string[] }}
 */
const getSidebarPreferences = (membership) => {
  const metadata =
    membership?.metadata && typeof membership.metadata === 'object'
      ? membership.metadata
      : {};
  return {
    hiddenSidebarKeys: getHiddenSidebarKeys(metadata),
  };
};

module.exports = {
  CONFIGURABLE_SIDEBAR_KEYS,
  LOCKED_SIDEBAR_KEYS,
  getHiddenSidebarKeys,
  sanitizeHiddenSidebarKeys,
  getSidebarPreferences,
};
