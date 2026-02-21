/**
 * Product Service
 * 
 * API service for product operations in the POS system.
 * Provides product listing, search, barcode lookup, offline caching,
 * and variant management for African market businesses.
 */

import api from './api';

// Cache keys for offline storage
const CACHE_KEYS = {
  PRODUCTS: 'shopwise_products_cache',
  PRODUCTS_TIMESTAMP: 'shopwise_products_cache_timestamp',
  CATEGORIES: 'shopwise_categories_cache',
  PENDING_CHANGES: 'shopwise_pending_product_changes',
};

// Cache expiration time (30 minutes)
const CACHE_EXPIRATION_MS = 30 * 60 * 1000;

const productService = {
  // =============================================
  // CORE PRODUCT OPERATIONS
  // =============================================

  /**
   * Get all products with optional filters
   * @param {Object} params - Query parameters
   * @param {number} [params.page] - Page number
   * @param {number} [params.limit] - Items per page
   * @param {string} [params.search] - Search query
   * @param {string} [params.categoryId] - Filter by category
   * @param {boolean} [params.isActive] - Filter by active status
   * @param {string} [params.shopId] - Filter by shop
   * @returns {Promise<Object>} - { products, pagination }
   */
  getProducts: async (params = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      searchParams.append(key, value);
    });
    const query = searchParams.toString();
    return api.get(query ? `/products?${query}` : '/products');
  },

  /**
   * Get a single product by ID
   * @param {string} id - Product ID
   * @returns {Promise<Object>} - Product object
   */
  getProductById: async (id) => {
    return api.get(`/products/${id}`);
  },

  /**
   * Get sales/movement history for a product
   * @param {string} productId - Product ID
   * @param {Object} params - { page, limit }
   * @returns {Promise<Object>} - { data: saleItems[], count, pagination }
   */
  getProductSales: async (productId, params = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      searchParams.append(key, value);
    });
    const query = searchParams.toString();
    return api.get(`/products/${productId}/sales${query ? `?${query}` : ''}`);
  },

  /**
   * Get product by barcode
   * @param {string} barcode - Barcode string
   * @returns {Promise<Object>} - Product object
   */
  getProductByBarcode: async (barcode) => {
    return api.get(`/products/barcode/${encodeURIComponent(barcode)}`);
  },

  /**
   * Resolve product from parsed QR payload (product QR code JSON).
   * Tries id first (from our generated QR), then barcode, then SKU, then name.
   * @param {Object} qrData - Parsed QR data { id?, name, sku?, barcode? }
   * @returns {Promise<Object|null>} - Product or null
   */
  resolveProductFromQRPayload: async (qrData) => {
    if (!qrData || typeof qrData !== 'object') return null;
    const id = (qrData.id || '').trim();
    const barcode = (qrData.barcode || '').trim();
    const sku = (qrData.sku || '').trim();
    const name = (qrData.name || '').trim();

    if (id) {
      try {
        const res = await api.get(`/products/${encodeURIComponent(id)}`);
        const product = res?.data?.data ?? res?.data?.product ?? res?.product ?? res?.data;
        if (product?.id) return product;
      } catch (_) {}
    }

    if (barcode) {
      try {
        const res = await api.get(`/products/barcode/${encodeURIComponent(barcode)}`);
        const product = res?.data?.data ?? res?.data?.product ?? res?.product ?? res?.data;
        if (product?.id) return product;
      } catch (_) {}
    }

    if (sku) {
      try {
        const res = await api.get(`/products?search=${encodeURIComponent(sku)}&limit=50`);
        const list = Array.isArray(res?.data?.data) ? res.data.data : (res?.data?.products ?? res?.products ?? []);
        const exact = list.find((p) => (p.sku || '').trim() === sku);
        if (exact?.id) return exact;
      } catch (_) {}
    }

    if (name) {
      try {
        const res = await api.get(`/products?search=${encodeURIComponent(name)}&limit=50`);
        const list = Array.isArray(res?.data?.data) ? res.data.data : (res?.data?.products ?? res?.products ?? []);
        const exact = list.find((p) => (p.name || '').trim().toLowerCase() === name.toLowerCase());
        if (exact?.id) return exact;
      } catch (_) {}
    }

    return null;
  },

  /**
   * Search products by name, SKU, or barcode
   * @param {string} query - Search query
   * @param {Object} [options] - Additional options
   * @param {number} [options.limit] - Max results (default 50)
   * @returns {Promise<Object>} - { products }
   */
  searchProducts: async (query, options = {}) => {
    const params = new URLSearchParams();
    params.append('search', query);
    params.append('limit', options.limit || 50);
    params.append('isActive', true);
    return api.get(`/products?${params.toString()}`);
  },

  /**
   * Get all active products for POS (used for offline caching)
   * @returns {Promise<Array>} - Array of products
   */
  getAllActiveProducts: async () => {
    const params = new URLSearchParams();
    params.append('isActive', true);
    params.append('limit', 1000); // Get all products for caching
    const response = await api.get(`/products?${params.toString()}`);
    // API response interceptor returns response.data, so response is already { success, data, pagination }
    const body = response && typeof response === 'object' ? response : {};
    const list = Array.isArray(body.data) ? body.data : (Array.isArray(body.products) ? body.products : []);
    return list;
  },

  /**
   * Create a new product
   * @param {Object} payload - Product data
   * @returns {Promise<Object>} - Created product
   */
  createProduct: async (payload) => {
    const result = await api.post('/products', payload);
    // Clear cache after creating
    productService.clearCache();
    return result;
  },

  /**
   * Update a product
   * @param {string} id - Product ID
   * @param {Object} payload - Updated product data
   * @returns {Promise<Object>} - Updated product
   */
  updateProduct: async (id, payload) => {
    const result = await api.put(`/products/${id}`, payload);
    // Clear cache after updating
    productService.clearCache();
    return result;
  },

  /**
   * Delete a product
   * @param {string} id - Product ID
   * @returns {Promise<void>}
   */
  deleteProduct: async (id) => {
    const result = await api.delete(`/products/${id}`);
    // Clear cache after deleting
    productService.clearCache();
    return result;
  },

  /**
   * Export products (CSV or Excel). Admin/manager only.
   * @param {Object} [params] - { format: 'csv'|'excel', categoryId, isActive }
   * @returns {Promise<Blob>} - File blob for download
   */
  exportProducts: async (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.format) searchParams.append('format', params.format);
    if (params.categoryId) searchParams.append('categoryId', params.categoryId);
    if (params.isActive !== undefined) searchParams.append('isActive', params.isActive);
    const query = searchParams.toString();
    const response = await api.get(`/products/export${query ? `?${query}` : ''}`, {
      responseType: 'blob',
    });
    return response;
  },

  /**
   * Duplicate a product
   * @param {string} id - Product ID to duplicate
   * @param {Object} [overrides] - Fields to override in the duplicate
   * @returns {Promise<Object>} - Created product
   */
  duplicateProduct: async (id, overrides = {}) => {
    const response = await productService.getProductById(id);
    const original = response.data || response;
    
    // Create duplicate with overrides (imageUrl not copied; user can add new image)
    const duplicate = {
      name: `${original.name} (Copy)`,
      sku: original.sku ? `${original.sku}-COPY` : undefined,
      barcode: undefined, // Don't duplicate barcode
      description: original.description,
      categoryId: original.categoryId,
      costPrice: original.costPrice,
      sellingPrice: original.sellingPrice,
      quantityOnHand: 0, // Start with zero stock
      reorderLevel: original.reorderLevel,
      reorderQuantity: original.reorderQuantity,
      unit: original.unit,
      brand: original.brand,
      supplier: original.supplier,
      hasVariants: false, // Don't duplicate variants initially
      isActive: true,
      metadata: { ...original.metadata },
      ...overrides,
    };
    
    return productService.createProduct(duplicate);
  },

  /**
   * Upload product image
   * @param {File} file - Image file
   * @returns {Promise<{ imageUrl: string }>}
   */
  uploadProductImage: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post('/products/upload-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res;
  },

  /**
   * Get product categories (from product_categories table, NOT inventory_categories)
   * @returns {Promise<Array>} - Array of categories
   */
  getCategories: async () => {
    const res = await api.get('/products/categories');
    console.log('[productService.getCategories] GET /products/categories (product_categories)');
    return res;
  },

  /**
   * Create a new product category
   * @param {Object} payload - Category data
   * @param {string} payload.name - Category name
   * @param {string} [payload.description] - Category description
   * @returns {Promise<Object>} - Created category
   */
  createCategory: async (payload) => {
    return api.post('/products/categories', payload);
  },

  // =============================================
  // PRODUCT VARIANT OPERATIONS
  // =============================================

  /**
   * Get variants for a product
   * @param {string} productId - Product ID
   * @returns {Promise<Array>} - Array of variants
   */
  getProductVariants: async (productId) => {
    return api.get(`/products/${productId}/variants`);
  },

  /**
   * Create a product variant
   * @param {string} productId - Product ID
   * @param {Object} payload - Variant data
   * @param {string} payload.name - Variant name (e.g., "Red - Large")
   * @param {string} [payload.sku] - Variant SKU
   * @param {string} [payload.barcode] - Variant barcode
   * @param {number} [payload.costPrice] - Override cost price
   * @param {number} [payload.sellingPrice] - Override selling price
   * @param {number} [payload.quantityOnHand] - Initial quantity
   * @param {Object} [payload.attributes] - Variant attributes (size, color, etc.)
   * @returns {Promise<Object>} - Created variant
   */
  createProductVariant: async (productId, payload) => {
    return api.post(`/products/${productId}/variants`, payload);
  },

  /**
   * Update a product variant
   * @param {string} variantId - Variant ID
   * @param {Object} payload - Updated variant data
   * @returns {Promise<Object>} - Updated variant
   */
  updateProductVariant: async (variantId, payload) => {
    return api.put(`/products/variants/${variantId}`, payload);
  },

  /**
   * Delete a product variant
   * @param {string} variantId - Variant ID
   * @returns {Promise<void>}
   */
  deleteProductVariant: async (variantId) => {
    return api.delete(`/products/variants/${variantId}`);
  },

  /**
   * Bulk create variants for a product (e.g., for size/color combinations)
   * @param {string} productId - Product ID
   * @param {Array} variants - Array of variant data
   * @returns {Promise<Array>} - Array of created variants
   */
  bulkCreateVariants: async (productId, variants) => {
    const results = [];
    for (const variant of variants) {
      const result = await productService.createProductVariant(productId, variant);
      results.push(result);
    }
    return results;
  },

  // =============================================
  // OFFLINE CACHING OPERATIONS
  // =============================================

  /**
   * Cache products to localStorage for offline access
   * @param {Array} products - Products to cache
   * @returns {void}
   */
  cacheProducts: (products) => {
    try {
      localStorage.setItem(CACHE_KEYS.PRODUCTS, JSON.stringify(products));
      localStorage.setItem(CACHE_KEYS.PRODUCTS_TIMESTAMP, Date.now().toString());
    } catch (error) {
      console.warn('[ProductService] Failed to cache products:', error);
    }
  },

  /**
   * Get cached products from localStorage
   * @param {boolean} [ignoreExpiration=false] - Whether to ignore cache expiration
   * @returns {Array|null} - Cached products or null if not found/expired
   */
  getCachedProducts: (ignoreExpiration = false) => {
    try {
      const cached = localStorage.getItem(CACHE_KEYS.PRODUCTS);
      const timestamp = localStorage.getItem(CACHE_KEYS.PRODUCTS_TIMESTAMP);
      
      if (!cached) return null;
      
      // Check expiration
      if (!ignoreExpiration && timestamp) {
        const age = Date.now() - parseInt(timestamp, 10);
        if (age > CACHE_EXPIRATION_MS) {
          return null;
        }
      }
      
      return JSON.parse(cached);
    } catch (error) {
      console.warn('[ProductService] Failed to retrieve cached products:', error);
      return null;
    }
  },

  /**
   * Check if cache is valid (not expired)
   * @returns {boolean}
   */
  isCacheValid: () => {
    const timestamp = localStorage.getItem(CACHE_KEYS.PRODUCTS_TIMESTAMP);
    if (!timestamp) return false;
    
    const age = Date.now() - parseInt(timestamp, 10);
    return age <= CACHE_EXPIRATION_MS;
  },

  /**
   * Get cache age in milliseconds
   * @returns {number|null}
   */
  getCacheAge: () => {
    const timestamp = localStorage.getItem(CACHE_KEYS.PRODUCTS_TIMESTAMP);
    if (!timestamp) return null;
    return Date.now() - parseInt(timestamp, 10);
  },

  /**
   * Clear product cache
   * @returns {void}
   */
  clearCache: () => {
    try {
      localStorage.removeItem(CACHE_KEYS.PRODUCTS);
      localStorage.removeItem(CACHE_KEYS.PRODUCTS_TIMESTAMP);
      localStorage.removeItem(CACHE_KEYS.CATEGORIES);
    } catch (error) {
      console.warn('[ProductService] Failed to clear cache:', error);
    }
  },

  /**
   * Cache categories to localStorage
   * @param {Array} categories - Categories to cache
   * @returns {void}
   */
  cacheCategories: (categories) => {
    try {
      localStorage.setItem(CACHE_KEYS.CATEGORIES, JSON.stringify(categories));
    } catch (error) {
      console.warn('[ProductService] Failed to cache categories:', error);
    }
  },

  /**
   * Get cached categories
   * @returns {Array|null}
   */
  getCachedCategories: () => {
    try {
      const cached = localStorage.getItem(CACHE_KEYS.CATEGORIES);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.warn('[ProductService] Failed to retrieve cached categories:', error);
      return null;
    }
  },

  // =============================================
  // OFFLINE SYNC OPERATIONS
  // =============================================

  /**
   * Queue a change for later sync (when offline)
   * @param {string} action - Action type ('create', 'update', 'delete')
   * @param {Object} data - Change data
   * @returns {void}
   */
  queueOfflineChange: (action, data) => {
    try {
      const pending = JSON.parse(localStorage.getItem(CACHE_KEYS.PENDING_CHANGES) || '[]');
      pending.push({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        action,
        data,
        timestamp: Date.now(),
      });
      localStorage.setItem(CACHE_KEYS.PENDING_CHANGES, JSON.stringify(pending));
    } catch (error) {
      console.warn('[ProductService] Failed to queue offline change:', error);
    }
  },

  /**
   * Get pending offline changes
   * @returns {Array}
   */
  getPendingChanges: () => {
    try {
      const pending = localStorage.getItem(CACHE_KEYS.PENDING_CHANGES);
      return pending ? JSON.parse(pending) : [];
    } catch (error) {
      console.warn('[ProductService] Failed to get pending changes:', error);
      return [];
    }
  },

  /**
   * Sync pending offline changes
   * @returns {Promise<Object>} - Sync results
   */
  syncPendingChanges: async () => {
    const pending = productService.getPendingChanges();
    if (pending.length === 0) {
      return { synced: 0, failed: 0, errors: [] };
    }
    
    const results = { synced: 0, failed: 0, errors: [] };
    const remaining = [];
    
    for (const change of pending) {
      try {
        switch (change.action) {
          case 'create':
            await api.post('/products', change.data);
            break;
          case 'update':
            await api.put(`/products/${change.data.id}`, change.data);
            break;
          case 'delete':
            await api.delete(`/products/${change.data.id}`);
            break;
          default:
            remaining.push(change);
            continue;
        }
        results.synced++;
      } catch (error) {
        results.failed++;
        results.errors.push({ change, error: error.message });
        remaining.push(change); // Keep for retry
      }
    }
    
    // Update pending changes with remaining
    localStorage.setItem(CACHE_KEYS.PENDING_CHANGES, JSON.stringify(remaining));
    
    // Clear cache to refresh data
    if (results.synced > 0) {
      productService.clearCache();
    }
    
    return results;
  },

  /**
   * Clear pending offline changes
   * @returns {void}
   */
  clearPendingChanges: () => {
    try {
      localStorage.removeItem(CACHE_KEYS.PENDING_CHANGES);
    } catch (error) {
      console.warn('[ProductService] Failed to clear pending changes:', error);
    }
  },

  // =============================================
  // STOCK OPERATIONS
  // =============================================

  /**
   * Adjust product stock
   * @param {string} id - Product ID
   * @param {number} quantity - New quantity (for set) or delta (for adjust)
   * @param {string} [mode='set'] - 'set' to set exact quantity, 'delta' to add/subtract
   * @param {string} [reason] - Reason for adjustment
   * @returns {Promise<Object>} - Updated product
   */
  adjustStock: async (id, quantity, mode = 'set', reason = '') => {
    const response = await productService.getProductById(id);
    const product = response.data || response;
    
    let newQuantity;
    if (mode === 'delta') {
      newQuantity = parseFloat(product.quantityOnHand || 0) + quantity;
    } else {
      newQuantity = quantity;
    }
    
    return productService.updateProduct(id, {
      quantityOnHand: Math.max(0, newQuantity),
      metadata: {
        ...product.metadata,
        lastStockAdjustment: {
          previousQuantity: product.quantityOnHand,
          newQuantity,
          mode,
          reason,
          timestamp: new Date().toISOString(),
        },
      },
    });
  },

  // =============================================
  // BULK PRICING OPERATIONS
  // =============================================

  /**
   * Set bulk pricing tiers for a product
   * @param {string} id - Product ID
   * @param {Array} tiers - Array of pricing tiers
   * @param {number} tiers[].minQuantity - Minimum quantity for tier
   * @param {number} tiers[].maxQuantity - Maximum quantity for tier (use null for unlimited)
   * @param {number} tiers[].price - Price for this tier
   * @returns {Promise<Object>} - Updated product
   */
  setBulkPricing: async (id, tiers) => {
    const response = await productService.getProductById(id);
    const product = response.data || response;
    
    return productService.updateProduct(id, {
      metadata: {
        ...product.metadata,
        bulkPricing: tiers.sort((a, b) => a.minQuantity - b.minQuantity),
      },
    });
  },

  /**
   * Get price for a quantity (considering bulk pricing)
   * @param {Object} product - Product object
   * @param {number} quantity - Quantity to price
   * @returns {number} - Price per unit
   */
  getPriceForQuantity: (product, quantity) => {
    const bulkPricing = product.metadata?.bulkPricing;
    
    if (!bulkPricing || !Array.isArray(bulkPricing) || bulkPricing.length === 0) {
      return parseFloat(product.sellingPrice) || 0;
    }
    
    // Find applicable tier
    const tier = bulkPricing.find(t => 
      quantity >= t.minQuantity && 
      (t.maxQuantity === null || quantity <= t.maxQuantity)
    );
    
    return tier ? tier.price : (parseFloat(product.sellingPrice) || 0);
  },
};

export default productService;
