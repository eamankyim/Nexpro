/**
 * Enhanced Error Handler Middleware
 * 
 * Standardizes error responses and provides better error handling
 * with error codes, structured logging, and request context.
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Generate request ID for tracing (if not present)
  const requestId = req.id || req.headers['x-request-id'] || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Build error context for logging
  const errorContext = {
    requestId,
    method: req.method,
    url: req.originalUrl || req.url,
    tenantId: req.tenantId || 'unknown',
    userId: req.user?.id || 'unknown',
    timestamp: new Date().toISOString(),
    errorName: err.name,
    errorMessage: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  };

  // Log error with context
  console.error('[ErrorHandler]', JSON.stringify(errorContext, null, 2));
  if (process.env.NODE_ENV === 'development') {
    console.error('[ErrorHandler] Full error:', err);
  }

  // Handle different error types
  let statusCode = error.statusCode || 500;
  let errorCode = 'INTERNAL_ERROR';
  let message = error.message || 'Server Error';
  let details = null;

  // Sequelize CastError (invalid ID format)
  if (err.name === 'CastError' || err.name === 'SequelizeCastError') {
    statusCode = 404;
    errorCode = 'RESOURCE_NOT_FOUND';
    message = 'Resource not found';
  }

  // Sequelize duplicate key constraint
  if (err.name === 'SequelizeUniqueConstraintError') {
    statusCode = 400;
    errorCode = 'DUPLICATE_ENTRY';
    message = 'Duplicate field value entered';
    if (err.errors && err.errors.length > 0) {
      const field = err.errors[0].path;
      message = `${field} already exists`;
      details = { field, value: err.errors[0].value };
    }
  }

  // Sequelize validation error
  if (err.name === 'SequelizeValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    const validationErrors = Object.values(err.errors).map(val => ({
      field: val.path,
      message: val.message,
      value: val.value,
    }));
    message = 'Validation failed';
    details = { errors: validationErrors };
  }

  // Sequelize foreign key constraint
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    statusCode = 400;
    errorCode = 'FOREIGN_KEY_CONSTRAINT';
    message = 'Cannot perform operation due to related records';
  }

  // Sequelize database connection error
  if (err.name === 'SequelizeConnectionError' || err.name === 'SequelizeConnectionRefusedError') {
    statusCode = 503;
    errorCode = 'DATABASE_ERROR';
    message = 'Database connection error. Please try again later.';
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    errorCode = 'AUTHENTICATION_ERROR';
    message = 'Invalid or expired token';
  }

  // Express validator errors
  if (err.name === 'ValidationError' && Array.isArray(err.errors)) {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = { errors: err.errors };
  }

  // Rate limiting errors
  if (err.status === 429) {
    statusCode = 429;
    errorCode = 'RATE_LIMIT_EXCEEDED';
    message = 'Too many requests. Please try again later.';
  }

  // Standardize error response
  const errorResponse = {
    success: false,
    error: message,
    errorCode,
    requestId,
    ...(details && { details }),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  };

  res.status(statusCode).json(errorResponse);
};

module.exports = errorHandler;


