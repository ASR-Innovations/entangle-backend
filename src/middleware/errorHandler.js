/**
 * Error Handling Middleware
 * 
 * Centralized error handling for Express routes. Catches all errors,
 * logs them appropriately, and returns consistent error responses.
 * 
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
 */

const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

/**
 * Global error handler middleware
 * Must be registered after all routes
 * 
 * @param {Error} err - Error object
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next function
 */
function errorHandler(err, req, res, next) {
  // Default to 500 Internal Server Error
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let details = err.details || null;

  // Log error with appropriate level
  const errorLog = {
    message: err.message,
    statusCode,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: req.user?.paraUserId || 'anonymous',
    ...(err.details && { details: err.details })
  };

  // Operational errors (expected) - log as warning
  // Programming errors (unexpected) - log as error
  if (err instanceof AppError && err.isOperational) {
    logger.warn('Operational error:', errorLog);
  } else {
    logger.error('Unexpected error:', {
      ...errorLog,
      stack: err.stack
    });
  }

  // Don't expose internal error details in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'Internal server error';
    details = null;
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: message,
    ...(details && { details }),
    ...(process.env.NODE_ENV === 'development' && statusCode === 500 && { stack: err.stack })
  });
}

/**
 * 404 Not Found handler
 * Catches requests to undefined routes
 */
function notFoundHandler(req, res, next) {
  logger.warn('Route not found:', {
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  res.status(404).json({
    success: false,
    error: 'Route not found',
    details: `Cannot ${req.method} ${req.path}`
  });
}

/**
 * Async route wrapper
 * Wraps async route handlers to catch promise rejections
 * 
 * @param {Function} fn - Async route handler
 * @returns {Function} Wrapped handler
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Validation error formatter
 * Formats Joi validation errors into consistent structure
 * 
 * @param {Object} joiError - Joi validation error
 * @returns {Object} Formatted error response
 */
function formatValidationError(joiError) {
  const details = joiError.details.map(detail => ({
    field: detail.path.join('.'),
    message: detail.message,
    type: detail.type
  }));

  return {
    success: false,
    error: 'Validation error',
    details: details.length === 1 ? details[0].message : details
  };
}

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  formatValidationError
};
