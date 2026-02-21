import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/context/AuthContext';
import { STORAGE_KEYS } from '@/constants';

type CartItem = {
  id: string;
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  discount?: number;
  imageUrl?: string;
  sku?: string;
  barcode?: string;
};

type CartContextType = {
  items: CartItem[];
  addItem: (product: {
    id: string;
    name: string;
    sellingPrice?: number;
    price?: number;
    costPrice?: number;
    imageUrl?: string;
    sku?: string;
    barcode?: string;
  }) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  updateDiscount: (itemId: string, discount: number) => void;
  clearCart: () => void;
  getTotal: () => number;
  getSubtotal: () => number;
  getTotalDiscount: () => number;
  getItemCount: () => number;
};

const CartContext = createContext<CartContextType | null>(null);

const getCartStorageKey = (tenantId: string | null) =>
  tenantId ? `${STORAGE_KEYS.CART_PREFIX}${tenantId}` : null;

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeTenantId } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);

  // Load cart from tenant-specific storage when tenant changes
  useEffect(() => {
    const key = getCartStorageKey(activeTenantId);
    if (!key) {
      setItems([]);
      return;
    }
    const loadCart = async () => {
      try {
        const stored = await AsyncStorage.getItem(key);
        if (stored) {
          const parsed = JSON.parse(stored) as CartItem[];
          const normalized = parsed.map((item) => ({
            ...item,
            unitPrice: Number(item.unitPrice) || Number((item as any).price) || Number((item as any).sellingPrice) || 0,
          }));
          setItems(normalized);
        } else {
          setItems([]);
        }
      } catch (error) {
        console.error('Failed to load cart from storage:', error);
        setItems([]);
      }
    };
    loadCart();
  }, [activeTenantId]);

  // Save cart to tenant-specific storage whenever items or tenant changes
  useEffect(() => {
    const key = getCartStorageKey(activeTenantId);
    if (!key) return;
    const saveCart = async () => {
      try {
        await AsyncStorage.setItem(key, JSON.stringify(items));
      } catch (error) {
        console.error('Failed to save cart to storage:', error);
      }
    };
    saveCart();
  }, [items, activeTenantId]);

  const addItem = useCallback(
    (product: {
      id: string;
      name: string;
      sellingPrice?: number;
      price?: number;
      costPrice?: number;
      imageUrl?: string;
      sku?: string;
      barcode?: string;
    }) => {
      const unitPrice = product.sellingPrice ?? product.price ?? product.costPrice ?? 0;
      const existingItem = items.find((item) => item.productId === product.id);

      if (existingItem) {
        // Increase quantity if item already exists
        setItems((prev) =>
          prev.map((item) =>
            item.id === existingItem.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          )
        );
      } else {
        // Add new item
        const newItem: CartItem = {
          id: `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          productId: product.id,
          name: product.name,
          unitPrice,
          quantity: 1,
          discount: 0,
          imageUrl: product.imageUrl,
          sku: product.sku,
          barcode: product.barcode,
        };
        setItems((prev) => [...prev, newItem]);
      }
    },
    [items]
  );

  const removeItem = useCallback((itemId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  }, []);

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(itemId);
      return;
    }
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, quantity } : item))
    );
  }, [removeItem]);

  const updateDiscount = useCallback((itemId: string, discount: number) => {
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, discount: Math.max(0, discount) } : item))
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    const key = getCartStorageKey(activeTenantId);
    if (key) AsyncStorage.removeItem(key);
  }, [activeTenantId]);

  const getSubtotal = useCallback(() => {
    return items.reduce((total, item) => {
      const unitPrice = Number(item.unitPrice) || 0;
      return total + unitPrice * item.quantity;
    }, 0);
  }, [items]);

  const getTotalDiscount = useCallback(() => {
    return items.reduce((total, item) => {
      return total + (item.discount || 0);
    }, 0);
  }, [items]);

  const getTotal = useCallback(() => {
    return getSubtotal() - getTotalDiscount();
  }, [getSubtotal, getTotalDiscount]);

  const getItemCount = useCallback(() => {
    return items.reduce((count, item) => count + item.quantity, 0);
  }, [items]);

  const value = useMemo(
    () => ({
      items,
      addItem,
      removeItem,
      updateQuantity,
      updateDiscount,
      clearCart,
      getTotal,
      getSubtotal,
      getTotalDiscount,
      getItemCount,
    }),
    [items, addItem, removeItem, updateQuantity, updateDiscount, clearCart, getTotal, getSubtotal, getTotalDiscount, getItemCount]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
