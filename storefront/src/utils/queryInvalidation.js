/**
 * Storefront React Query helpers.
 * Keep keys scoped to buyer-owned data so mutations avoid broad cache refreshes.
 */

export const QUERY_STALE = {
  CHECKOUT: 15 * 1000,
  TRANSACTIONAL: 30 * 1000,
  LIST: 60 * 1000,
  PROFILE: 2 * 60 * 1000,
  METADATA: 5 * 60 * 1000,
};

export const SHOPPER_QUERY_KEYS = {
  addresses: ['shopper', 'addresses'],
  order: (id) => ['shopper', 'order', id],
  orders: (params = {}) => ['shopper', 'orders', params],
  profile: ['shopper', 'profile'],
  serviceBooking: (id) => ['shopper', 'service-booking', id],
  serviceBookings: (params = {}) => ['shopper', 'service-bookings', params],
  wishlist: ['shopper', 'wishlist'],
};

const invalidatePrefixes = (queryClient, prefixes, options = {}) => Promise.all(
  prefixes.map((queryKey) => queryClient.invalidateQueries({ queryKey, ...options })),
);

const refetchActivePrefixes = (queryClient, prefixes) => Promise.all(
  prefixes.map((queryKey) => queryClient.refetchQueries({ queryKey, type: 'active' })),
);

export async function refreshRelatedQueries(queryClient, prefixes) {
  await invalidatePrefixes(queryClient, prefixes);
  await refetchActivePrefixes(queryClient, prefixes);
}

export async function refreshAfterShopperAuthChange(queryClient) {
  await refreshRelatedQueries(queryClient, [['shopper']]);
}

export async function refreshAfterProfileChange(queryClient) {
  await refreshRelatedQueries(queryClient, [
    SHOPPER_QUERY_KEYS.profile,
    ['shopper', 'orders'],
    ['shopper', 'service-bookings'],
  ]);
}

export async function refreshAfterWishlistChange(queryClient) {
  await refreshRelatedQueries(queryClient, [SHOPPER_QUERY_KEYS.wishlist]);
}

export async function refreshAfterAddressChange(queryClient) {
  await refreshRelatedQueries(queryClient, [SHOPPER_QUERY_KEYS.addresses]);
}

export async function refreshAfterOrderChange(queryClient) {
  await refreshRelatedQueries(queryClient, [
    ['shopper', 'orders'],
    ['shopper', 'order'],
    ['shopper', 'service-bookings'],
    ['shopper', 'service-booking'],
  ]);
}
