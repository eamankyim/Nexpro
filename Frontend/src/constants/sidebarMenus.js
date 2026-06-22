/** Core navigation items that must always remain visible in the sidebar. */
export const LOCKED_SIDEBAR_KEYS = [
  '/dashboard',
  '/settings',
  '/profile',
  '/sales',
  '/orders',
  '/products',
  '/jobs',
  '/customers',
  '/dealers',
  '/invoices',
  '/expenses',
];

/** Optional sidebar route keys users may hide. */
export const CONFIGURABLE_SIDEBAR_KEYS = [
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

const LOCKED_KEY_SET = new Set(LOCKED_SIDEBAR_KEYS);
const CONFIGURABLE_KEY_SET = new Set(CONFIGURABLE_SIDEBAR_KEYS);

/**
 * Grouped sidebar menu options for the Settings UI.
 * @type {Array<{ id: string, label: string, items: Array<{ key: string, label: string, description?: string, managerOnly?: boolean }> }>}
 */
export const SIDEBAR_MENU_GROUPS = [
  {
    id: 'store',
    label: 'Online store',
    items: [
      { key: 'store', label: 'Store section', description: 'Hide the entire store menu group' },
      { key: '/store', label: 'Store dashboard' },
      { key: '/store/listings', label: 'Store listings' },
      { key: '/store/services', label: 'Studio services' },
      { key: '/store/orders', label: 'Online orders' },
      { key: '/store/settings', label: 'Store settings', managerOnly: true },
    ],
  },
  {
    id: 'assets',
    label: 'Assets',
    items: [
      { key: 'company-assets', label: 'Assets section', description: 'Hide the entire assets menu group' },
      { key: '/materials', label: 'Materials' },
      { key: '/equipment', label: 'Equipment' },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { key: 'advanced', label: 'Advanced section', description: 'Hide the entire advanced menu group' },
      { key: '/reviews', label: 'Reviews' },
      { key: '/deliveries', label: 'Deliveries' },
      { key: '/tasks', label: 'Tasks' },
      { key: '/automations', label: 'Automations', managerOnly: true },
      { key: '/leads', label: 'Leads' },
      { key: '/marketing', label: 'Marketing', managerOnly: true },
      { key: '/vendors', label: 'Vendors' },
      { key: '/dealers', label: 'Dealers' },
      { key: '/quotes', label: 'Quotes' },
      { key: '/shops', label: 'Shops', managerOnly: true },
      { key: '/pharmacies', label: 'Pharmacies' },
      { key: '/prescriptions', label: 'Prescriptions' },
      { key: '/drugs', label: 'Drugs' },
      { key: '/pricing', label: 'Pricing' },
      { key: '/studio-locations', label: 'Studios', managerOnly: true },
      { key: '/employees', label: 'Employees', managerOnly: true },
    ],
  },
  {
    id: 'finance',
    label: 'Finance & HR',
    items: [
      { key: '/payroll', label: 'Payroll', managerOnly: true },
      { key: '/accounting', label: 'Accounting', managerOnly: true },
    ],
  },
  {
    id: 'reports',
    label: 'Data & reports',
    items: [
      { key: 'reports', label: 'Data & Reports section', description: 'Hide the entire reports menu group' },
      { key: '/reports/overview', label: 'Overview', managerOnly: true },
      { key: '/reports/smart-report', label: 'Smart report', managerOnly: true },
      { key: '/reports/compliance', label: 'Compliance', managerOnly: true },
      { key: '/export-data', label: 'Export data', managerOnly: true },
      { key: '/users', label: 'Users', managerOnly: true },
    ],
  },
];

/**
 * Remove hidden keys from nav items; locked keys are never removed.
 * @param {Array} items - Sidebar nav items
 * @param {string[]} hiddenKeys - Keys to hide
 * @returns {Array}
 */
export const filterHiddenNavItems = (items, hiddenKeys = []) => {
  if (!Array.isArray(items) || !hiddenKeys?.length) return items;
  const hidden = new Set(
    hiddenKeys.filter((key) => typeof key === 'string' && !LOCKED_KEY_SET.has(key))
  );
  if (!hidden.size) return items;

  const filterList = (list) =>
    list
      .filter((item) => !hidden.has(item.key) || LOCKED_KEY_SET.has(item.key))
      .map((item) => {
        if (!item.children?.length) return item;
        const children = filterList(item.children);
        return { ...item, children };
      })
      .filter((item) => !item.children || item.children.length > 0);

  return filterList(items);
};

/**
 * @param {string[]} hiddenKeys
 * @returns {boolean}
 */
export const isSidebarKeyHidden = (hiddenKeys, key) => {
  if (!key || LOCKED_KEY_SET.has(key)) return false;
  return Array.isArray(hiddenKeys) && hiddenKeys.includes(key);
};

/**
 * @param {unknown} keys
 * @returns {string[]}
 */
export const sanitizeHiddenSidebarKeys = (keys) => {
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
