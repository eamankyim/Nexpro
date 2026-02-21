import { api } from './api';

type InventoryParams = {
  page?: number;
  limit?: number;
  categoryId?: string;
  status?: string;
  lowStock?: boolean;
  outOfStock?: boolean;
};

export const inventoryService = {
  getItems: async (params: InventoryParams = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      searchParams.append(key, String(value));
    });
    const query = searchParams.toString();
    const res = await api.get(query ? `/inventory/items?${query}` : '/inventory/items');
    return res.data;
  },

  getItemById: async (id: string) => {
    const res = await api.get(`/inventory/items/${id}`);
    return res.data;
  },

  createItem: async (data: object) => {
    const res = await api.post('/inventory/items', data);
    return res.data;
  },

  updateItem: async (id: string, data: object) => {
    const res = await api.put(`/inventory/items/${id}`, data);
    return res.data;
  },

  restock: async (id: string, data: { quantity: number; unitCost?: number; reference?: string; notes?: string }) => {
    const res = await api.post(`/inventory/items/${id}/restock`, data);
    return res.data;
  },

  adjust: async (id: string, data: { adjustmentMode: 'set' | 'delta'; newQuantity?: number; quantityDelta?: number; reason?: string; notes?: string }) => {
    const res = await api.post(`/inventory/items/${id}/adjust`, data);
    return res.data;
  },
};
