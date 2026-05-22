import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useShopOptional } from '../context/ShopContext';

/**
 * Effective retail shop type: active shop first, then tenant metadata.
 * @returns {string}
 */
export function useActiveShopType() {
  const { activeTenant } = useAuth();
  const shop = useShopOptional();

  return useMemo(() => {
    const fromShop =
      shop?.activeShop?.shopType ||
      shop?.activeShop?.metadata?.shopType ||
      null;
    if (fromShop) return fromShop;
    return (
      activeTenant?.metadata?.shopType ||
      activeTenant?.metadata?.businessSubType ||
      'other'
    );
  }, [
    shop?.activeShop?.shopType,
    shop?.activeShop?.metadata?.shopType,
    activeTenant?.metadata?.shopType,
    activeTenant?.metadata?.businessSubType,
  ]);
}
