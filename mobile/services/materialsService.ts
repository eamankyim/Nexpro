import { api } from './api';
import { buildScopedQueryString } from '@/utils/shopScope';

type MaterialsParams = {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  status?: string;
  lowStock?: boolean;
  outOfStock?: boolean;
};

export const materialsService = {
  getCategories: async () => {
    const res = await api.get('/materials/categories');
    return res.data;
  },

  getItems: async (params: MaterialsParams = {}) => {
    const query = await buildScopedQueryString(params);
    const res = await api.get(query ? `/materials/items?${query}` : '/materials/items');
    return res.data;
  },

  getItemById: async (id: string) => {
    const res = await api.get(`/materials/items/${id}`);
    return res.data;
  },

  createItem: async (data: object) => {
    const query = await buildScopedQueryString({});
    const res = await api.post(query ? `/materials/items?${query}` : '/materials/items', data);
    return res.data;
  },

  updateItem: async (id: string, data: object) => {
    const query = await buildScopedQueryString({});
    const res = await api.put(query ? `/materials/items/${id}?${query}` : `/materials/items/${id}`, data);
    return res.data;
  },

  restock: async (id: string, data: { quantity: number; unitCost?: number; reference?: string; notes?: string }) => {
    const res = await api.post(`/materials/items/${id}/restock`, data);
    return res.data;
  },

  adjust: async (id: string, data: { adjustmentMode: 'set' | 'delta'; newQuantity?: number; quantityDelta?: number; reason?: string; notes?: string }) => {
    const res = await api.post(`/materials/items/${id}/adjust`, data);
    return res.data;
  },
};
