/**
 * React Query persistence for offline-first web.
 * Uses IndexedDB via idb-keyval so cache survives refresh and works offline.
 */
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { get, set, del } from 'idb-keyval';

const PERSIST_KEY = 'shopwise-rq-persist';

const idbStorage = {
  getItem: async (key) => {
    const value = await get(key);
    return value ?? null;
  },
  setItem: async (key, value) => {
    await set(key, value);
  },
  removeItem: async (key) => {
    await del(key);
  },
};

/**
 * Persister for PersistQueryClientProvider.
 * Throttle writes to avoid excessive IndexedDB writes.
 */
export const queryPersister = createAsyncStoragePersister({
  storage: {
    getItem: (key) => idbStorage.getItem(key),
    setItem: (key, value) => idbStorage.setItem(key, value),
    removeItem: (key) => idbStorage.removeItem(key),
  },
  key: PERSIST_KEY,
  throttleTime: 1000,
  serialize: (state) => JSON.stringify(state),
  deserialize: (state) => JSON.parse(state),
});

/**
 * Only persist successful queries; exclude auth and sensitive keys.
 */
export function shouldDehydrateQuery(query) {
  const key = query.queryKey?.[0];
  if (typeof key !== 'string') return query.state.status === 'success';
  // Bell + badge must refetch after load; persisted empty/stale cache looked like "no notifications until refresh".
  if (key === 'notifications') return false;
  const exclude =
    key.includes('auth') ||
    key.includes('login') ||
    key.includes('register') ||
    key.includes('password') ||
    key.includes('token');
  return query.state.status === 'success' && !exclude;
}
