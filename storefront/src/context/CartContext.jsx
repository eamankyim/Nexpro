import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const CartContext = createContext(null);
const CART_STORAGE_KEY = 'sabito_storefront_cart';

const readCartItems = () => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => item?.listingId && item?.storeSlug) : [];
  } catch {
    return [];
  }
};

const persistCartItems = (items) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
};

const clampQuantity = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(parsed, 100);
};

const normalizeCartItem = ({ product, store, storeSlug, quantity }) => {
  const listingId = product?.id || product?.listingId;
  const resolvedStoreSlug = storeSlug || product?.store?.slug || store?.slug;
  return {
    listingId,
    productSlug: product?.slug || listingId,
    title: product?.title || 'Storefront item',
    image: product?.images?.[0] || null,
    unitPrice: Number.parseFloat(product?.publicPrice || 0) || 0,
    quantity: clampQuantity(quantity),
    sku: product?.sku || product?.variant?.sku || null,
    storeSlug: resolvedStoreSlug,
    storeName: store?.displayName || product?.store?.displayName || resolvedStoreSlug || 'Sabito seller',
    storeCurrency: store?.currency || product?.store?.currency || 'GHS',
    store: {
      slug: resolvedStoreSlug,
      displayName: store?.displayName || product?.store?.displayName || resolvedStoreSlug || 'Sabito seller',
      currency: store?.currency || product?.store?.currency || 'GHS',
      deliveryEnabled: store?.deliveryEnabled === true || product?.store?.deliveryEnabled === true,
      pickupEnabled: store?.pickupEnabled !== false && product?.store?.pickupEnabled !== false,
      deliveryFee: Number.parseFloat(store?.deliveryFee ?? product?.store?.deliveryFee ?? 0) || 0,
    },
  };
};

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState(readCartItems);

  const commitItems = useCallback((updater) => {
    setItems((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      persistCartItems(next);
      return next;
    });
  }, []);

  const addItem = useCallback((payload) => {
    const nextItem = normalizeCartItem(payload);
    if (!nextItem.listingId || !nextItem.storeSlug) return { ok: false, reason: 'invalid_item' };

    let replacedStore = false;
    commitItems((current) => {
      const sameStoreItems = current.filter((item) => item.storeSlug === nextItem.storeSlug);
      replacedStore = sameStoreItems.length !== current.length;
      const existing = sameStoreItems.find((item) => item.listingId === nextItem.listingId);
      if (existing) {
        return sameStoreItems.map((item) => (
          item.listingId === nextItem.listingId
            ? { ...item, quantity: clampQuantity(item.quantity + nextItem.quantity) }
            : item
        ));
      }
      return [...sameStoreItems, nextItem];
    });

    return { ok: true, replacedStore };
  }, [commitItems]);

  const updateQuantity = useCallback((listingId, quantity) => {
    commitItems((current) => current.map((item) => (
      item.listingId === listingId ? { ...item, quantity: clampQuantity(quantity) } : item
    )));
  }, [commitItems]);

  const removeItem = useCallback((listingId) => {
    commitItems((current) => current.filter((item) => item.listingId !== listingId));
  }, [commitItems]);

  const clearCart = useCallback(() => {
    commitItems([]);
  }, [commitItems]);

  const cartSummary = useMemo(() => {
    const itemCount = items.reduce((sum, item) => sum + clampQuantity(item.quantity), 0);
    const subtotal = items.reduce((sum, item) => sum + (Number(item.unitPrice || 0) * clampQuantity(item.quantity)), 0);
    const store = items[0]?.store || null;
    return {
      itemCount,
      subtotal: Number(subtotal.toFixed(2)),
      store,
      currency: store?.currency || items[0]?.storeCurrency || 'GHS',
    };
  }, [items]);

  const value = useMemo(() => ({
    addItem,
    cartSummary,
    clearCart,
    items,
    removeItem,
    updateQuantity,
  }), [addItem, cartSummary, clearCart, items, removeItem, updateQuantity]);

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
};

