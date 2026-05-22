import { api } from './api';
import { buildScopedQueryString } from '@/utils/shopScope';

export type DeliveryQueueScope = 'active' | 'done';

export const deliveryService = {
  getQueue: async (scope: DeliveryQueueScope = 'active') => {
    const q = await buildScopedQueryString({ scope });
    const res = await api.get(q ? `/deliveries/queue?${q}` : '/deliveries/queue');
    return res.data;
  },

  patchStatuses: async (
    updates: Array<{ entityType: 'job' | 'sale'; id: string; deliveryStatus: string | null }>
  ) => {
    const q = await buildScopedQueryString({});
    const res = await api.patch(q ? `/deliveries/status?${q}` : '/deliveries/status', { updates });
    return res.data;
  },
};
