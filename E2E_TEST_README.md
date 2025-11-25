# Seaport Orderbook End-to-End Tests

## Overview

This test suite provides comprehensive end-to-end testing for the Seaport Orderbook backend integration. It validates all major flows and requirements.

## Test Coverage

### Test 1: Complete Order Creation Flow
**Requirements:** 1.1, 2.1-2.7, 3.1, 4.1, 8.1

Tests:
- Creating and signing orders with EIP-712
- Order validation (signature, price, expiration)
- Database persistence
- Event logging

### Test 2: Complete Order Cancellation Flow
**Requirements:** 5.1-5.5, 4.2, 8.2

Tests:
- Order cancellation authorization
- Database status updates
- Cancellation record creation
- Event logging

### Test 3: Complete Order Fulfillment Flow
**Requirements:** 6.1-6.5, 4.3, 8.3

Tests:
- Order fulfillment recording
- Database status updates
- Fulfillment record creation
- Platform fee verification
- Event logging

### Test 4: Real-time Synchronization Across Multiple Clients
**Requirements:** 4.1, 4.2, 4.3, 4.4, 4.5

Tests:
- WebSocket connection and authentication
- Room-based broadcasting per NFT
- Order creation event broadcasting
- Order cancellation event broadcasting
- Multiple client synchronization

### Test 5: Cron Job Execution
**Requirements:** 7.1, 7.2, 7.3, 7.4, 7.5

Tests:
- Expired order detection
- Automatic order cleanup
- Status updates
- Event logging

## Prerequisites

1. **Database Setup**
   - PostgreSQL database running
   - Seaport orderbook schema migrated
   - Database connection configured in `.env`

2. **Environment Variables**
   ```bash
   # Database
   DATABASE_URL=postgresql://user:password@localhost:5432/dbname
   
   # JWT
   JWT_SECRET=your-jwt-secret
   
   # Seaport Configuration
   SEAPORT_CONTRACT_ADDRESS=0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC
   SEAPORT_CHAIN_ID=43113
   
   # RPC URLs
   RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
   WS_RPC_URL=wss://api.avax-test.network/ext/bc/C/ws
   
   # Platform Fee (optional)
   PLATFORM_FEE_RECIPIENT=0x...
   PLATFORM_FEE_BASIS_POINTS=250
   
   # Server
   PORT=5000
   ```

3. **Dependencies**
   ```bash
   npm install
   ```

## Running the Tests

### Option 1: Using the Shell Script (Recommended)

The shell script automatically starts the server if needed and runs the tests:

```bash
./run-e2e-tests.sh
```

### Option 2: Manual Execution

1. Start the server in one terminal:
   ```bash
   node src/server.js
   ```

2. Run the tests in another terminal:
   ```bash
   node test-seaport-e2e.js
   ```

### Option 3: With Existing Server

If your server is already running:

```bash
node test-seaport-e2e.js
```

## Test Output

The tests provide detailed logging for each step:

```
🧪 SEAPORT ORDERBOOK END-TO-END TESTS
================================================================================

TEST 1: Complete Order Creation Flow
================================================================================
📝 Created and signed order: 0x1234567...
📤 Sending order creation request...
✅ Order created successfully
✅ Order verified in database
✅ Order creation event logged

...

📊 TEST SUMMARY
================================================================================
✅ PASS - Order Creation Flow
✅ PASS - Order Cancellation Flow
✅ PASS - Order Fulfillment Flow
✅ PASS - Real-time Synchronization
✅ PASS - Cron Job Execution

TOTAL: 5/5 tests passed
🎉 ALL TESTS PASSED!
```

## Troubleshooting

### Server Connection Issues

If tests fail to connect to the server:

1. Verify server is running: `curl http://localhost:5000/health`
2. Check server logs: `tail -f logs/combined.log`
3. Verify PORT in `.env` matches test configuration

### Database Issues

If tests fail with database errors:

1. Verify database connection: `psql $DATABASE_URL`
2. Check schema is migrated: `node database/migrations/migrate.js`
3. Verify test users can be created

### WebSocket Issues

If real-time synchronization tests fail:

1. Check WebSocket server is initialized
2. Verify JWT_SECRET is set correctly
3. Check firewall/network settings

### Authentication Issues

If tests fail with 401/403 errors:

1. Verify JWT_SECRET is set in `.env`
2. Check token generation in test file
3. Verify auth middleware is working

## Cleanup

The tests automatically clean up test data after execution. If manual cleanup is needed:

```sql
DELETE FROM seaport_orders WHERE nft_contract = '0x1234567890123456789012345678901234567890';
DELETE FROM users WHERE para_user_id LIKE 'test-user-%';
```

## Integration with CI/CD

To integrate with CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run E2E Tests
  run: |
    npm install
    ./run-e2e-tests.sh
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
    JWT_SECRET: ${{ secrets.JWT_SECRET }}
    # ... other env vars
```

## Notes

- Tests use mock wallets and signatures
- Platform fee validation is optional (skipped if not configured)
- Tests create temporary data that is cleaned up automatically
- WebSocket tests require Socket.IO client library
- Cron job test manually triggers the cleanup service

## Support

For issues or questions:
1. Check server logs: `logs/combined.log`
2. Check test output for specific error messages
3. Verify all prerequisites are met
4. Review the design document: `.kiro/specs/seaport-orderbook/design.md`
