import { SEARCH_PLACEHOLDERS } from '@/constants/searchPlaceholders';
import type { PageSearchConfig } from '@/context/SmartSearchContext';

/** Tab routes that use a dedicated in-page search UI instead of the header. */
export const HEADER_SEARCH_HIDDEN_ROUTES = new Set(['index', 'more', 'chat', 'cart', 'scan']);

/** Default search config per tab route when a screen has not registered yet. */
export const TAB_ROUTE_SEARCH_DEFAULTS: Record<string, PageSearchConfig> = {
  customers: { scope: 'customers', placeholder: SEARCH_PLACEHOLDERS.CUSTOMERS },
  products: { scope: 'products', placeholder: SEARCH_PLACEHOLDERS.PRODUCTS },
  sales: { scope: 'sales', placeholder: SEARCH_PLACEHOLDERS.SALES },
  expenses: { scope: 'expenses', placeholder: SEARCH_PLACEHOLDERS.EXPENSES },
  invoices: { scope: 'invoices', placeholder: SEARCH_PLACEHOLDERS.INVOICES },
  quotes: { scope: 'quotes', placeholder: SEARCH_PLACEHOLDERS.QUOTES },
  leads: { scope: 'leads', placeholder: SEARCH_PLACEHOLDERS.LEADS },
  tasks: { scope: 'tasks', placeholder: SEARCH_PLACEHOLDERS.TASKS },
  deliveries: { scope: 'deliveries', placeholder: SEARCH_PLACEHOLDERS.DELIVERIES },
  jobs: { scope: 'jobs', placeholder: SEARCH_PLACEHOLDERS.JOBS },
  orders: { scope: 'orders', placeholder: SEARCH_PLACEHOLDERS.ORDERS },
  'online-orders': { scope: 'online-orders', placeholder: SEARCH_PLACEHOLDERS.ONLINE_ORDERS },
  store: { scope: 'store', placeholder: SEARCH_PLACEHOLDERS.GLOBAL },
  'store-services': { scope: 'store-services', placeholder: SEARCH_PLACEHOLDERS.GLOBAL },
};

export function getTabRouteSegment(pathname: string | null | undefined): string {
  if (!pathname) return '';
  const parts = pathname.split('/').filter(Boolean);
  const tabsIdx = parts.indexOf('(tabs)');
  if (tabsIdx >= 0 && parts[tabsIdx + 1]) return parts[tabsIdx + 1];
  return parts[parts.length - 1] ?? '';
}

export function resolveHeaderSearchConfig(
  pathname: string | null | undefined,
  pageConfig: PageSearchConfig | null
): PageSearchConfig | null {
  const segment = getTabRouteSegment(pathname);
  if (HEADER_SEARCH_HIDDEN_ROUTES.has(segment)) return null;
  if (pageConfig) {
    return pageConfig.enabled === false ? null : pageConfig;
  }
  return TAB_ROUTE_SEARCH_DEFAULTS[segment] ?? null;
}
