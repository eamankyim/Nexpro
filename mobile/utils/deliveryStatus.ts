import {
  DELIVERY_STATUS_LABELS,
  DELIVERY_STATUS_ORDER,
  DELIVERY_STATUSES,
} from '@/constants';
import { BRAND_GREEN } from '@/constants/brand';
import { formatStatusLabel } from '@/utils/formatLabels';

export const DELIVERY_ACTIVE_FILTERS = [
  'all',
  'not_set',
  DELIVERY_STATUSES.READY_FOR_DELIVERY,
  DELIVERY_STATUSES.OUT_FOR_DELIVERY,
  DELIVERY_STATUSES.DELIVERED,
  DELIVERY_STATUSES.RETURNED,
] as const;

export const DELIVERY_DONE_FILTERS = ['all', DELIVERY_STATUSES.DELIVERED, DELIVERY_STATUSES.RETURNED] as const;

/** Filter chip / select label (web Deliveries.jsx parity). */
export function getDeliveryQueueFilterLabel(
  scope: 'active' | 'done',
  filterKey: string
): string {
  if (filterKey === 'all') return scope === 'active' ? 'All in queue' : 'All done';
  if (filterKey === 'not_set') return 'Not set yet';
  return DELIVERY_STATUS_LABELS[filterKey] || formatStatusLabel(filterKey);
}

/** Row badge / picker label for a delivery status value. */
export function getDeliveryStatusDisplayLabel(status?: string | null): string {
  if (!status) return 'Not set yet';
  return DELIVERY_STATUS_LABELS[status] || formatStatusLabel(status);
}

/** Badge colors (web PublicJobTrackingPanel: neutral when unset, green when set). */
export function getDeliveryStatusColors(status?: string | null): {
  bg: string;
  text: string;
  border: string;
} {
  if (!status) {
    return { bg: 'transparent', text: '#111827', border: '#111827' };
  }
  return { bg: 'rgba(22, 101, 52, 0.12)', text: BRAND_GREEN, border: BRAND_GREEN };
}

export { DELIVERY_STATUS_LABELS, DELIVERY_STATUS_ORDER };
