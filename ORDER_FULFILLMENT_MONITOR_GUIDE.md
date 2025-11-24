# Order Fulfillment Monitor Service Guide

## Overview

The `OrderFulfillmentMonitorService` is a blockchain event monitoring service that listens for `OrderFulfilled` events from the Seaport smart contract and automatically updates the orderbook database when orders are fulfilled on-chain.

## Features

- **Real-time Event Monitoring**: Listens to blockchain events via WebSocket
- **Automatic Database Updates**: Updates order status when fulfillment is detected
- **WebSocket Broadcasting**: Broadcasts fulfillment events to connected clients
- **Automatic Reconnection**: Handles WebSocket disconnections with exponential backoff
- **Manual Transaction Processing**: Supports manual processing of specific transactions

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Avalanche Blockchain                      │
│                  (Seaport Smart Contract)                    │
└────────────────────┬────────────────────────────────────────┘
                     │ OrderFulfilled Event
                     │ (WebSocket)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│          OrderFulfillmentMonitorService                      │
│  • Listens for OrderFulfilled events                        │
│  • Validates order exists in database                       │
│  • Updates order status to fulfilled                        │
│  • Creates fulfillment record                               │
│  • Logs fulfillment event                                   │
└────────────┬────────────────────────────────────────────────┘
             │
             ├──────────────┬──────────────┬──────────────┐
             ▼              ▼              ▼              ▼
      ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
      │PostgreSQL│   │  Order   │   │  Event   │   │ Socket.IO│
      │ Database │   │ Service  │   │   Log    │   │Broadcast │
      └──────────┘   └──────────┘   └──────────┘   └──────────┘
```

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# Seaport Configuration
SEAPORT_CONTRACT_ADDRESS=0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC
SEAPORT_CHAIN_ID=43113

# WebSocket Configuration
WS_RPC_URL=wss://api.avax-test.network/ext/bc/C/ws
ENABLE_ORDER_MONITORING=true

# HTTP RPC (for queries)
RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
```

### Server Integration

The service is automatically initialized and started in `src/server.js`:

```javascript
// Start order fulfillment monitor service
const { getOrderFulfillmentMonitorService } = require('./services/OrderFulfillmentMonitorService');
const orderMonitor = getOrderFulfillmentMonitorService();
await orderMonitor.initialize();
await orderMonitor.start();
```

## Usage

### Basic Usage

```javascript
const { getOrderFulfillmentMonitorService } = require('./services/OrderFulfillmentMonitorService');

// Get service instance
const monitorService = getOrderFulfillmentMonitorService();

// Initialize
await monitorService.initialize();

// Start monitoring
await monitorService.start();

// Check status
const status = monitorService.getStatus();
console.log('Monitoring status:', status);

// Stop monitoring
monitorService.stop();
```

### Manual Transaction Processing

You can manually process a specific transaction:

```javascript
const txHash = '0x1234...';
await monitorService.processTransaction(txHash);
```

This is useful for:
- Backfilling missed events
- Testing with specific transactions
- Recovering from service downtime

## Event Flow

### When an Order is Fulfilled On-Chain

1. **Event Detection**: Service detects `OrderFulfilled` event from Seaport contract
2. **Order Lookup**: Retrieves order from database using order hash
3. **Validation**: Checks if order exists and is not already fulfilled
4. **Database Update**: 
   - Updates order status to `is_fulfilled = true`
   - Sets `fulfilled_by`, `fulfillment_tx_hash`, `fulfilled_at`
   - Marks order as inactive (`is_active = false`)
5. **Fulfillment Record**: Creates entry in `order_fulfillments` table
6. **Event Logging**: Logs fulfillment event in `order_events` table
7. **WebSocket Broadcast**: Broadcasts fulfillment to connected clients

### Database Changes

**seaport_orders table:**
```sql
UPDATE seaport_orders SET
  is_active = false,
  is_fulfilled = true,
  fulfilled_at = CURRENT_TIMESTAMP,
  fulfilled_by = '0x...',
  fulfillment_tx_hash = '0x...'
WHERE order_hash = '0x...';
```

