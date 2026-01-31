/**
 * Input Sanitization Middleware
 * 
 * Sanitizes all string inputs to prevent XSS attacks.
 * Uses the 'xss' library for HTML sanitization and 'validator' for validation.
 */

const xss = require('xss');
const validator = require('validator');

/**
 * XSS options - configure what's allowed
 */
const xssOptions = {
  whiteList: {}, // Don't allow any HTML tags by default
  stripIgnoreTag: true, // Strip all HTML tags
  stripIgnoreTagBody: ['script', 'style'], // Completely remove script and style tags
};

/**
 * Fields that should NOT be sanitized (e.g., passwords, tokens)
 */
const SKIP_FIELDS = [
  'password',
  'currentPassword',
  'newPassword',
  'confirmPassword',
  'token',
  'refreshToken',
  'apiKey',
  'secretKey',
];

/**
 * Fields that may contain HTML (sanitize but allow some formatting)
 */
const HTML_FIELDS = [
  'description',
  'notes',
  'content',
  'body',
  'message',
  'terms',
  'specifications',
];

/**
 * XSS options for HTML fields - allow basic formatting
 */
const htmlXssOptions = {
  whiteList: {
    b: [],
    i: [],
    u: [],
    strong: [],
    em: [],
    p: [],
    br: [],
    ul: [],
    ol: [],
    li: [],
    a: ['href', 'title', 'target'],
  },
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style', 'iframe', 'object', 'embed'],
};

/**
 * Sanitize a single value
 * @param {any} value - Value to sanitize
 * @param {string} key - Field name (for special handling)
 * @returns {any} - Sanitized value
 */
const sanitizeValue = (value, key = '') => {
  // Skip non-strings
  if (typeof value !== 'string') {
    return value;
  }
  
  // Skip password and token fields
  if (SKIP_FIELDS.includes(key)) {
    return value;
  }
  
  // Trim whitespace
  let sanitized = value.trim();
  
  // Use appropriate XSS options based on field type
  if (HTML_FIELDS.includes(key)) {
    sanitized = xss(sanitized, htmlXssOptions);
  } else {
    sanitized = xss(sanitized, xssOptions);
  }
  
  // Escape potential injection characters (but not for HTML fields)
  if (!HTML_FIELDS.includes(key)) {
    sanitized = validator.escape(sanitized);
    // Unescape common characters that validator.escape() encodes
    sanitized = sanitized
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'");
    // Re-apply xss filter after unescaping
    sanitized = xss(sanitized, xssOptions);
  }
  
  return sanitized;
};

/**
 * Recursively sanitize an object
 * @param {Object} obj - Object to sanitize
 * @param {string} parentKey - Parent key for nested objects
 * @returns {Object} - Sanitized object
 */
const sanitizeObject = (obj, parentKey = '') => {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map((item, index) => {
      if (typeof item === 'object' && item !== null) {
        return sanitizeObject(item, `${parentKey}[${index}]`);
      }
      return sanitizeValue(item, parentKey);
    });
  }
  
  if (typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeObject(value, key);
      } else {
        sanitized[key] = sanitizeValue(value, key);
      }
    }
    return sanitized;
  }
  
  return sanitizeValue(obj, parentKey);
};

/**
 * Sanitization Middleware
 * Sanitizes req.body, req.query, and req.params
 */
const sanitizeInputs = (req, res, next) => {
  try {
    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }
    
    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query);
    }
    
    // Sanitize URL parameters (be careful with IDs)
    if (req.params && typeof req.params === 'object') {
      // Only sanitize non-ID params
      for (const [key, value] of Object.entries(req.params)) {
        if (!key.toLowerCase().includes('id') && typeof value === 'string') {
          req.params[key] = sanitizeValue(value, key);
        }
      }
    }
    
    next();
  } catch (error) {
    console.error('[Sanitizer] Error sanitizing inputs:', error);
    next(); // Continue even if sanitization fails
  }
};

/**
 * Validate and sanitize email
 * @param {string} email - Email to validate
 * @returns {string|null} - Sanitized email or null if invalid
 */
const sanitizeEmail = (email) => {
  if (!email || typeof email !== 'string') return null;
  
  const trimmed = email.trim().toLowerCase();
  
  if (!validator.isEmail(trimmed)) {
    return null;
  }
  
  return validator.normalizeEmail(trimmed);
};

/**
 * Validate and sanitize phone number
 * @param {string} phone - Phone to validate
 * @returns {string|null} - Sanitized phone or null if invalid
 */
const sanitizePhone = (phone) => {
  if (!phone || typeof phone !== 'string') return null;
  
  // Remove all non-numeric characters except + at the start
  const cleaned = phone.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
  
  // Basic length check
  if (cleaned.length < 7 || cleaned.length > 15) {
    return null;
  }
  
  return cleaned;
};

/**
 * Validate and sanitize URL
 * @param {string} url - URL to validate
 * @returns {string|null} - Sanitized URL or null if invalid
 */
const sanitizeUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  
  const trimmed = url.trim();
  
  if (!validator.isURL(trimmed, {
    protocols: ['http', 'https'],
    require_protocol: true,
  })) {
    // Try adding https://
    const withProtocol = `https://${trimmed}`;
    if (validator.isURL(withProtocol)) {
      return withProtocol;
    }
    return null;
  }
  
  return trimmed;
};

/**
 * Sanitize filename
 * @param {string} filename - Filename to sanitize
 * @returns {string} - Sanitized filename
 */
const sanitizeFilename = (filename) => {
  if (!filename || typeof filename !== 'string') return 'file';
  
  // Remove path traversal attempts
  let sanitized = filename.replace(/\.\./g, '');
  
  // Remove special characters
  sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '_');
  
  // Limit length
  if (sanitized.length > 255) {
    const ext = sanitized.split('.').pop();
    sanitized = sanitized.substring(0, 250 - ext.length) + '.' + ext;
  }
  
  return sanitized || 'file';
};

module.exports = {
  sanitizeInputs,
  sanitizeValue,
  sanitizeObject,
  sanitizeEmail,
  sanitizePhone,
  sanitizeUrl,
  sanitizeFilename,
};
