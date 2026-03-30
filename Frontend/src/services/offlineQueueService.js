/**
 * Unified offline queue: queue mutations when offline, sync when online.
 * Uses IndexedDB (posDb PENDING_ACTIONS). Sales continue to use PENDING_SALES (posDb) for POS.
 */
import api from './api';
import {
  addPendingAction,
  getPendingActions,
  updatePendingActionStatus,
  removeSyncedAction,
  getPendingActionsCount,
} from '../utils/posDb';

/** Action types supported by the unified queue */
export const OFFLINE_ACTION_TYPES = {
  PRODUCT: 'product',
  INVOICE: 'invoice',
  QUOTE: 'quote',
  CUSTOMER: 'customer',
};

/**
 * Generate a unique client id for idempotency
 * @returns {string}
 */
export function generateClientId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

async function scheduleBackgroundSync() {
  try {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register('sync-pending');
    }
  } catch (error) {
    // Background Sync not available or registration failed – non-fatal
    // console.warn('[OfflineQueue] Background sync registration failed:', error);
  }
}

/**
 * Queue a mutation when offline (or optionally when online for consistency).
 * @param {string} type - One of OFFLINE_ACTION_TYPES
 * @param {string} action - 'create' | 'update' | 'delete'
 * @param {Object} payload - Request body (e.g. product, invoice, quote, customer)
 * @param {string} [clientId] - Optional; generated if not provided
 * @returns {Promise<number>} localId
 */
export async function queueAction(type, action, payload, clientId = null) {
  const id = clientId ?? generateClientId();
  const localId = await addPendingAction({
    type,
    action,
    clientId: id,
    payload: payload ?? {},
  });
  // Hint the service worker to sync when back online
  scheduleBackgroundSync();
  return localId;
}

/**
 * Get total count of pending actions (unified queue only; sales count is separate).
 * @returns {Promise<number>}
 */
export async function getQueuePendingCount() {
  return await getPendingActionsCount();
}

/**
 * Sync one pending action by calling the appropriate API.
 * @param {Object} item - { localId, type, action, clientId, payload }
 * @returns {Promise<{ success: boolean, serverId?: string, error?: string }>}
 */
async function syncOneAction(item) {
  const { localId, type, action, payload } = item;
  await updatePendingActionStatus(localId, 'syncing');

  try {
    switch (type) {
      case OFFLINE_ACTION_TYPES.PRODUCT: {
        if (action === 'create') {
          const res = await api.post('/products', payload);
          return { success: true, serverId: res?.data?.id ?? res?.data?.data?.id };
        }
        if (action === 'update' && payload?.id) {
          await api.put(`/products/${payload.id}`, payload);
          return { success: true, serverId: payload.id };
        }
        if (action === 'delete' && payload?.id) {
          await api.delete(`/products/${payload.id}`);
          return { success: true };
        }
        throw new Error(`Invalid product action: ${action}`);
      }
      case OFFLINE_ACTION_TYPES.INVOICE: {
        if (action === 'create') {
          const res = await api.post('/invoices', payload);
          return { success: true, serverId: res?.data?.id ?? res?.data?.data?.id };
        }
        if (action === 'update' && payload?.id) {
          await api.put(`/invoices/${payload.id}`, payload);
          return { success: true, serverId: payload.id };
        }
        if (action === 'delete' && payload?.id) {
          await api.delete(`/invoices/${payload.id}`);
          return { success: true };
        }
        throw new Error(`Invalid invoice action: ${action}`);
      }
      case OFFLINE_ACTION_TYPES.QUOTE: {
        if (action === 'create') {
          const res = await api.post('/quotes', payload);
          return { success: true, serverId: res?.data?.id ?? res?.data?.data?.id };
        }
        if (action === 'update' && payload?.id) {
          await api.put(`/quotes/${payload.id}`, payload);
          return { success: true, serverId: payload.id };
        }
        if (action === 'delete' && payload?.id) {
          await api.delete(`/quotes/${payload.id}`);
          return { success: true };
        }
        throw new Error(`Invalid quote action: ${action}`);
      }
      case OFFLINE_ACTION_TYPES.CUSTOMER: {
        if (action === 'create') {
          const res = await api.post('/customers', payload);
          return { success: true, serverId: res?.data?.id ?? res?.data?.data?.id };
        }
        if (action === 'update' && payload?.id) {
          await api.put(`/customers/${payload.id}`, payload);
          return { success: true, serverId: payload.id };
        }
        if (action === 'delete' && payload?.id) {
          await api.delete(`/customers/${payload.id}`);
          return { success: true };
        }
        throw new Error(`Invalid customer action: ${action}`);
      }
      default:
        throw new Error(`Unknown type: ${type}`);
    }
  } catch (err) {
    const message = err?.response?.data?.error ?? err?.message ?? 'Sync failed';
    await updatePendingActionStatus(localId, 'failed', message);
    return { success: false, error: message };
  }
}

/**
 * Sync all pending actions in the unified queue.
 * @returns {Promise<{ synced: number, failed: number, errors: Array<{ localId, error }> }>}
 */
export async function syncPendingActions() {
  const pending = await getPendingActions();
  let synced = 0;
  const errors = [];

  for (const item of pending) {
    const result = await syncOneAction(item);
    if (result.success) {
      await removeSyncedAction(item.localId);
      synced++;
    } else {
      errors.push({ localId: item.localId, error: result.error });
    }
  }

  return { synced, failed: errors.length, errors };
}

const offlineQueueService = {
  queueAction,
  getQueuePendingCount,
  syncPendingActions,
  generateClientId,
  OFFLINE_ACTION_TYPES,
};

export default offlineQueueService;
