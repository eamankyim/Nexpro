export const CURRENCY = {
  SYMBOL: '₵',
  DECIMAL_PLACES: 2,
};

/** Storage keys for tenant isolation (must match auth/api) */
export const STORAGE_KEYS = {
  ACTIVE_TENANT_ID: 'activeTenantId',
  CART_PREFIX: '@cart_items_',
} as const;

export const STUDIO_TYPES = ['printing_press', 'mechanic', 'barber', 'salon'];

/** Shop types (from tenant metadata.shopType) */
export const SHOP_TYPES = {
  RESTAURANT: 'restaurant',
  SUPERMARKET: 'supermarket',
  HARDWARE: 'hardware',
  ELECTRONICS: 'electronics',
  CONVENIENCE: 'convenience',
  OTHER: 'other',
} as const;

/** Restaurant order statuses (kitchen tracking) */
export const ORDER_STATUSES = {
  RECEIVED: 'received',
  PREPARING: 'preparing',
  READY: 'ready',
  COMPLETED: 'completed',
} as const;

export const ORDER_STATUS_LABELS: Record<string, string> = {
  [ORDER_STATUSES.RECEIVED]: 'Received',
  [ORDER_STATUSES.PREPARING]: 'Preparing',
  [ORDER_STATUSES.READY]: 'Ready',
  [ORDER_STATUSES.COMPLETED]: 'Completed',
};

/** Job statuses */
export const JOB_STATUSES = {
  NEW: 'new',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  ON_HOLD: 'on_hold',
  CANCELLED: 'cancelled',
} as const;

/** Invoice statuses */
export const INVOICE_STATUSES = {
  DRAFT: 'draft',
  SENT: 'sent',
  PAID: 'paid',
  PARTIAL: 'partial',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled',
} as const;

/** Expense statuses */
export const EXPENSE_STATUSES = {
  DRAFT: 'draft',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PAID: 'paid',
} as const;

/**
 * Resolve effective business type (handles legacy values)
 * Legacy studio types (printing_press, mechanic, barber, salon) resolve to 'studio'
 * @param {string} businessType - From tenant
 * @returns {string} 'shop' | 'studio' | 'pharmacy'
 */
export const resolveBusinessType = (businessType: string | undefined): 'shop' | 'studio' | 'pharmacy' => {
  if (!businessType) return 'shop';
  if (STUDIO_TYPES.includes(businessType)) return 'studio';
  if (['shop', 'studio', 'pharmacy'].includes(businessType)) return businessType as 'shop' | 'studio' | 'pharmacy';
  return 'shop';
};
