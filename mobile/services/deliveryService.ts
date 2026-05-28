import { api } from './api';
import { buildScopedQueryString } from '@/utils/shopScope';

export type DeliveryQueueScope = 'active' | 'done';

export type DeliveryQueueRow = {
  entityType: 'job' | 'sale';
  id: string;
  reference?: string;
  title?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  addressSummary?: string | null;
  deliveryStatus?: string | null;
  deliveryAssignedTo?: string | null;
  deliveryAssignedAt?: string | null;
  deliveredBy?: string | null;
  deliveredAt?: string | null;
  completedAt?: string;
  total?: number | null;
};

export type DeliveryStatusUpdate = {
  entityType: 'job' | 'sale';
  id: string;
  deliveryStatus?: string | null;
  deliveryAssignedTo?: string | null;
};

export const deliveryService = {
  getQueue: async (scope: DeliveryQueueScope = 'active') => {
    const q = await buildScopedQueryString({ scope });
    const res = await api.get(q ? `/deliveries/queue?${q}` : '/deliveries/queue');
    return res.data;
  },

  patchStatuses: async (updates: DeliveryStatusUpdate[]) => {
    const q = await buildScopedQueryString({});
    const res = await api.patch(q ? `/deliveries/status?${q}` : '/deliveries/status', { updates });
    return res.data;
  },
};
