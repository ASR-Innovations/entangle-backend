# Error Handling and Validation Guide

## Overview

This document describes the comprehensive error handling and validation system implemented for the Seaport Orderbook Backend Integration.

**Requirements Addressed:** 12.1, 12.2, 12.3, 12.4, 12.5

## Architecture

### Custom Error Classes

All custom error classes are defined in `src/utils/errors.js` and extend the base `AppError` class.

#### Base Error Class

```javascript
class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}
```

#### Error Types

| Error Class | Status Code | Use Case |
|------------|-------------|----------|
| `ValidationError` | 400 | Request data fails validation |
| `SignatureError` | 400 | Order signature verification fails |
| `ExpirationError` | 400 | Order has expired |
| `OwnershipError` | 400 | NFT ownership validation fails |
| `PlatformFeeError` | 400 | Platform fee validation fails |
| `AuthenticationError` | 401 | JWT token missing, invalid, or expired |
| `AuthorizationError` | 403 | User lacks permission for action |
| `NotFoundError` | 404 | Requested resource doesn't exist |
| `ConflictError` | 409 | Request conflicts with current state |
| `DuplicateOrderError` | 409 | Order hash already exists |
| `OrderStateError` | 409 | Order in invalid state for operation |
| `DatabaseError` | 500 | Database operations fail |
| `BlockchainError` | 500 | Blockchain RPC calls fail |

### Error Handling Middleware

The error handling middleware is defined in `src/middleware/errorHandler.js`.

#### Components

1. **Global Error Handler** (`errorHandler`)
   - Catches all errors from routes
   - Logs errors with appropriate severity
   - Returns consistent error responses
   - Hides internal details in production

2. **404 Not Found Handler** (`notFoundHandler`)
   - Catches requests to undefined routes
   - Returns 404 with route information

3. **Async Route Wrapper** (`asyncHandler`)
   - Wraps async route handlers
   - Automatically catches promise rejections
   - Passes errors to error handler

4. **Validation Error Formatter** (`formatValidationError`)
   - Formats Joi validation errors
   - Returns consistent structure

## Usage Examples

### In Services

```javascript
const { ValidationError, NotFoundError, DatabaseError } = require('../utils/errors');

// Throw validation error
if (!validation.valid) {
  throw new ValidationError('Order validation failed', validation.errors.join(', '));
}

// Throw not found error
if (!order) {
  throw new NotFoundError('Order');
}

// Wrap database errors
try {
  // database operation
} catch (error) {
  if (error.isOperational) {
    throw error; // Re-throw custom errors
  }
  throw new DatabaseError('Failed to create order', error.message);
}
```

### In Routes

```javascript
const { asyncHandler, formatValidationError } = require('../middleware/errorHandler');
const { ValidationError } = require('../utils/errors');

// Wrap route handlers with asyncHandler
router.post('/endpoint', authenticateToken, asyncHandler(async (req, res) => {
  // Validate with Joi
  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json(formatValidationError(error));
  }

  // Throw custom errors - they'll be caught by asyncHandler
  if (!someCondition) {
    throw new ValidationError('Invalid data', 'Specific reason');
  }

  // Success response
  res.json({ success: true, data: result });
}));
```

## Error Response Format

### Standard Error Response

```json
{
  "success": false,
  "error": "Error message",
  "details": "Additional details (optional)"
}
```

### Development Mode

In development, 500 errors include stack traces:

```json
{
  "success": false,
  "error": "Internal server error",
  "details": "Specific error details",
  "stack": "Error stack trace..."
}
```

### Production Mode

In production, 500 errors hide internal details:

```json
{
  "success": false,
  "error": "Internal server error"
}
```

## Validation

### Joi Schemas

All endpoints use Joi schemas for request validation. Schemas are defined in `src/routes/orders.js`.

#### Example Schemas

```javascript
// Order creation schema
const createOrderSchema = Joi.object({
  orderHash: Joi.string().pattern(/^0x[a-fA-F0-9]{64}$/).required(),
  orderType: Joi.string().valid('listing', 'offer').required(),
  nftContract: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  // ... more fields
});

// Pagination schema
const paginationSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(50),
  offset: Joi.number().integer().min(0).default(0)
});
```

### Validation Flow

1. Request arrives at route
2. Joi schema validates request data
3. If validation fails, return formatted error
4. If validation passes, proceed with business logic
5. Service layer performs additional validation (signatures, ownership, etc.)
6. Any validation failures throw appropriate custom errors

