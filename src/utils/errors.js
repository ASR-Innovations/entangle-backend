/**
 * Custom Error Classes for Seaport Orderbook
 * 
 * Provides structured error handling with specific error types for different
 * failure scenarios. Each error class includes appropriate HTTP status codes
 * and descriptive messages.
 * 
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
 */

/**
 * Base class for all application errors
 */
class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true; // Distinguishes operational errors from programming errors
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      success: false,
      error: this.message,
      details: this.details,
      ...(process.env.NODE_ENV === 'development' && { stack: this.stack })
    };
  }
}

/**
 * Validation Error (400 Bad Request)
 * Used when request data fails validation
 * Requirement: 12.1
 */
class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, details);
  }
}

/**
 * Authentication Error (401 Unauthorized)
 * Used when JWT token is missing, invalid, or expired
 * Requirement: 12.1
 */
class AuthenticationError extends AppError {
  constructor(message = 'Authentication required', details = null) {
    super(message, 401, details);
  }
}

/**
 * Authorization Error (403 Forbidden)
 * Used when user doesn't have permission for the requested action
 * Requirement: 12.1
 */
class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions', details = null) {
    super(message, 403, details);
  }
}

/**
 * Not Found Error (404 Not Found)
 * Used when requested resource doesn't exist
 * Requirement: 12.1
 */
class NotFoundError extends AppError {
  constructor(resource = 'Resource', details = null) {
    super(`${resource} not found`, 404, details);
  }
}

/**
 * Conflict Error (409 Conflict)
 * Used when request conflicts with current state
 * Requirement: 12.1, 12.4
 */
class ConflictError extends AppError {
  constructor(message, details = null) {
    super(message, 409, details);
  }
}

/**
 * Signature Verification Error (400 Bad Request)
 * Used when order signature verification fails
 * Requirement: 12.2
 */
class SignatureError extends ValidationError {
  constructor(message = 'Invalid order signature', details = null) {
    super(message, details);
  }
}

/**
 * Order Expiration Error (400 Bad Request)
 * Used when order has expired
 * Requirement: 12.3
 */
class ExpirationError extends ValidationError {
  constructor(message = 'Order has expired', details = null) {
    super(message, details);
  }
}

/**
 * Duplicate Order Error (409 Conflict)
 * Used when order hash already exists
 * Requirement: 12.4
 */
class DuplicateOrderError extends ConflictError {
  constructor(orderHash = null) {
    const message = orderHash 
      ? `Order already exists: ${orderHash}`
      : 'Order already exists';
    super(message, { orderHash });
  }
}

/**
 * Database Error (500 Internal Server Error)
 * Used when database operations fail
 * Requirement: 12.5
 */
class DatabaseError extends AppError {
  constructor(message = 'Database operation failed', details = null) {
    super(message, 500, details);
    this.isOperational = false; // Database errors are not operational
  }
}

/**
 * Blockchain Error (500 Internal Server Error)
 * Used when blockchain RPC calls fail
 * Requirement: 12.5
 */
class BlockchainError extends AppError {
  constructor(message = 'Blockchain operation failed', details = null) {
    super(message, 500, details);
  }
}

/**
 * Order State Error (409 Conflict)
 * Used when order is in invalid state for requested operation
 */
class OrderStateError extends ConflictError {
  constructor(message, details = null) {
    super(message, details);
  }
}

/**
 * Platform Fee Error (400 Bad Request)
 * Used when platform fee validation fails
 */
class PlatformFeeError extends ValidationError {
  constructor(message = 'Invalid platform fee', details = null) {
    super(message, details);
  }
}

/**
 * NFT Ownership Error (400 Bad Request)
 * Used when NFT ownership validation fails
 */
class OwnershipError extends ValidationError {
  constructor(message = 'NFT ownership validation failed', details = null) {
    super(message, details);
  }
}

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  SignatureError,
  ExpirationError,
  DuplicateOrderError,
  DatabaseError,
  BlockchainError,
  OrderStateError,
  PlatformFeeError,
  OwnershipError
};
