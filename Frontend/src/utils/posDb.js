/**
 * IndexedDB utility for POS offline storage
 * 
 * Provides offline-first storage for:
 * - Products cache for instant search
 * - Customers cache for instant lookup
 * - Pending sales queue for offline transactions
 * - Quick items configuration for frequently sold items
 */

const DB_NAME = 'shopwise_pos';
const DB_VERSION = 3;

// Store names
export const STORES = {
  PRODUCTS: 'pos_products',
  CUSTOMERS: 'pos_customers',
  PENDING_SALES: 'pos_pending_sales',
  QUICK_ITEMS: 'pos_quick_items',
  SYNC_META: 'pos_sync_meta',
  DASHBOARD_CACHE: 'dashboard_cache'
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

      // Customers store - indexed by id, name, phone, and email
      if (!db.objectStoreNames.contains(STORES.CUSTOMERS)) {
        const customersStore = db.createObjectStore(STORES.CUSTOMERS, { keyPath: 'id' });
        customersStore.createIndex('name', 'name', { unique: false });
        customersStore.createIndex('phone', 'phone', { unique: false });
        customersStore.createIndex('email', 'email', { unique: false });
        customersStore.createIndex('isActive', 'isActive', { unique: false });
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

      // Dashboard cache store - for instant dashboard loading
      if (!db.objectStoreNames.contains(STORES.DASHBOARD_CACHE)) {
        const dashboardStore = db.createObjectStore(STORES.DASHBOARD_CACHE, { keyPath: 'cacheKey' });
        dashboardStore.createIndex('tenantId', 'tenantId', { unique: false });
        dashboardStore.createIndex('cachedAt', 'cachedAt', { unique: false });
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

// ============ Customer-specific functions ============

/**
 * Cache customers locally for offline access
 * @param {Array} customers - Array of customers to cache
 * @returns {Promise<void>}
 */
export const cacheCustomers = async (customers) => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.CUSTOMERS, 'readwrite');
    const store = transaction.objectStore(STORES.CUSTOMERS);
    
    // Clear existing and add new
    store.clear();
    
    customers.forEach(customer => {
      store.put({ ...customer, _cachedAt: Date.now() });
    });
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new Error('Failed to cache customers'));
  });
};

/**
 * Get all cached customers
 * @returns {Promise<Array>}
 */
export const getCachedCustomers = async () => {
  return await getAllItems(STORES.CUSTOMERS);
};

/**
 * Search customers locally by name, phone, or email
 * @param {string} query - Search query
 * @returns {Promise<Array>}
 */
export const searchCustomersOffline = async (query) => {
  const customers = await getAllItems(STORES.CUSTOMERS);
  const lowerQuery = query.toLowerCase().trim();
  
  if (!lowerQuery) {
    return customers.filter(c => c.isActive !== false).slice(0, 50);
  }
  
  return customers.filter(customer => {
    if (customer.isActive === false) return false;
    
    const nameMatch = customer.name?.toLowerCase().includes(lowerQuery);
    const phoneMatch = customer.phone?.includes(lowerQuery);
    const emailMatch = customer.email?.toLowerCase().includes(lowerQuery);
    const companyMatch = customer.company?.toLowerCase().includes(lowerQuery);
    
    return nameMatch || phoneMatch || emailMatch || companyMatch;
  }).slice(0, 50);
};

/**
 * Get customer by phone (exact match)
 * @param {string} phone - Phone to search
 * @returns {Promise<Object|null>}
 */
export const getCustomerByPhoneOffline = async (phone) => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.CUSTOMERS, 'readonly');
    const store = transaction.objectStore(STORES.CUSTOMERS);
    const index = store.index('phone');
    const request = index.get(phone);
    
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(new Error('Failed to get customer by phone'));
  });
};

/**
 * Add or update a single customer in the cache
 * @param {Object} customer - Customer object
 * @returns {Promise<void>}
 */
export const cacheCustomer = async (customer) => {
  await putItem(STORES.CUSTOMERS, { ...customer, _cachedAt: Date.now() });
};

