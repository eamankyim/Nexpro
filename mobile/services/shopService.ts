import { api } from './api';

export type ShopAccess = {
  shops?: Array<{ id: string; name: string; isDefault?: boolean }>;
  canAccessAll?: boolean;
  activeShopId?: string | null;
  defaultShopId?: string | null;
};

export const shopService = {
  getAccess: async (): Promise<ShopAccess> => {
    const res = await api.get('/shops/access');
    return (res.data?.data ?? res.data) as ShopAccess;
  },
};
