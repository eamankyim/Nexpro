/**
 * IndexedDB storage for POS quick-add items (frequently sold products grid).
 */
import { getActiveShopIdForScope } from './shopScope';

const DB_NAME = 'shopwise_pos';
const DB_VERSION = 6;

export const STORES = {
  QUICK_ITEMS: 'pos_quick_items',
};

let dbInstance = null;

const resolveShopId = (shopId) => shopId ?? getActiveShopIdForScope() ?? null;

const filterByShopScope = (items, shopId) => {
  const scope = resolveShopId(shopId);
  if (!scope) return items;
  return items.filter((item) => item.shopId === scope);
};

/**
 * @returns {Promise<IDBDatabase>}
 */
export const openDatabase = () => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(new Error('Failed to open POS database'));

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const oldVersion = event.oldVersion;

      if (!db.objectStoreNames.contains(STORES.QUICK_ITEMS)) {
        const quickStore = db.createObjectStore(STORES.QUICK_ITEMS, { keyPath: 'productId' });
        quickStore.createIndex('position', 'position', { unique: false });
        quickStore.createIndex('shopId', 'shopId', { unique: false });
      } else if (oldVersion < 6) {
        const tx = event.target.transaction;
        const quickStore = tx.objectStore(STORES.QUICK_ITEMS);
        if (!quickStore.indexNames.contains('shopId')) {
          quickStore.createIndex('shopId', 'shopId', { unique: false });
        }
      }

      const legacyStores = [
        'pos_products',
        'pos_customers',
        'pos_pending_sales',
        'pos_pending_actions',
        'pos_sync_meta',
        'dashboard_cache',
      ];
      legacyStores.forEach((name) => {
        if (db.objectStoreNames.contains(name)) {
          db.deleteObjectStore(name);
        }
      });
    };
  });
};

const getAllItems = async (storeName) => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(new Error(`Failed to get items from ${storeName}`));
  });
};

const putItem = async (storeName, item) => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(item);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error(`Failed to put item in ${storeName}`));
  });
};

const deleteItem = async (storeName, key) => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error(`Failed to delete item from ${storeName}`));
  });
};

/**
 * @param {string|null} [shopId]
 * @returns {Promise<Array>}
 */
export const getQuickItems = async (shopId = null) => {
  const items = filterByShopScope(await getAllItems(STORES.QUICK_ITEMS), shopId);
  return items.sort((a, b) => (a.position || 0) - (b.position || 0));
};

/**
 * @param {Object} quickItem
 * @param {string|null} [shopId]
 */
export const setQuickItem = async (quickItem, shopId = null) => {
  const scope = resolveShopId(shopId);
  await putItem(STORES.QUICK_ITEMS, {
    ...quickItem,
    ...(scope ? { shopId: scope } : {}),
  });
};

/**
 * @param {string} productId
 */
export const removeQuickItem = async (productId) => {
  await deleteItem(STORES.QUICK_ITEMS, productId);
};

export default {
  getQuickItems,
  setQuickItem,
  removeQuickItem,
};
