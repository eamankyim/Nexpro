import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useStorefrontAuth } from './StorefrontAuthContext';
import storeService from '../services/storeService';
import { showError, showSuccess } from '../utils/toast';

const WishlistContext = createContext(null);

const getCurrentReturnTo = () => {
  if (typeof window === 'undefined') return '/products';
  return `${window.location.pathname}${window.location.search || ''}` || '/products';
};

const unwrapWishlist = (response) => response?.data?.data || response?.data || response || {};

export const WishlistProvider = ({ children }) => {
  const { isAuthenticated, isLoading, openShopperAuthModal } = useStorefrontAuth();
  const [items, setItems] = useState([]);
  const [listingIds, setListingIds] = useState([]);
  const [isWishlistLoading, setIsWishlistLoading] = useState(false);
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

  const refreshWishlist = useCallback(async () => {
    if (!isAuthenticated) {
      setItems([]);
      setListingIds([]);
      return null;
    }

    setIsWishlistLoading(true);
    try {
      const response = await storeService.getWishlist();
      applyWishlist(response);
      return response;
    } catch (error) {
      showError(error, 'Could not load your wishlist.');
      return null;
    } finally {
      setIsWishlistLoading(false);
    }
  }, [applyWishlist, isAuthenticated]);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      setItems([]);
      setListingIds([]);
      setIsWishlistLoading(false);
      return;
    }
    refreshWishlist();
  }, [isAuthenticated, isLoading, refreshWishlist]);

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
      showSuccess(wasSaved ? 'Removed from wishlist.' : 'Saved to wishlist.');
      return { ok: true, saved: !wasSaved };
    } catch (error) {
      showError(error, 'Could not update your wishlist.');
      return { ok: false, saved: wasSaved };
    } finally {
      markPending(listingId, false);
    }
  }, [applyWishlist, isAuthenticated, isWishlisted, markPending, requireWishlistAuth]);

  const removeWishlistItem = useCallback(async (listingId) => {
    if (!listingId) return { ok: false };
    markPending(listingId, true);
    try {
      const response = await storeService.removeWishlistItem(listingId);
      applyWishlist(response);
      showSuccess('Removed from wishlist.');
      return { ok: true };
    } catch (error) {
      showError(error, 'Could not remove this item.');
      return { ok: false };
    } finally {
      markPending(listingId, false);
    }
  }, [applyWishlist, markPending]);

  const value = useMemo(() => ({
    count: listingIds.length,
    isWishlistLoading,
    isWishlisted,
    items,
    pendingListingIds,
    refreshWishlist,
    removeWishlistItem,
    toggleWishlist,
  }), [
    isWishlistLoading,
    isWishlisted,
    items,
    listingIds.length,
    pendingListingIds,
    refreshWishlist,
    removeWishlistItem,
    toggleWishlist,
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
