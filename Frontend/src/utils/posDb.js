/**
 * IndexedDB utility for POS offline storage
 * 
 * Provides offline-first storage for:
 * - Products cache for instant search
 * - Pending sales queue for offline transactions
 * - Quick items configuration for frequently sold items
 */

const DB_NAME = 'shopwise_pos';
const DB_VERSION = 1;

// Store names
export const STORES = {
  PRODUCTS: 'pos_products',
  PENDING_SALES: 'pos_pending_sales',
  QUICK_ITEMS: 'pos_quick_items',
  SYNC_META: 'pos_sync_meta'
};

let dbInstance = null;

/**
 * Opens and returns the IndexedDB database instance
 * @returns {Promise<IDBDatabase>}
 */
export const openDatabase = () => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open POS database'));
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Products store - indexed by id, sku, barcode, and name
      if (!db.objectStoreNames.contains(STORES.PRODUCTS)) {
        const productsStore = db.createObjectStore(STORES.PRODUCTS, { keyPath: 'id' });
        productsStore.createIndex('sku', 'sku', { unique: false });
        productsStore.createIndex('barcode', 'barcode', { unique: false });
        productsStore.createIndex('name', 'name', { unique: false });
        productsStore.createIndex('isActive', 'isActive', { unique: false });
      }

      // Pending sales store - for offline transactions
      if (!db.objectStoreNames.contains(STORES.PENDING_SALES)) {
        const salesStore = db.createObjectStore(STORES.PENDING_SALES, { 
          keyPath: 'localId',
          autoIncrement: true 
        });
        salesStore.createIndex('createdAt', 'createdAt', { unique: false });
        salesStore.createIndex('syncStatus', 'syncStatus', { unique: false });
      }

      // Quick items store - frequently sold items
      if (!db.objectStoreNames.contains(STORES.QUICK_ITEMS)) {
        const quickStore = db.createObjectStore(STORES.QUICK_ITEMS, { keyPath: 'productId' });
        quickStore.createIndex('position', 'position', { unique: false });
      }

      // Sync metadata store
      if (!db.objectStoreNames.contains(STORES.SYNC_META)) {
        db.createObjectStore(STORES.SYNC_META, { keyPath: 'key' });
      }
    };
  });
};

/**
 * Generic function to add or update an item in a store
 * @param {string} storeName - The store name
 * @param {Object} item - The item to add/update
 * @returns {Promise<any>}
 */
export const putItem = async (storeName, item) => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(item);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error(`Failed to put item in ${storeName}`));
  });
};

/**
 * Generic function to get an item by key
 * @param {string} storeName - The store name
 * @param {any} key - The key to look up
 * @returns {Promise<any>}
 */
export const getItem = async (storeName, key) => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error(`Failed to get item from ${storeName}`));
  });
};

/**
 * Generic function to get all items from a store
 * @param {string} storeName - The store name
 * @returns {Promise<Array>}
 */
export const getAllItems = async (storeName) => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(new Error(`Failed to get items from ${storeName}`));
  });
};

/**
 * Generic function to delete an item by key
 * @param {string} storeName - The store name
 * @param {any} key - The key to delete
 * @returns {Promise<void>}
 */
export const deleteItem = async (storeName, key) => {
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
 * Clear all items from a store
 * @param {string} storeName - The store name
 * @returns {Promise<void>}
 */
export const clearStore = async (storeName) => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error(`Failed to clear ${storeName}`));
  });
};

// ============ Product-specific functions ============

/**
 * Cache products locally for offline access
 * @param {Array} products - Array of products to cache
 * @returns {Promise<void>}
 */
export const cacheProducts = async (products) => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.PRODUCTS, 'readwrite');
    const store = transaction.objectStore(STORES.PRODUCTS);
    
    // Clear existing and add new
    store.clear();
    
    products.forEach(product => {
      store.put(product);
    });
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new Error('Failed to cache products'));
  });
};

/**
 * Search products locally by name, SKU, or barcode
 * @param {string} query - Search query
 * @returns {Promise<Array>}
 */
export const searchProductsOffline = async (query) => {
  const products = await getAllItems(STORES.PRODUCTS);
  const lowerQuery = query.toLowerCase().trim();
  
  if (!lowerQuery) {
    return products.filter(p => p.isActive !== false).slice(0, 50);
  }
  
  return products.filter(product => {
    if (product.isActive === false) return false;
    
    const nameMatch = product.name?.toLowerCase().includes(lowerQuery);
    const skuMatch = product.sku?.toLowerCase().includes(lowerQuery);
    const barcodeMatch = product.barcode?.toLowerCase() === lowerQuery;
    
    return nameMatch || skuMatch || barcodeMatch;
  }).slice(0, 50);
};

