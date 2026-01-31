const NodeCache = require('node-cache');

// Create cache instance with default TTL of 2 minutes
const cache = new NodeCache({
  stdTTL: 120, // 2 minutes default TTL
  checkperiod: 60, // Check for expired keys every 60 seconds
  useClones: false // Don't clone objects for better performance
});

/**
 * Generate cache key for dashboard data
 * @param {string} tenantId - Tenant ID
 * @param {string} endpoint - API endpoint (e.g., 'overview', 'revenue-by-month')
 * @param {object} params - Additional parameters (e.g., date filters)
 * @returns {string} Cache key
 */
const generateCacheKey = (tenantId, endpoint, params = {}) => {
  const paramString = Object.keys(params)
    .sort()
    .map(key => `${key}:${params[key]}`)
    .join('|');
  return `dashboard:${tenantId}:${endpoint}${paramString ? `:${paramString}` : ''}`;
};

/**
 * Generate cache key for report data
 * @param {string} tenantId - Tenant ID
 * @param {string} reportType - Report type (e.g., 'revenue', 'expense')
 * @param {object} params - Query parameters
 * @returns {string} Cache key
 */
const generateReportCacheKey = (tenantId, reportType, params = {}) => {
  const paramString = Object.keys(params)
    .sort()
    .map(key => `${key}:${params[key]}`)
    .join('|');
  return `report:${tenantId}:${reportType}${paramString ? `:${paramString}` : ''}`;
};

/**
 * Cache key for notification summary (per user per tenant)
 * @param {object} req - Express request (must have tenantId, user.id set by auth/tenant middleware)
 * @returns {string} Cache key
 */
const generateNotificationSummaryKey = (req) => {
  const tenantId = req.tenantId || '';
  const userId = req.user?.id || '';
  return `notifications:summary:${tenantId}:${userId}`;
};

/**
 * Cache key for product list (per tenant + query)
 * @param {object} req - Express request
 * @returns {string} Cache key
 */
const generateProductListKey = (req) => {
  const tenantId = req.tenantId || '';
  const params = Object.keys(req.query || {})
    .sort()
    .map(k => `${k}=${req.query[k]}`)
    .join('&');
  return `products:list:${tenantId}:${params}`;
};

/** Generic list cache key (prefix e.g. customers, sales, invoices) */
const generateListKey = (prefix) => (req) => {
  const tenantId = req.tenantId || '';
  const params = Object.keys(req.query || {})
    .sort()
    .map(k => `${k}=${req.query[k]}`)
    .join('&');
  return `${prefix}:list:${tenantId}:${params}`;
};

const generateCustomerListKey = generateListKey('customers');
const generateSaleListKey = generateListKey('sales');
const generateInvoiceListKey = generateListKey('invoices');

/**
 * Middleware to cache GET requests
 * @param {number} ttl - Time to live in seconds (default: 120)
 * @param {function} keyGenerator - Optional function to generate custom cache key
 */
const cacheMiddleware = (ttl = 120, keyGenerator = null) => {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Generate cache key
    const cacheKey = keyGenerator
      ? keyGenerator(req)
      : generateCacheKey(req.tenantId, req.path, req.query);

    // Try to get from cache
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      logCacheDebug('Cache HIT', { key: cacheKey, path: req.path });
      return res.status(200).json(cachedData);
    }

    logCacheDebug('Cache MISS', { key: cacheKey, path: req.path });

    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to cache response
    res.json = function (data) {
      // Only cache successful responses
      if (res.statusCode === 200 && data.success !== false) {
        cache.set(cacheKey, data, ttl);
        logCacheDebug('Cache SET', { key: cacheKey, path: req.path, ttl });
      }
      return originalJson(data);
    };

    next();
  };
};

/**
 * Invalidate cache for a specific tenant
 * @param {string} tenantId - Tenant ID
 * @param {string} pattern - Pattern to match (e.g., 'dashboard:*' or 'report:*')
 */