**order_fulfillments table:**
```sql
INSERT INTO order_fulfillments (
  order_hash, fulfiller, transaction_hash, block_number,
  amount_paid, platform_fee_paid
) VALUES (...);
```

**order_events table:**
```sql
INSERT INTO order_events (
  order_hash, event_type, actor, event_data
) VALUES (
  '0x...', 'order:fulfilled', '0x...', {...}
);
```

## WebSocket Broadcasting

When an order is fulfilled, the service broadcasts to:

1. **NFT-specific room**: `nft:{contract}:{tokenId}`
2. **Marketplace room**: All connected clients

Event format:
```javascript
{
  orderHash: '0x...',
  orderType: 'listing',
  tokenId: '123',
  nftContract: '0x...',
  maker: '0x...',
  fulfiller: '0x...',
  transactionHash: '0x...',
  fulfilledAt: '2025-11-20T18:30:00.000Z'
}
```

## Error Handling

### WebSocket Disconnection

The service automatically handles WebSocket disconnections:

1. Detects connection loss
2. Stops monitoring
3. Schedules reconnection with exponential backoff
4. Attempts up to 10 reconnections
5. Logs all reconnection attempts

### Event Processing Errors

If an error occurs while processing an event:

1. Error is logged with full context
2. Processing continues for other events
3. Order remains in previous state
4. Can be manually reprocessed later

## Monitoring and Debugging

### Check Service Status

```javascript
const status = monitorService.getStatus();
console.log(status);
// {
//   isMonitoring: true,
//   seaportContract: '0x...',
//   chainId: 43113,
//   wsRpcUrl: 'wss://...',
//   reconnectAttempts: 0,
//   hasWebSocketProvider: true,
//   hasContract: true
// }
```

### Logs

The service logs all important events:

- ✅ Service initialization
- 🚀 Monitoring started
- 🎉 OrderFulfilled event detected
- 📝 Database updates
- 📡 WebSocket broadcasts
- ⚠️ Warnings and errors
- 🛑 Service stopped

### Testing

Run the test scripts:

```bash
# Basic functionality test
node test-order-fulfillment-monitor.js

# Integration test with database
node test-order-fulfillment-integration.js
```

## Requirements Validation

This service fulfills the following requirements:

- **6.1**: ✅ Detects OrderFulfilled events from Seaport contract
- **6.2**: ✅ Updates order status to fulfilled in database
- **6.3**: ✅ Stores fulfiller address, transaction hash, and block number
- **6.4**: ✅ Creates fulfillment record in order_fulfillments table
- **6.5**: ✅ Logs fulfillment event in order_events table
- **6.5**: ✅ Broadcasts fulfillment events via Socket.IO

## Performance Considerations

- **WebSocket Connection**: Single persistent connection for all events
- **Event Processing**: Asynchronous, non-blocking
- **Database Queries**: Optimized with indexes on order_hash
- **Reconnection**: Exponential backoff prevents connection spam
- **Memory Usage**: Minimal, only stores active listeners

## Troubleshooting

### Service Not Starting

1. Check WebSocket URL is correct
2. Verify Seaport contract address
3. Check database connection
4. Review logs for initialization errors

### Events Not Being Detected

1. Verify WebSocket connection is active
2. Check Seaport contract address matches deployed contract
3. Ensure events are being emitted on-chain
4. Check network connectivity

### Database Updates Failing

1. Verify order exists in database
2. Check database connection
3. Review foreign key constraints
4. Check order is not already fulfilled

## Future Enhancements

- Historical event backfilling
- Event replay functionality
- Multiple contract monitoring
- Advanced error recovery
- Metrics and analytics
- Alert notifications

## Related Services

- **OrderService**: Manages order CRUD operations
- **OrderValidationService**: Validates order signatures and data
- **OrderSocketService**: Handles WebSocket broadcasting
- **OrderCleanupCronService**: Cleans up expired orders

## Support

For issues or questions:
1. Check logs for error messages
2. Review this guide
3. Test with manual transaction processing
4. Contact development team
