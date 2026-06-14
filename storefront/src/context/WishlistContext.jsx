import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useStorefrontAuth } from './StorefrontAuthContext';
import storeService from '../services/storeService';
import { showError, showSuccess } from '../utils/toast';
import {
  QUERY_STALE,
  refreshAfterWishlistChange,
  SHOPPER_QUERY_KEYS,
} from '../utils/queryInvalidation';

const WishlistContext = createContext(null);

const getCurrentReturnTo = () => {
  if (typeof window === 'undefined') return '/products';
  return `${window.location.pathname}${window.location.search || ''}` || '/products';
};

const unwrapWishlist = (response) => response?.data?.data || response?.data || response || {};

export const WishlistProvider = ({ children }) => {
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading, openShopperAuthModal } = useStorefrontAuth();
  const [items, setItems] = useState([]);
  const [listingIds, setListingIds] = useState([]);
  const [pendingListingIds, setPendingListingIds] = useState([]);

  const applyWishlist = useCallback((payload) => {
    const data = unwrapWishlist(payload);
    const nextItems = Array.isArray(data.items) ? data.items : [];
    const nextListingIds = Array.isArray(data.listingIds)
      ? data.listingIds
      : nextItems.map((item) => item.listingId).filter(Boolean);

    setItems(nextItems);
    setListingIds([...new Set(nextListingIds)]);
  }, []);

  const wishlistQuery = useQuery({
    queryKey: SHOPPER_QUERY_KEYS.wishlist,
    queryFn: storeService.getWishlist,
    enabled: isAuthenticated,
    staleTime: QUERY_STALE.LIST,
    refetchOnWindowFocus: false,
  });

  const refreshWishlist = useCallback(async () => {
    if (!isAuthenticated) {
      setItems([]);
      setListingIds([]);
      return null;
    }

    try {
      const result = await wishlistQuery.refetch();
      if (result.data) applyWishlist(result.data);
      return result.data || null;
    } catch (error) {
      showError(error, 'Could not load your wishlist.');
      return null;
    }
  }, [applyWishlist, isAuthenticated, wishlistQuery]);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      setItems([]);
      setListingIds([]);
      return;
    }
    if (wishlistQuery.data) {
      applyWishlist(wishlistQuery.data);
    }
  }, [applyWishlist, isAuthenticated, isLoading, wishlistQuery.data]);

  useEffect(() => {
    if (wishlistQuery.error) {
      showError(wishlistQuery.error, 'Could not load your wishlist.');
    }
  }, [wishlistQuery.error]);

  const isWishlisted = useCallback((listingId) => (
    Boolean(listingId && listingIds.includes(listingId))
  ), [listingIds]);

  const requireWishlistAuth = useCallback((product) => {
    openShopperAuthModal({
      mode: 'signup',
      intent: {
        action: 'wishlist',
        productId: product?.id || product?.listingId || null,
        productSlug: product?.slug || null,
        storeSlug: product?.store?.slug || null,
        returnTo: getCurrentReturnTo(),
      },
    });
  }, [openShopperAuthModal]);

  const markPending = useCallback((listingId, pending) => {
    setPendingListingIds((current) => {
      if (!listingId) return current;
      if (pending) return current.includes(listingId) ? current : [...current, listingId];
      return current.filter((id) => id !== listingId);
    });
  }, []);

  const toggleWishlist = useCallback(async (product) => {
    const listingId = product?.listingId || product?.id;
    if (!listingId) {
      showError('This product cannot be saved right now.');
      return { ok: false, saved: false };
    }

    if (!isAuthenticated) {
      requireWishlistAuth(product);
      return { ok: false, authRequired: true, saved: false };
    }

    const wasSaved = isWishlisted(listingId);
    markPending(listingId, true);
    try {
      const response = await storeService.toggleWishlistItem(listingId);
      const data = unwrapWishlist(response);
      applyWishlist(data);
      queryClient.setQueryData(SHOPPER_QUERY_KEYS.wishlist, data);
      await refreshAfterWishlistChange(queryClient);
      showSuccess(wasSaved ? 'Removed from wishlist.' : 'Saved to wishlist.');
      return { ok: true, saved: !wasSaved };
    } catch (error) {
      showError(error, 'Could not update your wishlist.');
      return { ok: false, saved: wasSaved };
    } finally {
      markPending(listingId, false);
    }
  }, [applyWishlist, isAuthenticated, isWishlisted, markPending, queryClient, requireWishlistAuth]);

  const removeWishlistItem = useCallback(async (listingId) => {
    if (!listingId) return { ok: false };
    markPending(listingId, true);
    try {
      const response = await storeService.removeWishlistItem(listingId);
      applyWishlist(response);
      queryClient.setQueryData(SHOPPER_QUERY_KEYS.wishlist, response);
      await refreshAfterWishlistChange(queryClient);
      showSuccess('Removed from wishlist.');
      return { ok: true };
    } catch (error) {
      showError(error, 'Could not remove this item.');
      return { ok: false };
    } finally {
      markPending(listingId, false);
    }
  }, [applyWishlist, markPending, queryClient]);

  const value = useMemo(() => ({
    count: listingIds.length,
    isWishlistLoading: wishlistQuery.isLoading || wishlistQuery.isFetching,
    isWishlisted,
    items,
    pendingListingIds,
    wishlistError: wishlistQuery.error,
    refetchWishlist: refreshWishlist,
    refreshWishlist,
    removeWishlistItem,
    toggleWishlist,
  }), [
    isWishlisted,
    items,
    listingIds.length,
    pendingListingIds,
    refreshWishlist,
    removeWishlistItem,
    toggleWishlist,
    wishlistQuery.error,
    wishlistQuery.isFetching,
    wishlistQuery.isLoading,
  ]);

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within WishlistProvider');
  }
  return context;
};
