import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/constants';

type ShopScopeParams = Record<string, string | number | boolean | undefined | null>;

export async function getActiveShopIdForScope(): Promise<string | null> {
  return AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_SHOP_ID);
}

export async function withActiveShopScope(
  params: ShopScopeParams = {}
): Promise<ShopScopeParams> {
  const activeShopId = await getActiveShopIdForScope();
  if (!activeShopId || params.shopId) return params;
  return { ...params, shopId: activeShopId };
}

export async function buildScopedQueryString(params: ShopScopeParams = {}): Promise<string> {
  const scoped = await withActiveShopScope(params);
  const searchParams = new URLSearchParams();
  Object.entries(scoped).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    searchParams.append(key, String(value));
  });
  return searchParams.toString();
}
