# Quick E2E Test Guide

## 🚀 Quick Start

### 1. Prerequisites Check
```bash
# Check database connection
psql $DATABASE_URL -c "SELECT 1"

# Check environment variables
echo $JWT_SECRET
echo $SEAPORT_CONTRACT_ADDRESS
```

### 2. Run Tests
```bash
# Easiest way - automated script
./run-e2e-tests.sh

# Or manually
node test-seaport-e2e.js
```

### 3. Expected Result
```
📊 TEST SUMMARY
✅ PASS - Order Creation Flow
✅ PASS - Order Cancellation Flow
✅ PASS - Order Fulfillment Flow
✅ PASS - Real-time Synchronization
✅ PASS - Cron Job Execution

TOTAL: 5/5 tests passed
🎉 ALL TESTS PASSED!
```

## 📋 What Gets Tested

1. **Order Creation** - Create, sign, validate, and store orders
2. **Order Cancellation** - Cancel orders with proper authorization
3. **Order Fulfillment** - Record on-chain fulfillments
4. **Real-time Sync** - WebSocket events across multiple clients
5. **Cron Jobs** - Automatic cleanup of expired orders

## 🔧 Troubleshooting

### Server Not Running
```bash
# Start server first
node src/server.js &

# Then run tests
node test-seaport-e2e.js
```

### Database Issues
```bash
# Run migrations
node database/migrations/migrate.js

# Verify schema
psql $DATABASE_URL -c "\dt"
```

### Authentication Errors
```bash
# Check JWT_SECRET is set
echo $JWT_SECRET

# If not set, add to .env
echo "JWT_SECRET=your-secret-here" >> .env
```

## 📁 Test Files

- `test-seaport-e2e.js` - Main test suite
- `run-e2e-tests.sh` - Automated runner
- `test-e2e-validation.js` - Quick validation
- `E2E_TEST_README.md` - Full documentation
- `E2E_TEST_IMPLEMENTATION.md` - Implementation details

## 🎯 Quick Commands

```bash
# Validate test file structure
node test-e2e-validation.js

# Run full E2E tests
./run-e2e-tests.sh

# Check server health
curl http://localhost:5000/health

# View test logs
tail -f server-test.log
```

## ✅ Success Criteria

All 5 tests should pass:
- ✅ Order Creation Flow
- ✅ Order Cancellation Flow
- ✅ Order Fulfillment Flow
- ✅ Real-time Synchronization
- ✅ Cron Job Execution

## 📚 More Information

- Full documentation: `E2E_TEST_README.md`
- Implementation details: `E2E_TEST_IMPLEMENTATION.md`
- Design document: `.kiro/specs/seaport-orderbook/design.md`
- Requirements: `.kiro/specs/seaport-orderbook/requirements.md`
