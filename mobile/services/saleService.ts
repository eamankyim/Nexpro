import { api } from './api';

type SaleParams = {
  page?: number;
  limit?: number;
  status?: string;
  customerId?: string;
  paymentMethod?: string;
  startDate?: string;
  endDate?: string;
  orderStatus?: string;
  activeOrders?: boolean;
};

export const saleService = {
  getSales: async (params: SaleParams = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      searchParams.append(key, String(value));
    });
    const query = searchParams.toString();
    // Increase timeout for sales endpoint (60 seconds) as it may have large datasets
    const res = await api.get(query ? `/sales?${query}` : '/sales', {
      timeout: 60000, // 60 seconds
    });
    // Backend returns: { success: true, count: N, pagination: {...}, data: [...] }
    // Mobile api returns full axios response, so res.data = { success: true, count: N, pagination: {...}, data: [...] }
    return res.data;
  },

  getSaleById: async (id: string) => {
    const res = await api.get(`/sales/${id}`);
    // Backend returns: { success: true, data: {...} }
    return res.data;
  },

  createSale: async (payload: object) => {
    const res = await api.post('/sales', payload);
    return res.data;
  },

  /** Batch sync offline sales (idempotent by clientId) */
  syncBatch: async (items: Array<{ clientId: string; payload: object }>) => {
    const res = await api.post('/sales/sync', { items });
    return res.data;
  },

  getActivities: async (saleId: string) => {
    const res = await api.get(`/sales/${saleId}/activities`);
    // Backend returns: { success: true, data: [...] }
    return res.data;
  },

  /**
   * Get orders for kitchen dashboard (restaurant only).
   * Uses activeOrders to filter for received/preparing/ready (excludes completed).
   */
  getOrders: async (filters: {
    orderStatus?: string;
    activeOrders?: boolean;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  } = {}) => {
    const params: Record<string, string | number | undefined> = { ...filters } as Record<string, string | number | undefined>;
    if (filters.activeOrders) params.activeOrders = 'true';
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      searchParams.append(key, String(value));
    });
    const query = searchParams.toString();
    const res = await api.get(query ? `/sales?${query}` : '/sales', { timeout: 30000 });
    return res.data;
  },

  /**
   * Update order status (restaurant kitchen only).
   * @param orderStatus - One of: received, preparing, ready, completed
   */
  updateOrderStatus: async (saleId: string, orderStatus: string) => {
    const res = await api.patch(`/sales/${saleId}/order-status`, { orderStatus });
    return res.data;
  },
};
