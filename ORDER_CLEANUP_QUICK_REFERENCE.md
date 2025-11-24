# Order Cleanup Cron Service - Quick Reference

## What It Does
Automatically cleans up expired orders every 5 minutes by marking them as inactive.

## Files
- **Service**: `src/services/OrderCleanupCronService.js`
- **Integration**: `src/server.js` (auto-starts)
- **Tests**: `test-order-cleanup-service.js`, `test-order-cleanup-with-data.js`

## Configuration
```bash
# .env file (optional)
ORDER_CLEANUP_CRON_SCHEDULE=*/5 * * * *  # Every 5 minutes (default)
```

## Testing

### Run Basic Test
```bash
node test-order-cleanup-service.js
```

### Run Comprehensive Test (with test data)
```bash
node test-order-cleanup-with-data.js
```

## Manual Usage

### Trigger Cleanup Manually
```javascript
const { getOrderCleanupCronService } = require('./src/services/OrderCleanupCronService');
const service = getOrderCleanupCronService();

// Run cleanup now
const result = await service.triggerManually();
console.log(`Cleaned up: ${result.cleanedUp} orders`);
console.log(`Active listings: ${result.activeListings}`);
console.log(`Active offers: ${result.activeOffers}`);
```

### Get Statistics
```javascript
const stats = await service.getCleanupStats();
// Returns: { active_orders, expired_orders, fulfilled_orders, cancelled_orders, total_orders }
```

### Stop Service
```javascript
service.stop();
```

### Start Service
```javascript
service.start();
```

## How It Works

1. **Every 5 minutes**, the service runs automatically
2. **Queries database** for orders where `expires_at <= CURRENT_TIMESTAMP`
3. **Updates orders** to set `is_active = false`
4. **Logs events** to `order_events` table
5. **Reports statistics** about active orders

## What Gets Cleaned Up

✅ Orders that have expired (`expires_at <= now`)  
✅ Orders that are still marked as active  
❌ Already fulfilled orders (skipped)  
❌ Already cancelled orders (skipped)  
❌ Already inactive orders (skipped)  

## Logging

### Startup
```
🧹 STARTING ORDER CLEANUP CRON SERVICE
⏰ Schedule: */5 * * * * (every 5 minutes)
🟢 Order cleanup cron job started successfully!
```

### During Cleanup
```
🚀 ORDER CLEANUP JOB TRIGGERED
🔍 CHECKING FOR EXPIRED ORDERS...
🧹 CLEANED UP 2 EXPIRED ORDER(S)
📊 ACTIVE ORDERS SUMMARY: 5 active listings, 3 active offers
✅ ORDER CLEANUP JOB COMPLETED in 45ms
```

## Database Impact

### Orders Updated
```sql
UPDATE seaport_orders
SET is_active = false, updated_at = CURRENT_TIMESTAMP
WHERE is_active = true
  AND expires_at <= CURRENT_TIMESTAMP
  AND is_fulfilled = false
  AND is_cancelled = false
```

### Events Logged
```sql
INSERT INTO order_events (order_hash, event_type, actor, event_data)
VALUES ($1, 'order:expired', 'system', $2)
```

## Requirements Satisfied
- ✅ 7.1: Identify expired orders
- ✅ 7.2: Mark as inactive
- ✅ 7.3: Log cleanup operations
- ✅ 7.4: Run every 5 minutes
- ✅ 7.5: Exclude from active queries

## Troubleshooting

### Service Not Running
Check server logs for startup errors:
```bash
grep "ORDER CLEANUP" logs/combined.log
```

### No Orders Being Cleaned
- Verify orders exist with `expires_at <= CURRENT_TIMESTAMP`
- Check if orders are already inactive
- Run manual trigger to test: `service.triggerManually()`

### Performance Issues
- Check database indexes on `is_active` and `expires_at`
- Monitor cleanup duration in logs
- Consider adjusting cron schedule if needed

## Related Services
- **OrderService**: Creates and manages orders
- **OrderValidationService**: Validates order data
- **OrderFulfillmentMonitorService**: Tracks on-chain fulfillments
- **AuctionCronService**: Similar pattern for auction cleanup
