/**
 * Shared React Query invalidation helpers for web.
 * Keep prefixes broad enough to catch page-specific keys, but avoid full-cache invalidation.
 */

export const QUERY_STALE = {
  TRANSACTIONAL: 30 * 1000,
  LIST: 60 * 1000,
  METADATA: 5 * 60 * 1000,
  SLOW: 10 * 60 * 1000,
};

const SCOPED_WORKSPACE_PREFIXES = [
  ['customers'],
  ['customer'],
  ['sales'],
  ['sale'],
  ['products'],
  ['product'],
  ['expenses'],
  ['expense'],
  ['dashboard'],
  ['orders'],
  ['jobs'],
  ['job'],
  ['quotes'],
  ['quote'],
  ['invoices'],
  ['invoice'],
  ['leads'],
  ['lead'],
  ['deliveries-queue'],
  ['store', 'online-orders'],
  ['store', 'dashboard'],
  ['store', 'setup-status'],
  ['store', 'service-listings'],
  ['store', 'trade-assurance-dashboard'],
];

const invalidatePrefixes = (queryClient, prefixes, options = {}) => Promise.all(
  prefixes.map((queryKey) => queryClient.invalidateQueries({ queryKey, ...options }))
);

const refetchActivePrefixes = (queryClient, prefixes) => Promise.all(
  prefixes.map((queryKey) => queryClient.refetchQueries({ queryKey, type: 'active' }))
);

export async function refreshRelatedQueries(queryClient, prefixes) {
  await invalidatePrefixes(queryClient, prefixes);
  await refetchActivePrefixes(queryClient, prefixes);
}

export async function refreshAfterWorkspaceScopeChange(queryClient) {
  await refreshRelatedQueries(queryClient, SCOPED_WORKSPACE_PREFIXES);
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['shops'] }),
    queryClient.invalidateQueries({ queryKey: ['studio-locations'] }),
  ]);
}

export async function refreshAfterInventoryChange(queryClient) {
  await refreshRelatedQueries(queryClient, [
    ['products'],
    ['product'],
  ]);
  await queryClient.invalidateQueries({ queryKey: ['dashboard'], refetchType: 'none' });
  await queryClient.invalidateQueries({ queryKey: ['notifications'], refetchType: 'active' });
}

export async function refreshAfterOnlineOrderChange(queryClient) {
  await refreshRelatedQueries(queryClient, [
    ['store', 'online-orders'],
    ['store', 'dashboard'],
    ['store', 'trade-assurance-dashboard'],
    ['store', 'setup-status'],
    ['deliveries-queue'],
    ['sales'],
    ['dashboard'],
  ]);
}

export async function refreshNotifications(queryClient) {
  await refreshRelatedQueries(queryClient, [['notifications']]);
}
