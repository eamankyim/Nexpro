/**
 * Offline queue for sales on mobile.
 * Stores pending sales in AsyncStorage and syncs when back online.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saleService } from './saleService';

const PENDING_SALES_KEY = 'shopwise_pending_sales';

export type PendingSale = {
  localId: string;
  clientId: string;
  payload: object;
  createdAt: string;
};

function generateClientId(): string {
  return `offline-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export const offlineQueueService = {
  async queueSale(payload: object): Promise<string> {
    const clientId = generateClientId();
    const pending: PendingSale = {
      localId: clientId,
      clientId,
      payload,
      createdAt: new Date().toISOString(),
    };
    const list = await this.getPendingSales();
    list.push(pending);
    await AsyncStorage.setItem(PENDING_SALES_KEY, JSON.stringify(list));
    return clientId;
  },

  async getPendingSales(): Promise<PendingSale[]> {
    try {
      const raw = await AsyncStorage.getItem(PENDING_SALES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  async getPendingCount(): Promise<number> {
    const list = await this.getPendingSales();
    return list.length;
  },

  async syncPendingSales(): Promise<{ synced: number; failed: number }> {
    const pending = await this.getPendingSales();
    if (pending.length === 0) return { synced: 0, failed: 0 };

    let synced = 0;
    let failed = 0;
    const remaining: PendingSale[] = [];

    try {
      const items = pending.map((p) => ({ clientId: p.clientId, payload: p.payload }));
      const res = await saleService.syncBatch(items);
      const results = (res as any)?.results as Array<{ clientId?: string; id?: string; error?: string }> | undefined;

      if (Array.isArray(results) && results.length === pending.length) {
        for (let i = 0; i < results.length; i++) {
          if (results[i]?.id && !results[i]?.error) {
            synced++;
          } else {
            failed++;
            remaining.push(pending[i]);
          }
        }
      } else {
        for (const p of pending) {
          try {
            await saleService.createSale(p.payload);
            synced++;
          } catch {
            failed++;
            remaining.push(p);
          }
        }
      }

      await AsyncStorage.setItem(PENDING_SALES_KEY, JSON.stringify(remaining));
    } catch {
      return { synced: 0, failed: pending.length };
    }

    return { synced, failed };
  },
};