## Logging

### Winston Logger

All errors are logged using Winston (`src/utils/logger.js`).

#### Log Levels

- **Operational Errors** (expected): Logged as `warn`
- **Programming Errors** (unexpected): Logged as `error` with stack trace

#### Log Format

```javascript
{
  message: "Error message",
  statusCode: 400,
  path: "/api/orders/listings/create",
  method: "POST",
  ip: "127.0.0.1",
  userId: "user123",
  details: { /* error details */ },
  timestamp: "2024-01-01 12:00:00"
}
```

#### Log Files

- `logs/error.log` - Errors only
- `logs/combined.log` - All logs
- Console - Development mode only

## Error Handling Best Practices

### 1. Use Specific Error Classes

```javascript
// Good
throw new NotFoundError('Order');

// Bad
throw new Error('Order not found');
```

### 2. Provide Helpful Details

```javascript
// Good
throw new ValidationError('Invalid price', 'Price must be greater than zero');

// Bad
throw new ValidationError('Invalid data');
```

### 3. Re-throw Custom Errors

```javascript
try {
  await someOperation();
} catch (error) {
  if (error.isOperational) {
    throw error; // Re-throw custom errors as-is
  }
  throw new DatabaseError('Operation failed', error.message);
}
```

### 4. Use asyncHandler for Routes

```javascript
// Good
router.get('/endpoint', asyncHandler(async (req, res) => {
  // async code
}));

// Bad
router.get('/endpoint', async (req, res) => {
  try {
    // async code
  } catch (error) {
    // manual error handling
  }
});
```

### 5. Log Before Throwing

```javascript
logger.warn('Order validation failed', { errors: validation.errors });
throw new ValidationError('Order validation failed', validation.errors.join(', '));
```

## Testing Error Handling

### Test Cases

1. **Validation Errors**
   - Missing required fields
   - Invalid data formats
   - Out of range values

2. **Authentication Errors**
   - Missing JWT token
   - Invalid JWT token
   - Expired JWT token

3. **Authorization Errors**
   - Non-maker cancelling order
   - Unauthorized access to protected resources

4. **Not Found Errors**
   - Non-existent order hash
   - Non-existent NFT

5. **Conflict Errors**
   - Duplicate order hash
   - Cancelling fulfilled order
   - Cancelling already cancelled order

6. **Database Errors**
   - Connection failures
   - Query errors

7. **Blockchain Errors**
   - RPC failures
   - Contract call errors

### Example Test

```javascript
describe('Error Handling', () => {
  it('should return 400 for invalid order data', async () => {
    const response = await request(app)
      .post('/api/orders/listings/create')
      .set('Authorization', `Bearer ${token}`)
      .send({ /* invalid data */ });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Validation error');
  });

  it('should return 404 for non-existent order', async () => {
    const response = await request(app)
      .get('/api/orders/0x1234567890abcdef');

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('not found');
  });
});
```

## Monitoring and Debugging

### Error Monitoring

1. Check `logs/error.log` for all errors
2. Check `logs/combined.log` for full context
3. Monitor error rates and patterns
4. Set up alerts for critical errors

### Debugging Tips

1. **Check Error Logs**: Start with the error log to see the full error details
2. **Verify Request Data**: Ensure request data matches expected format
3. **Check Environment**: Verify environment variables are set correctly
4. **Test Locally**: Reproduce errors in development mode for full stack traces
5. **Use Error Details**: Custom errors include helpful details for debugging

## Migration from Old Error Handling

### Before

```javascript
router.post('/endpoint', async (req, res) => {
  try {
    // logic
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.status(500).json({ error: 'Internal error' });
  }
});
```

### After

```javascript
router.post('/endpoint', asyncHandler(async (req, res) => {
  // logic - errors are automatically handled
  if (!resource) {
    throw new NotFoundError('Resource');
  }
  res.json({ success: true, data: resource });
}));
```

## Summary

The error handling system provides:

✅ **Consistent error responses** across all endpoints
✅ **Descriptive error messages** for debugging
✅ **Proper HTTP status codes** for each error type
✅ **Comprehensive logging** with Winston
✅ **Security** by hiding internal details in production
✅ **Developer experience** with helpful error classes and middleware
✅ **Maintainability** with centralized error handling

All requirements (12.1, 12.2, 12.3, 12.4, 12.5) are fully implemented and documented.
