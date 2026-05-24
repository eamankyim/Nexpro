/**
 * Lazy-loaded empty-state illustrations (WebP with PNG fallback).
 * Keys match `imageKey` on entries in EMPTY_STATES (microcopy.js).
 */

const imageLoaders = {
  CUSTOMERS: () =>
    import('../assets/empty-states/customers.webp').then((m) => m.default).catch(() =>
      import('../assets/empty-states/customers.png').then((m) => m.default)
    ),
  PRODUCTS: () =>
    import('../assets/empty-states/products.webp').then((m) => m.default).catch(() =>
      import('../assets/empty-states/products.png').then((m) => m.default)
    ),
  EXPENSES: () =>
    import('../assets/empty-states/expenses.webp').then((m) => m.default).catch(() =>
      import('../assets/empty-states/expenses.png').then((m) => m.default)
    ),
  INVOICES: () =>
    import('../assets/empty-states/invoices.webp').then((m) => m.default).catch(() =>
      import('../assets/empty-states/invoices.png').then((m) => m.default)
    ),
  SALES: () =>
    import('../assets/empty-states/sales-no-sales-yet.webp').then((m) => m.default).catch(() =>
      import('../assets/empty-states/sales-no-sales-yet.png').then((m) => m.default)
    ),
  SALES_NO_PRODUCTS: () =>
    import('../assets/empty-states/sales-no-products.webp').then((m) => m.default).catch(() =>
      import('../assets/empty-states/sales-no-products.png').then((m) => m.default)
    ),
  LEADS: () =>
    import('../assets/empty-states/leads.webp').then((m) => m.default).catch(() =>
      import('../assets/empty-states/leads.png').then((m) => m.default)
    ),
  DELIVERIES: () =>
    import('../assets/empty-states/deliveries.webp').then((m) => m.default).catch(() =>
      import('../assets/empty-states/deliveries.png').then((m) => m.default)
    ),
  TASKS: () =>
    import('../assets/empty-states/tasks.webp').then((m) => m.default).catch(() =>
      import('../assets/empty-states/tasks.png').then((m) => m.default)
    ),
  JOBS: () =>
    import('../assets/empty-states/tasks.webp').then((m) => m.default).catch(() =>
      import('../assets/empty-states/tasks.png').then((m) => m.default)
    ),
  MATERIALS: () =>
    import('../assets/empty-states/materials.webp').then((m) => m.default).catch(() =>
      import('../assets/empty-states/materials.png').then((m) => m.default)
    ),
  NOTIFICATIONS: () =>
    import('../assets/empty-states/notifications.webp').then((m) => m.default).catch(() =>
      import('../assets/empty-states/notifications.png').then((m) => m.default)
    ),
  QUOTES: () =>
    import('../assets/empty-states/quotes.webp').then((m) => m.default).catch(() =>
      import('../assets/empty-states/quotes.png').then((m) => m.default)
    ),
  VENDORS: () =>
    import('../assets/empty-states/vendors.webp').then((m) => m.default).catch(() =>
      import('../assets/empty-states/vendors.png').then((m) => m.default)
    ),
  EMPLOYEES: () =>
    import('../assets/empty-states/employees.webp').then((m) => m.default).catch(() =>
      import('../assets/empty-states/employees.png').then((m) => m.default)
    ),
  EQUIPMENT: () =>
    import('../assets/empty-states/equipment.webp').then((m) => m.default).catch(() =>
      import('../assets/empty-states/equipment.png').then((m) => m.default)
    ),
  STUDIO_LOCATIONS: () =>
    import('../assets/empty-states/vendors.webp').then((m) => m.default).catch(() =>
      import('../assets/empty-states/vendors.png').then((m) => m.default)
    ),
  PRICING_TEMPLATES: () =>
    import('../assets/empty-states/quotes.webp').then((m) => m.default).catch(() =>
      import('../assets/empty-states/quotes.png').then((m) => m.default)
    ),
  PAYROLL: () =>
    import('../assets/empty-states/payroll.webp').then((m) => m.default).catch(() =>
      import('../assets/empty-states/payroll.png').then((m) => m.default)
    ),
  REPORTS: () =>
    import('../assets/empty-states/reports.webp').then((m) => m.default).catch(() =>
      import('../assets/empty-states/reports.png').then((m) => m.default)
    ),
  SEARCH_NO_RESULTS: () =>
    import('../assets/empty-states/search-results.webp').then((m) => m.default).catch(() =>
      import('../assets/empty-states/search-results.png').then((m) => m.default)
    ),
  REVIEWS: () =>
    import('../assets/empty-states/reviews.webp').then((m) => m.default).catch(() =>
      import('../assets/empty-states/reviews.png').then((m) => m.default)
    ),
};

const urlCache = new Map();

/**
 * Load empty-state image URL by key (cached after first load).
 * @param {string} imageKey
 * @returns {Promise<string|null>}
 */
export async function loadEmptyStateImage(imageKey) {
  if (!imageKey || !imageLoaders[imageKey]) return null;
  if (urlCache.has(imageKey)) return urlCache.get(imageKey);
  const url = await imageLoaders[imageKey]();
  urlCache.set(imageKey, url);
  return url;
}

export { imageLoaders };
