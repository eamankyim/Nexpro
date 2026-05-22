/**
 * Empty state illustrations (shared with web via same source assets).
 * Keys align with Frontend EMPTY_STATE_IMAGES / microcopy imageKey.
 */
export const EMPTY_STATE_IMAGES = {
  CUSTOMERS: require('@/assets/empty-states/customers.png'),
  PRODUCTS: require('@/assets/empty-states/products.png'),
  EXPENSES: require('@/assets/empty-states/expenses.png'),
  INVOICES: require('@/assets/empty-states/invoices.png'),
  SALES: require('@/assets/empty-states/sales-no-sales-yet.png'),
  SALES_NO_PRODUCTS: require('@/assets/empty-states/sales-no-products.png'),
  LEADS: require('@/assets/empty-states/leads.png'),
  DELIVERIES: require('@/assets/empty-states/deliveries.png'),
  TASKS: require('@/assets/empty-states/tasks.png'),
  MATERIALS: require('@/assets/empty-states/equipment.png'),
  NOTIFICATIONS: require('@/assets/empty-states/notifications.png'),
  QUOTES: require('@/assets/empty-states/quotes.png'),
  VENDORS: require('@/assets/empty-states/vendors.png'),
  EMPLOYEES: require('@/assets/empty-states/employees.png'),
  EQUIPMENT: require('@/assets/empty-states/equipment.png'),
  PAYROLL: require('@/assets/empty-states/payroll.png'),
  REPORTS: require('@/assets/empty-states/reports.png'),
  SEARCH_NO_RESULTS: require('@/assets/empty-states/search-results.png'),
  REVIEWS: require('@/assets/empty-states/reviews.png'),
} as const;

export type EmptyStateImageKey = keyof typeof EMPTY_STATE_IMAGES;
