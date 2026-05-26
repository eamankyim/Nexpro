import type { QueryClient } from '@tanstack/react-query';

/**
 * Recommended stale times for mobile React Query screens.
 * Transactional data should stay fresh; metadata can cache longer.
 */
export const QUERY_STALE = {
  /** Sales, products, expenses, dashboard, orders */
  TRANSACTIONAL: 30 * 1000,
  /** List screens with search */
  LIST: 60 * 1000,
  /** Dropdowns, settings, access lists */
  METADATA: 5 * 60 * 1000,
  /** Rarely changing category catalogs */
  SLOW: 10 * 60 * 1000,
} as const;

type QueryKeyPrefix = readonly string[];

async function invalidatePrefixes(queryClient: QueryClient, prefixes: QueryKeyPrefix[]) {
  await Promise.all(
    prefixes.map((queryKey) => queryClient.invalidateQueries({ queryKey }))
  );
}

async function markPrefixesStale(queryClient: QueryClient, prefixes: QueryKeyPrefix[]) {
  await Promise.all(
    prefixes.map((queryKey) =>
      queryClient.invalidateQueries({ queryKey, refetchType: 'none' })
    )
  );
}

async function refetchActivePrefixes(queryClient: QueryClient, prefixes: QueryKeyPrefix[]) {
  await Promise.all(
    prefixes.map((queryKey) =>
      queryClient.refetchQueries({ queryKey, type: 'active' })
    )
  );
}

/**
 * Mark related queries stale and refetch any that are currently mounted.
 */
export async function refreshRelatedQueries(
  queryClient: QueryClient,
  prefixes: QueryKeyPrefix[]
) {
  await invalidatePrefixes(queryClient, prefixes);
  await refetchActivePrefixes(queryClient, prefixes);
}

/** POS checkout, offline sync, sale payment */
export async function refreshAfterSale(queryClient: QueryClient) {
  await invalidatePrefixes(queryClient, [
    ['sales'],
    ['sale'],
    ['products'],
    ['product'],
    ['dashboard'],
    ['orders'],
  ]);
}

/**
 * POS checkout should feel instant on mobile: mark dependent data stale, but do not
 * refetch mounted dashboard/products/sales screens immediately after POST /sales.
 */
export async function markAfterSaleStale(queryClient: QueryClient) {
  await markPrefixesStale(queryClient, [
    ['sale'],
    ['products'],
    ['product'],
    ['dashboard'],
    ['orders'],
  ]);
}

/** Expense create/update */
export async function refreshAfterExpense(queryClient: QueryClient) {
  await refreshRelatedQueries(queryClient, [['expenses'], ['expense'], ['dashboard']]);
}

/** Product create/update/delete */
export async function refreshAfterInventoryChange(queryClient: QueryClient) {
  await refreshRelatedQueries(queryClient, [
    ['products'],
    ['product'],
  ]);
  await markPrefixesStale(queryClient, [['dashboard']]);
}

/** Invoice payment / status */
export async function refreshAfterInvoicePayment(queryClient: QueryClient) {
  await refreshRelatedQueries(queryClient, [
    ['invoices'],
    ['invoice'],
    ['dashboard'],
  ]);
}

/** Quote status change */
export async function refreshAfterQuoteChange(queryClient: QueryClient) {
  await refreshRelatedQueries(queryClient, [['quotes'], ['quote'], ['dashboard']]);
}

/** Quote converted to job */
export async function refreshAfterQuoteToJob(queryClient: QueryClient) {
  await refreshRelatedQueries(queryClient, [
    ['quotes'],
    ['quote'],
    ['jobs'],
    ['job'],
    ['dashboard'],
  ]);
}

/** Job create / status */
export async function refreshAfterJobChange(queryClient: QueryClient) {
  await refreshRelatedQueries(queryClient, [['jobs'], ['job'], ['dashboard']]);
}

/** Customer create/update / find-or-create at checkout */
export async function refreshAfterCustomerChange(queryClient: QueryClient) {
  await refreshRelatedQueries(queryClient, [['customers'], ['customer']]);
}

/** Material create / restock */
export async function refreshAfterMaterialChange(queryClient: QueryClient) {
  await refreshRelatedQueries(queryClient, [['materials'], ['material']]);
}

/** Lead / task workspace updates */
export async function refreshAfterLeadChange(queryClient: QueryClient) {
  await refreshRelatedQueries(queryClient, [['leads'], ['lead']]);
}

export async function refreshAfterTaskChange(queryClient: QueryClient) {
  await refreshRelatedQueries(queryClient, [
    ['user-workspace', 'tasks'],
    ['user-workspace', 'task-detail'],
    ['user-workspace', 'task-comments'],
  ]);
}

/** Restaurant order status */
export async function refreshAfterOrderChange(queryClient: QueryClient) {
  await refreshRelatedQueries(queryClient, [['orders'], ['sales'], ['dashboard']]);
}