/**
 * Remove a customer from cache
 * @param {string} customerId - Customer ID to remove
 * @returns {Promise<void>}
 */
export const removeCustomerFromCache = async (customerId) => {
  await deleteItem(STORES.CUSTOMERS, customerId);
};

/**
 * Get last customer sync timestamp
 * @returns {Promise<string|null>}
 */
export const getLastCustomerSyncTime = async () => {
  const meta = await getItem(STORES.SYNC_META, 'lastCustomerSync');
  return meta?.timestamp || null;
};

/**
 * Set last customer sync timestamp
 * @param {string} timestamp - ISO timestamp
 * @returns {Promise<void>}
 */
export const setLastCustomerSyncTime = async (timestamp) => {
  await putItem(STORES.SYNC_META, { key: 'lastCustomerSync', timestamp });
};

/**
 * Check if customers need to be refreshed (older than 5 minutes)
 * @returns {Promise<boolean>}
 */
export const shouldRefreshCustomers = async () => {
  const lastSync = await getLastCustomerSyncTime();
  if (!lastSync) return true;
  
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  return lastSync < fiveMinutesAgo;
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

// ============ Dashboard Cache functions ============

const DASHBOARD_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Generate cache key for dashboard data
 * @param {string} tenantId - Tenant ID
 * @param {string} filterType - Filter type (today, thisMonth, etc.)
 * @returns {string} Cache key
 */
export const getDashboardCacheKey = (tenantId, filterType = 'thisMonth') => {
  return `${tenantId}:${filterType}`;
};

/**
 * Get cached dashboard data
 * @param {string} tenantId - Tenant ID
 * @param {string} filterType - Filter type
 * @returns {Promise<Object|null>} Cached data or null
 */
export const getCachedDashboard = async (tenantId, filterType = 'thisMonth') => {
  try {
    const cacheKey = getDashboardCacheKey(tenantId, filterType);
    const cached = await getItem(STORES.DASHBOARD_CACHE, cacheKey);
    
    if (!cached) return null;
    
    // Check if cache is still valid (2 min TTL)
    if (Date.now() - cached.cachedAt > DASHBOARD_CACHE_TTL_MS) {
      // Cache expired, but return stale data for instant display
      return { ...cached.data, _stale: true };
    }
    
    return cached.data;
  } catch (error) {
    console.error('[posDb] Failed to get cached dashboard:', error);
    return null;
  }
};

/**
 * Cache dashboard data
 * @param {string} tenantId - Tenant ID
 * @param {string} filterType - Filter type
 * @param {Object} data - Dashboard data
 * @returns {Promise<void>}
 */
export const cacheDashboard = async (tenantId, filterType, data) => {
  try {
    const cacheKey = getDashboardCacheKey(tenantId, filterType);
    await putItem(STORES.DASHBOARD_CACHE, {
      cacheKey,
      tenantId,
      filterType,
      data,
      cachedAt: Date.now()
    });
  } catch (error) {
    console.error('[posDb] Failed to cache dashboard:', error);
  }
};

/**
 * Clear all dashboard cache for a tenant
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<void>}
 */
export const clearDashboardCache = async (tenantId) => {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(STORES.DASHBOARD_CACHE, 'readwrite');
    const store = transaction.objectStore(STORES.DASHBOARD_CACHE);
    const index = store.index('tenantId');
    const request = index.openCursor(tenantId);
    
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        store.delete(cursor.primaryKey);
        cursor.continue();
      }
    };
  } catch (error) {
    console.error('[posDb] Failed to clear dashboard cache:', error);
  }
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
  cacheCustomers,
  getCachedCustomers,
  searchCustomersOffline,
  getCustomerByPhoneOffline,
  cacheCustomer,
  removeCustomerFromCache,
  getLastCustomerSyncTime,
  setLastCustomerSyncTime,
  shouldRefreshCustomers,
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
  shouldRefreshProducts,
  getDashboardCacheKey,
  getCachedDashboard,
  cacheDashboard,
  clearDashboardCache
};
