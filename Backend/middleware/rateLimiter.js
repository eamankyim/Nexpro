/**
 * Rate Limiting Middleware
 * 
 * Protects API endpoints from brute force attacks and DDoS.
 * Different limits for different endpoint categories.
 */

const rateLimit = require('express-rate-limit');

/**
 * Create a custom key generator that includes tenant ID when available
 */
const keyGenerator = (req) => {
  const tenantId = req.headers['x-tenant-id'] || 'anonymous';
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  return `${tenantId}:${ip}`;
};

/**
 * Standard error response handler
 */
const createErrorHandler = (message) => (req, res) => {
  res.status(429).json({
    success: false,
    error: 'Too Many Requests',
    message,
    retryAfter: res.getHeader('Retry-After'),
  });
};

/**
 * General API rate limiter
 * 100 requests per minute per IP/tenant
 */
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
  keyGenerator,
  handler: createErrorHandler('Too many requests. Please try again later.'),
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  },
  validate: false, // Disable validation warnings
});

/**
 * Strict rate limiter for authentication endpoints
 * 5 requests per minute per IP (prevents brute force)
 */
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 attempts per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.connection?.remoteAddress || 'unknown',
  handler: createErrorHandler('Too many login attempts. Please try again in a minute.'),
  skipSuccessfulRequests: false,
  validate: false,
});

/**
 * Password reset rate limiter
 * 3 requests per 15 minutes per IP
 */
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // 3 attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.connection?.remoteAddress || 'unknown',
  handler: createErrorHandler('Too many password reset requests. Please try again later.'),
  validate: false,
});

/**
 * Registration rate limiter
 * 5 registrations per hour per IP
 */
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 registrations per hour
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.connection?.remoteAddress || 'unknown',
  handler: createErrorHandler('Too many registration attempts. Please try again later.'),
  validate: false,
});

/**
 * File upload rate limiter
 * 20 uploads per minute per tenant
 */
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 uploads per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: createErrorHandler('Too many file uploads. Please try again later.'),
  validate: false,
});

/**
 * Export/Report generation rate limiter
 * 10 exports per minute (expensive operations)
 */
const exportLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 exports per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: createErrorHandler('Too many export requests. Please try again later.'),
  validate: false,
});

/**
 * Webhook rate limiter (for incoming webhooks)
 * 100 requests per minute per IP
 */
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 webhooks per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.connection?.remoteAddress || 'unknown',
  handler: createErrorHandler('Too many webhook requests.'),
  validate: false,
});

/**
 * Bulk operations rate limiter
 * 5 bulk operations per minute
 */
const bulkOperationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 bulk operations per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: createErrorHandler('Too many bulk operations. Please try again later.'),
  validate: false,
});

module.exports = {
  generalLimiter,
  authLimiter,
  passwordResetLimiter,
  registrationLimiter,
  uploadLimiter,
  exportLimiter,
  webhookLimiter,
  bulkOperationLimiter,
};
