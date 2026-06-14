export type FulfillmentStatus =
  | 'pending'
  | 'paid'
  | 'processing'
  | 'ready'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

const normalizeStatus = (value: unknown): string => String(value || '').toLowerCase().trim();

/**
 * Derive seller-facing fulfillment state from sale, order, and delivery fields.
 */
export function fulfillmentStateForOrder(order: Record<string, unknown> = {}): FulfillmentStatus {
  const saleStatus = normalizeStatus(order.status);
  const orderStatus = normalizeStatus(order.orderStatus);
  const deliveryStatus = normalizeStatus(order.deliveryStatus);
  const rawFulfillment = normalizeStatus(order.fulfillmentStatus || order.fulfillment_state);

  if (rawFulfillment) {
    if (rawFulfillment === 'packed') return 'ready';
    if (['pending', 'paid', 'processing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'].includes(rawFulfillment)) {
      return rawFulfillment as FulfillmentStatus;
    }
  }

  if (saleStatus === 'cancelled' || saleStatus === 'refunded' || orderStatus === 'cancelled') return 'cancelled';
  if (deliveryStatus === 'delivered' || orderStatus === 'completed') return 'delivered';
  if (deliveryStatus === 'out_for_delivery') return 'out_for_delivery';
  if (deliveryStatus === 'ready_for_delivery' || orderStatus === 'ready') return 'ready';
  if (orderStatus === 'received') return 'pending';
  if (['preparing', 'processing'].includes(orderStatus)) return 'processing';
  if (saleStatus === 'pending' || saleStatus === 'partially_paid') return 'pending';
  return 'paid';
}

export function paymentStatusForMarketplaceOrder(order: Record<string, unknown> = {}): string | null {
  const metadata = order.metadata && typeof order.metadata === 'object' && !Array.isArray(order.metadata)
    ? (order.metadata as Record<string, unknown>)
    : {};
  const tradeAssuranceMeta =
    metadata.tradeAssurance && typeof metadata.tradeAssurance === 'object'
      ? (metadata.tradeAssurance as Record<string, unknown>)
      : {};
  const marketplacePayment =
    order.marketplacePayment && typeof order.marketplacePayment === 'object'
      ? (order.marketplacePayment as Record<string, unknown>)
      : null;

  return (
    (marketplacePayment?.status as string | undefined)
    || (tradeAssuranceMeta.paymentStatus as string | undefined)
    || null
  );
}

export function getTradeAssurance(order: Record<string, unknown> = {}): Record<string, unknown> {
  const metadata = order.metadata && typeof order.metadata === 'object' && !Array.isArray(order.metadata)
    ? (order.metadata as Record<string, unknown>)
    : {};
  const tradeAssurance =
    order.tradeAssurance && typeof order.tradeAssurance === 'object'
      ? (order.tradeAssurance as Record<string, unknown>)
      : null;
  const tradeAssuranceMeta =
    metadata.tradeAssurance && typeof metadata.tradeAssurance === 'object'
      ? (metadata.tradeAssurance as Record<string, unknown>)
      : null;
  const marketplacePayment =
    order.marketplacePayment && typeof order.marketplacePayment === 'object'
      ? (order.marketplacePayment as Record<string, unknown>)
      : null;

  return tradeAssurance || tradeAssuranceMeta || marketplacePayment || {};
}

export function canShowSellerRefund(order: Record<string, unknown> = {}): boolean {
  return getTradeAssurance(order).canSellerRefund === true;
}

export const ONLINE_ORDER_STATUS_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'New', value: 'pending' },
  { label: 'Processing', value: 'processing' },
  { label: 'Packed', value: 'ready' },
  { label: 'Out for delivery', value: 'out_for_delivery' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Cancelled', value: 'cancelled' },
] as const;

export const ONLINE_ORDER_STATUS_TRANSITIONS: Record<FulfillmentStatus, FulfillmentStatus[]> = {
  pending: ['processing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'],
  paid: ['processing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'],
  processing: ['ready', 'out_for_delivery', 'delivered', 'cancelled'],
  ready: ['out_for_delivery', 'delivered', 'cancelled'],
  out_for_delivery: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

export const ONLINE_ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'New / Pending',
  paid: 'Paid',
  processing: 'Processing',
  ready: 'Packed / Ready',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  paid_held: 'Payment held',
  released: 'Released',
  refunded: 'Refunded',
  disputed: 'Disputed',
  pending_payment: 'Payment pending',
  completed: 'Paid',
};