const invalidateCache = (tenantId, pattern = '*') => {
  const keys = cache.keys();
  const regex = new RegExp(
    pattern.replace('*', '.*').replace(':', '\\:')
  );
  
  const tenantPattern = `:${tenantId}:`;
  let invalidatedCount = 0;

  keys.forEach(key => {
    if (key.includes(tenantPattern) && regex.test(key)) {
      cache.del(key);
      invalidatedCount++;
    }
  });

  logCacheDebug('Cache INVALIDATED', { tenantId, pattern, count: invalidatedCount });
  return invalidatedCount;
};

/**
 * Invalidate all dashboard cache for a tenant
 * @param {string} tenantId - Tenant ID
 */
const invalidateDashboardCache = (tenantId) => {
  return invalidateCache(tenantId, 'dashboard:*');
};

/**
 * Invalidate all report cache for a tenant
 * @param {string} tenantId - Tenant ID
 */
const invalidateReportCache = (tenantId) => {
  return invalidateCache(tenantId, 'report:*');
};

/**
 * Invalidate product list cache for a tenant (call after product create/update/delete)
 * @param {string} tenantId - Tenant ID
 */
const invalidateProductListCache = (tenantId) => {
  return invalidateCache(tenantId, 'products:list:.*');
};

const invalidateCustomerListCache = (tenantId) => {
  return invalidateCache(tenantId, 'customers:list:.*');
};

const invalidateSaleListCache = (tenantId) => {
  return invalidateCache(tenantId, 'sales:list:.*');
};

const invalidateInvoiceListCache = (tenantId) => {
  return invalidateCache(tenantId, 'invoices:list:.*');
};

/**
 * Invalidate all cache for a tenant
 * @param {string} tenantId - Tenant ID
 */
const invalidateAllCache = (tenantId) => {
  return invalidateCache(tenantId, '*');
};

/** TTL in seconds for auth user cache (short-lived to reduce DB hits per request) */
const AUTH_USER_TTL = 90;

/**
 * Cache key for auth user by ID (used by auth middleware)
 * @param {string} userId - User ID
 * @returns {string}
 */
const getAuthUserCacheKey = (userId) => `auth:user:${userId}`;

/**
 * Invalidate cached user (call after password change, role change, or deactivation)
 * @param {string} userId - User ID
 */
const invalidateUserCache = (userId) => {
  if (!userId) return;
  cache.del(getAuthUserCacheKey(userId));
  logCacheDebug('Cache INVALIDATED (user)', { userId });
};

/**
 * Get cache statistics
 * @returns {object} Cache statistics
 */
const getCacheStats = () => {
  return cache.getStats();
};

/**
 * Clear all cache
 */
const clearAllCache = () => {
  cache.flushAll();
  logCacheDebug('Cache CLEARED', {});
};

/**
 * Debug logging for cache operations
 */
const logCacheDebug = (operation, data) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Cache] ${operation}`, data);
  }
};

/**
 * Helper function to invalidate cache after mutations
 * Call this after create/update/delete operations that affect dashboard/reports
 * @param {string} tenantId - Tenant ID
 */
const invalidateAfterMutation = (tenantId) => {
  if (!tenantId) return;
  invalidateDashboardCache(tenantId);
  invalidateReportCache(tenantId);
};

module.exports = {
  cache,
  AUTH_USER_TTL,
  getAuthUserCacheKey,
  invalidateUserCache,
  cacheMiddleware,
  generateCacheKey,
  generateReportCacheKey,
  generateNotificationSummaryKey,
  generateProductListKey,
  generateCustomerListKey,
  generateSaleListKey,
  generateInvoiceListKey,
  invalidateCache,
  invalidateDashboardCache,
  invalidateReportCache,
  invalidateProductListCache,
  invalidateCustomerListCache,
  invalidateSaleListCache,
  invalidateInvoiceListCache,
  invalidateAllCache,
  invalidateAfterMutation,
  getCacheStats,
  clearAllCache
};
