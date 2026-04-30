import { api } from './api';

export type DeliveryQueueScope = 'active' | 'done';

export const deliveryService = {
  getQueue: async (scope: DeliveryQueueScope = 'active') => {
    const params = new URLSearchParams();
    if (scope) params.set('scope', scope);
    const q = params.toString();
    const res = await api.get(q ? `/deliveries/queue?${q}` : '/deliveries/queue');
    return res.data;
  },

  patchStatuses: async (
    updates: Array<{ entityType: 'job' | 'sale'; id: string; deliveryStatus: string | null }>
  ) => {
    const res = await api.patch('/deliveries/status', { updates });
    return res.data;
  },
};