export const ONLINE_ORDER_STATUS_ACTIONS = [
  { label: 'Mark processing', value: 'processing' },
  { label: 'Mark packed', value: 'packed' },
  { label: 'Out for delivery', value: 'out_for_delivery' },
  { label: 'Mark delivered', value: 'delivered' },
  { label: 'Cancel order', value: 'cancelled' },
] as const;

export function formatOnlineOrderStatusLabel(status: string, context: 'fulfillment' | 'payment' = 'fulfillment'): string {
  const normalized = normalizeStatus(status);
  if (context === 'fulfillment' && normalized === 'pending') return 'New / Pending';
  return ONLINE_ORDER_STATUS_LABELS[normalized]
    || normalized.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getOnlineOrderStatusColors(status: string): { bg: string; text: string; border: string } {
  const normalized = normalizeStatus(status);
  const map: Record<string, { bg: string; text: string; border: string }> = {
    pending: { bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
    paid: { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' },
    processing: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
    ready: { bg: '#eef2ff', text: '#4338ca', border: '#c7d2fe' },
    out_for_delivery: { bg: '#faf5ff', text: '#7e22ce', border: '#e9d5ff' },
    delivered: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
    cancelled: { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
    paid_held: { bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
    released: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
    refunded: { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
    disputed: { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
  };
  return map[normalized] || { bg: '#f3f4f6', text: '#374151', border: '#e5e7eb' };
}

export function getCustomerName(order: Record<string, unknown>): string {
  const customer = order.customer && typeof order.customer === 'object'
    ? (order.customer as Record<string, unknown>)
    : {};
  return (
    (order.customerName as string)
    || (customer.name as string)
    || (customer.fullName as string)
    || (customer.businessName as string)
    || 'Guest customer'
  );
}

export function getOrderNumber(order: Record<string, unknown>): string {
  return (
    (order.orderNumber as string)
    || (order.orderNo as string)
    || (order.saleNumber as string)
    || 'Online order'
  );
}

export function getOrderTotal(order: Record<string, unknown>): number {
  return Number(order.total || order.amount || order.grandTotal || 0);
}

export function canApplyOnlineOrderStatus(
  order: Record<string, unknown>,
  nextStatus: string
): boolean {
  if (order.orderType === 'service' && !['processing', 'delivered', 'cancelled'].includes(nextStatus)) {
    return false;
  }
  const current = fulfillmentStateForOrder(order);
  return (ONLINE_ORDER_STATUS_TRANSITIONS[current] || []).includes(nextStatus as FulfillmentStatus);
}

export function getStoreOrdersPayload(response: unknown): Record<string, unknown> {
  const payload = (response as { data?: unknown })?.data ?? response ?? {};
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const obj = payload as Record<string, unknown>;
    if (obj.success === true || obj.stats || obj.pagination || obj.count != null) return obj;
    if (obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)) {
      return obj.data as Record<string, unknown>;
    }
  }
  return (payload as Record<string, unknown>) || {};
}

export function getStoreOrderRows(payload: Record<string, unknown>): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data as Record<string, unknown>[];
  if (Array.isArray(payload.orders)) return payload.orders as Record<string, unknown>[];
  if (payload.data && typeof payload.data === 'object') {
    const nested = payload.data as Record<string, unknown>;
    if (Array.isArray(nested.orders)) return nested.orders as Record<string, unknown>[];
  }
  return [];
}

export function getOrderStatsPayload(response: unknown): Record<string, unknown> {
  const payload = (response as { data?: unknown })?.data ?? response ?? {};
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const obj = payload as Record<string, unknown>;
    if (obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)) {
      return obj.data as Record<string, unknown>;
    }
    if (obj.stats && typeof obj.stats === 'object') return obj.stats as Record<string, unknown>;
    return obj;
  }
  return {};
}