/**
 * Get product by barcode (exact match)
 * @param {string} barcode - Barcode to search
 * @returns {Promise<Object|null>}
 */
export const getProductByBarcodeOffline = async (barcode) => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.PRODUCTS, 'readonly');
    const store = transaction.objectStore(STORES.PRODUCTS);
    const index = store.index('barcode');
    const request = index.get(barcode);
    
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(new Error('Failed to get product by barcode'));
  });
};

// ============ Pending Sales functions ============

/**
 * Add a sale to the pending queue (for offline processing)
 * @param {Object} saleData - The sale data to queue
 * @returns {Promise<number>} - The local ID of the queued sale
 */
export const queuePendingSale = async (saleData) => {
  const pendingSale = {
    ...saleData,
    createdAt: new Date().toISOString(),
    syncStatus: 'pending',
    syncAttempts: 0,
    lastSyncError: null
  };
  
  return await putItem(STORES.PENDING_SALES, pendingSale);
};

/**
 * Get all pending sales that need to be synced
 * @returns {Promise<Array>}
 */
export const getPendingSales = async () => {
  const sales = await getAllItems(STORES.PENDING_SALES);
  return sales.filter(s => s.syncStatus === 'pending' || s.syncStatus === 'failed');
};

/**
 * Update sync status for a pending sale
 * @param {number} localId - The local ID of the sale
 * @param {string} status - 'pending', 'syncing', 'synced', 'failed'
 * @param {string} [error] - Error message if failed
 * @param {string} [serverId] - Server ID if synced successfully
 * @returns {Promise<void>}
 */
export const updatePendingSaleStatus = async (localId, status, error = null, serverId = null) => {
  const sale = await getItem(STORES.PENDING_SALES, localId);
  if (sale) {
    sale.syncStatus = status;
    sale.syncAttempts = (sale.syncAttempts || 0) + (status === 'syncing' ? 1 : 0);
    sale.lastSyncError = error;
    sale.serverId = serverId;
    sale.lastSyncAt = new Date().toISOString();
    await putItem(STORES.PENDING_SALES, sale);
  }
};

/**
 * Remove a synced sale from pending queue
 * @param {number} localId - The local ID of the sale
 * @returns {Promise<void>}
 */
export const removeSyncedSale = async (localId) => {
  await deleteItem(STORES.PENDING_SALES, localId);
};

/**
 * Get count of pending sales
 * @returns {Promise<number>}
 */
export const getPendingSalesCount = async () => {
  const sales = await getPendingSales();
  return sales.length;
};

// ============ Quick Items functions ============

/**
 * Get all quick add items sorted by position
 * @returns {Promise<Array>}
 */
export const getQuickItems = async () => {
  const items = await getAllItems(STORES.QUICK_ITEMS);
  return items.sort((a, b) => (a.position || 0) - (b.position || 0));
};

/**
 * Add or update a quick item
 * @param {Object} quickItem - { productId, position, product }
 * @returns {Promise<void>}
 */
export const setQuickItem = async (quickItem) => {
  await putItem(STORES.QUICK_ITEMS, quickItem);
};

/**
 * Remove a quick item
 * @param {string} productId - The product ID to remove
 * @returns {Promise<void>}
 */
export const removeQuickItem = async (productId) => {
  await deleteItem(STORES.QUICK_ITEMS, productId);
};

// ============ Sync Metadata functions ============

/**
 * Get last sync timestamp
 * @returns {Promise<string|null>}
 */
export const getLastSyncTime = async () => {
  const meta = await getItem(STORES.SYNC_META, 'lastProductSync');
  return meta?.timestamp || null;
};

/**
 * Set last sync timestamp
 * @param {string} timestamp - ISO timestamp
 * @returns {Promise<void>}
 */
export const setLastSyncTime = async (timestamp) => {
  await putItem(STORES.SYNC_META, { key: 'lastProductSync', timestamp });
};

/**
 * Check if products need to be refreshed (older than 5 minutes)
 * @returns {Promise<boolean>}
 */
export const shouldRefreshProducts = async () => {
  const lastSync = await getLastSyncTime();
  if (!lastSync) return true;
  
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  return lastSync < fiveMinutesAgo;
};

export default {
  openDatabase,
  STORES,
  putItem,
  getItem,
  getAllItems,
  deleteItem,
  clearStore,
  cacheProducts,
  searchProductsOffline,
  getProductByBarcodeOffline,
  queuePendingSale,
  getPendingSales,
  updatePendingSaleStatus,
  removeSyncedSale,
  getPendingSalesCount,
  getQuickItems,
  setQuickItem,
  removeQuickItem,
  getLastSyncTime,
  setLastSyncTime,
  shouldRefreshProducts
};
