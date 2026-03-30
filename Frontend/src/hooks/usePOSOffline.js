/**
 * usePOSOffline Hook
 * 
 * Manages offline functionality for the POS system:
 * - Online/offline status detection
 * - Product caching
 * - Pending sales queue
 * - Background sync when connection is restored
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  cacheProducts,
  getItem,
  searchProductsOffline,
  getProductByBarcodeOffline,
  cacheCustomers,
  getCachedCustomers,
  searchCustomersOffline,
  getCustomerByPhoneOffline,
  setLastCustomerSyncTime,
  shouldRefreshCustomers,
  queuePendingSale,
  getPendingSales,
  updatePendingSaleStatus,
  removeSyncedSale,
  getPendingSalesCount,
  getPendingActionsCount,
  getQuickItems,
  setQuickItem,
  removeQuickItem,
  shouldRefreshProducts,
  setLastSyncTime,
  getAllItems,
  STORES
} from '../utils/posDb';
import productService from '../services/productService';
import customerService from '../services/customerService';
import saleService from '../services/saleService';
import offlineQueueService from '../services/offlineQueueService';
import { showSuccess, showError } from '../utils/toast';

/**
 * Hook for managing POS offline functionality
 * @returns {Object} Offline management functions and state
 */
export const usePOSOffline = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncError, setLastSyncError] = useState(null);
  const [isProductsCached, setIsProductsCached] = useState(false);
  const [isCustomersCached, setIsCustomersCached] = useState(false);
  const syncIntervalRef = useRef(null);
  const isMountedRef = useRef(true);

  /**
   * Update online/offline status
   */
  const handleOnline = useCallback(() => {
    setIsOnline(true);
    // Trigger sync when coming back online
    syncPendingSales();
  }, []);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
  }, []);

  /**
   * Sync product list to offline cache (no API call). Use when you already have products (e.g. from React Query).
   * @param {Array} products - Product array to cache
   */
  const syncProductsToCache = useCallback(async (products) => {
    if (!Array.isArray(products) || products.length === 0) return;
    try {
      await cacheProducts(products);
      await setLastSyncTime(new Date().toISOString());
      setIsProductsCached(true);
    } catch (error) {
      console.error('Failed to sync products to offline cache:', error);
    }
  }, []);

  /**
   * Refresh product cache from server (fetches then caches). Prefer syncProductsToCache when you already have data.
   */
  const refreshProductCache = useCallback(async () => {
    if (!navigator.onLine) {
      console.log('Offline - skipping product cache refresh');
      return false;
    }

    try {
      const products = await productService.getAllActiveProducts();
      await cacheProducts(products);
      await setLastSyncTime(new Date().toISOString());
      setIsProductsCached(true);
      return true;
    } catch (error) {
      console.error('Failed to refresh product cache:', error);
      return false;
    }
  }, []);

  /**
   * Sync customer list to offline cache
   * @param {Array} customers - Customer array to cache
   */
  const syncCustomersToCache = useCallback(async (customers) => {
    if (!Array.isArray(customers) || customers.length === 0) return;
    try {
      await cacheCustomers(customers);
      await setLastCustomerSyncTime(new Date().toISOString());
      setIsCustomersCached(true);
    } catch (error) {
      console.error('Failed to sync customers to offline cache:', error);
    }
  }, []);

  /**
   * Refresh customer cache from server
   */
  const refreshCustomerCache = useCallback(async () => {
    if (!navigator.onLine) {
      console.log('Offline - skipping customer cache refresh');
      return false;
    }

    try {
      const response = await customerService.getCustomers({ limit: 1000, isActive: true });
      const customers = response?.data?.customers || response?.customers || response?.data || [];
      if (Array.isArray(customers) && customers.length > 0) {
        await cacheCustomers(customers);
        await setLastCustomerSyncTime(new Date().toISOString());
        setIsCustomersCached(true);
      }
      return true;
    } catch (error) {
      console.error('Failed to refresh customer cache:', error);
      return false;
    }
  }, []);

  /**
   * Search customers (online or offline)
   * @param {string} query - Search query
   * @returns {Promise<Array>} - Matching customers
   */
  const searchCustomers = useCallback(async (query) => {
    if (navigator.onLine) {
      try {
        const response = await customerService.getCustomers({ search: query, limit: 20, isActive: true });
        const customers = response?.data?.customers || response?.customers || response?.data || [];
        return Array.isArray(customers) ? customers : [];
      } catch (error) {
        console.warn('Online customer search failed, falling back to offline:', error);
      }
    }
    return await searchCustomersOffline(query);
  }, []);

  /**
   * Get customer by phone (online or offline)
   * @param {string} phone - Phone number
   * @returns {Promise<Object|null>} - Customer or null
   */
  const getCustomerByPhone = useCallback(async (phone) => {
    if (navigator.onLine) {
      try {
        const response = await customerService.getCustomers({ search: phone, limit: 5 });
        const customers = response?.data?.customers || response?.customers || response?.data || [];
        const match = Array.isArray(customers) ? customers.find(c => c.phone === phone) : null;
        if (match) return match;
      } catch (error) {
        console.warn('Online customer phone lookup failed, trying offline:', error);
      }
    }
    return await getCustomerByPhoneOffline(phone);
  }, []);

  /**
   * Search products (online or offline)
   * @param {string} query - Search query
   * @returns {Promise<Array>} - Matching products
   */
  const searchProducts = useCallback(async (query) => {
    // Try online first if available
    if (navigator.onLine) {
      try {
        const response = await productService.searchProducts(query);
        // API interceptor returns response.data, so response is already { success, data, pagination }
        const body = response && typeof response === 'object' ? response : {};
        const list = Array.isArray(body.data) ? body.data : (Array.isArray(body.products) ? body.products : []);
        return list;
      } catch (error) {
        console.warn('Online search failed, falling back to offline:', error);
      }
    }

    // Fallback to offline search
    return await searchProductsOffline(query);
  }, []);

  /**
   * Get product by barcode (online or offline)
   * @param {string} barcode - Barcode string
   * @returns {Promise<Object|null>} - Product or null
   */
  const getProductByBarcode = useCallback(async (barcode) => {
    // Try online first if available
    if (navigator.onLine) {
      try {
        const response = await productService.getProductByBarcode(barcode);
        const product = response.data?.data ?? response.data?.product ?? response.product ?? response.data;
        return product?.id ? product : null;
      } catch (error) {
        // Not found or error - try offline
        console.warn('Online barcode lookup failed, trying offline:', error);
      }
    }

    // Fallback to offline lookup
    return await getProductByBarcodeOffline(barcode);
  }, []);

  /**
   * Resolve product from parsed QR payload (product QR code).
   * Online: uses productService.resolveProductFromQRPayload.
   * Offline: barcode lookup then SKU search in cache.
   * @param {Object} qrData - Parsed QR data { name, sku?, barcode? }
   * @returns {Promise<Object|null>} - Product or null
   */
  const resolveProductFromQRPayload = useCallback(async (qrData) => {
    if (!qrData || typeof qrData !== 'object') return null;

    if (navigator.onLine) {
      try {
        const product = await productService.resolveProductFromQRPayload(qrData);
        if (product?.id) return product;
      } catch (e) {
        console.warn('Online QR resolve failed, trying offline:', e);
      }
    }

    const id = (qrData.id || '').trim();
    const barcode = (qrData.barcode || '').trim();
    const sku = (qrData.sku || '').trim();
    const name = (qrData.name || '').trim();

    if (id) {
      const p = await getItem(STORES.PRODUCTS, id);
      if (p?.id) return p;
    }
    if (barcode) {
      const p = await getProductByBarcodeOffline(barcode);
      if (p?.id) return p;
    }
    if (sku) {
      const list = await searchProductsOffline(sku);
      const exact = list.find((p) => (p.sku || '').trim() === sku);
      if (exact?.id) return exact;
    }
    if (name) {
      const list = await searchProductsOffline(name);
      const exact = list.find((p) => (p.name || '').trim().toLowerCase() === name.toLowerCase());
      if (exact?.id) return exact;
    }
    return null;
  }, []);

  /**
   * Process a sale (online or queue for later).
   * Server recomputes tax from tenant settings; optional `metadata.posTaxConfigSnapshot` is for audit/debug only.
   * @param {Object} saleData - Sale payload (include `cartDiscount` when cart-level discount applies)
   * @returns {Promise<Object>} - { success, sale, isQueued }
   */
  const processSale = useCallback(async (saleData) => {
    if (navigator.onLine) {
      try {
        const response = await saleService.createSale(saleData);
        // Backend returns { success, data: createdSale }; createdSale includes invoice, paymentMethod
        const sale = response?.data ?? response?.sale ?? response;
        return {
          success: true,
          sale: sale && typeof sale === 'object' && (sale.id || sale.saleNumber) ? sale : null,
          isQueued: false
        };
      } catch (error) {
        // If network error, queue for later
        if (error.message?.includes('Network') || error.code === 'ERR_NETWORK') {
          console.warn('Network error, queueing sale for later');
          const localId = await queuePendingSale(saleData);
          await updatePendingCount();
          return {
            success: true,
            localId,
            isQueued: true
          };
        }
        throw error;
      }
    }

    // Offline - queue the sale
    const localId = await queuePendingSale(saleData);
    await updatePendingCount();
    return {
      success: true,
      localId,
      isQueued: true
    };
  }, []);

  /**
   * Update pending count
   */
  const updatePendingCount = useCallback(async () => {
    const [salesCount, actionsCount] = await Promise.all([
      getPendingSalesCount(),
      getPendingActionsCount(),
    ]);
    if (isMountedRef.current) {
      setPendingCount(salesCount + actionsCount);
    }
  }, []);

  /**
   * Sync pending sales to server (uses batch API when available)
   */
  const syncPendingSales = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;

    const pending = await getPendingSales();
    if (pending.length === 0) return;

    setIsSyncing(true);
    setLastSyncError(null);

    const localFields = ['localId', 'createdAt', 'syncStatus', 'syncAttempts', 'lastSyncError', 'lastSyncAt', 'serverId'];
    const items = pending.map((sale) => {
      const { ...saleData } = sale;
      localFields.forEach((f) => delete saleData[f]);
      return { clientId: sale.clientId || `local-${sale.localId}`, payload: saleData };
    });

    let syncedCount = 0;
    let failedCount = 0;

    try {
      const { results } = await saleService.syncBatch(items);
      if (Array.isArray(results) && results.length === pending.length) {
        for (let i = 0; i < results.length; i++) {
          const r = results[i];
          const sale = pending[i];
          if (r?.id && !r?.error) {
            await removeSyncedSale(sale.localId);
            syncedCount++;
          } else {
            await updatePendingSaleStatus(sale.localId, 'failed', r?.error || 'Sync failed');
            failedCount++;
          }
        }
      } else {
        for (const sale of pending) {
          await updatePendingSaleStatus(sale.localId, 'syncing');
          try {
            const { localId, createdAt, syncStatus, syncAttempts, lastSyncError, lastSyncAt, serverId, ...saleData } = sale;
            const response = await saleService.createSale({ ...saleData, clientId: sale.clientId });
            const _serverId = response.data?.sale?.id || response.data?.data?.id || response.sale?.id;
            await removeSyncedSale(sale.localId);
            syncedCount++;
          } catch (err) {
            await updatePendingSaleStatus(sale.localId, 'failed', err?.message || 'Sync failed');
            failedCount++;
          }
        }
      }
    } catch (batchError) {
      for (const sale of pending) {
        await updatePendingSaleStatus(sale.localId, 'failed', batchError?.message || 'Sync failed');
        failedCount++;
      }
    }

    await updatePendingCount();
    if (syncedCount > 0) {
      showSuccess(`Synced ${syncedCount} offline sale${syncedCount > 1 ? 's' : ''}`);
    }
    if (failedCount > 0) {
      setLastSyncError(`Failed to sync ${failedCount} sale${failedCount > 1 ? 's' : ''}`);
    }

    // Sync unified queue (products, invoices, quotes, customers)
    const actionsResult = await offlineQueueService.syncPendingActions();
    await updatePendingCount();
    if (actionsResult.synced > 0) {
      showSuccess(`Synced ${actionsResult.synced} offline item${actionsResult.synced > 1 ? 's' : ''}`);
    }
    if (actionsResult.failed > 0) {
      setLastSyncError(
        (prev) => `${prev || ''} ${actionsResult.failed} action(s) failed.`.trim()
      );
    }

    setIsSyncing(false);
  }, [isSyncing]);

  /**
   * Get quick add items
   */
  const getQuickAddItems = useCallback(async () => {
    return await getQuickItems();
  }, []);

  /**
   * Add item to quick add grid
   * @param {Object} product - Product to add
   * @param {number} position - Position in grid
   */
  const addQuickItem = useCallback(async (product, position) => {
    await setQuickItem({
      productId: product.id,
      position,
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku,
        sellingPrice: product.sellingPrice,
        barcode: product.barcode
      }
    });
  }, []);

  /**
   * Remove item from quick add grid
   * @param {string} productId - Product ID to remove
   */
  const removeQuickAddItem = useCallback(async (productId) => {
    await removeQuickItem(productId);
  }, []);

  /**
   * Get all cached products
   */
  const getCachedProducts = useCallback(async () => {
    return await getAllItems(STORES.PRODUCTS);
  }, []);

  /**
   * Initialize offline support
   */
  const initialize = useCallback(async () => {
    // Check if we need to refresh products
    const needsRefresh = await shouldRefreshProducts();
    
    if (needsRefresh && navigator.onLine) {
      await refreshProductCache();
    } else {
      // Check if we have any cached products
      const cached = await getCachedProducts();
      setIsProductsCached(cached.length > 0);
    }

    // Update pending count
    await updatePendingCount();

    // Try to sync any pending sales
    if (navigator.onLine) {
      await syncPendingSales();
    }
  }, [refreshProductCache, getCachedProducts, updatePendingCount, syncPendingSales]);

  // Listen for Background Sync from service worker
  const handleSyncMessage = useCallback((event) => {
    if (event?.data?.type === 'SYNC_PENDING' || event?.data?.type === 'SYNC_SALES') {
      if (navigator.onLine) syncPendingSales();
    }
  }, [syncPendingSales]);

  // Set up event listeners and sync interval
  useEffect(() => {
    isMountedRef.current = true;

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.addEventListener('message', handleSyncMessage);
    }

    // Initialize on mount
    initialize();

    // Set up periodic sync check (every 30 seconds)
    syncIntervalRef.current = setInterval(() => {
      if (navigator.onLine && isMountedRef.current) {
        syncPendingSales();
      }
    }, 30000);

    return () => {
      isMountedRef.current = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.removeEventListener('message', handleSyncMessage);
      }
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [handleOnline, handleOffline, handleSyncMessage, initialize, syncPendingSales]);

  return {
    // Status
    isOnline,
    pendingCount,
    isSyncing,
    lastSyncError,
    isProductsCached,
    isCustomersCached,

    // Product functions
    searchProducts,
    getProductByBarcode,
    resolveProductFromQRPayload,
    refreshProductCache,
    syncProductsToCache,
    getCachedProducts,

    // Customer functions
    searchCustomers,
    getCustomerByPhone,
    refreshCustomerCache,
    syncCustomersToCache,

    // Sale functions
    processSale,
    syncPendingSales,

    // Quick items
    getQuickAddItems,
    addQuickItem,
    removeQuickAddItem
  };
};

export default usePOSOffline;
