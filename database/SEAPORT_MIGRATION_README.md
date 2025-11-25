# Seaport Orderbook Database Migration

This directory contains the database migration for adding Seaport orderbook functionality to the Entangle platform.

## Overview

The migration adds four new tables to support NFT marketplace orders:
- `seaport_orders` - Main table for storing all orders (listings and offers)
- `order_fulfillments` - Tracks on-chain order fulfillment events
- `order_cancellations` - Tracks order cancellation events
- `order_events` - General event log for all order activities

## Files

- `002_add_seaport_orderbook.sql` - Forward migration (creates tables)
- `002_rollback_seaport_orderbook.sql` - Rollback migration (removes tables)
- `run-seaport-migration.js` - Migration runner script
- `schema.sql` - Updated to include Seaport tables for new installations

## Running the Migration

### Prerequisites

1. Ensure your database connection is configured in `.env`:
   ```bash
   DATABASE_URL=postgresql://user:password@host:port/database
   # OR individual variables:
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=meeting_auction
   DB_USER=postgres
   DB_PASSWORD=password
   ```

2. Ensure the `users` table exists (required for foreign key constraint)

### Apply Migration

To create the Seaport orderbook tables:

```bash
node database/run-seaport-migration.js apply
```

This will:
- Create all four tables with proper constraints
- Create all indexes for query optimization
- Set up triggers for auto-updating timestamps
- Verify the migration was successful

### Rollback Migration

To remove the Seaport orderbook tables:

```bash
node database/run-seaport-migration.js rollback
```

⚠️ **Warning**: This will permanently delete all Seaport order data!

## Table Schemas

### seaport_orders

Main table storing all marketplace orders.

**Key Columns:**
- `order_hash` (PK) - Unique identifier for the order
- `order_type` - Either 'listing' or 'offer'
- `nft_contract` - Address of the NFT contract
- `token_id` - ID of the NFT token
- `maker` - Address of the order creator
- `price` - Order price in wei
- `expires_at` - When the order expires
- `order_components` - Full Seaport order data (JSONB)
- `signature` - EIP-712 signature
- `is_active` - Whether order is currently active
- `is_cancelled` - Whether order was cancelled
- `is_fulfilled` - Whether order was fulfilled

**Indexes:**
- Token ID + NFT contract (for querying orders by NFT)
- Maker address (for user's orders)
- Order type (for filtering listings/offers)
- Active status (for filtering active orders)
- Expiration time (for cleanup cron)
- Created timestamp (for sorting)
- Composite index for marketplace queries

### order_fulfillments

Tracks on-chain fulfillment events.

**Key Columns:**
- `order_hash` (FK) - References seaport_orders
- `fulfiller` - Address that fulfilled the order
- `transaction_hash` - On-chain transaction hash
- `block_number` - Block number of fulfillment
- `amount_paid` - Amount paid in the transaction

### order_cancellations

Tracks order cancellation events.

**Key Columns:**
- `order_hash` (FK) - References seaport_orders
- `cancelled_by` - Address that cancelled the order
- `transaction_hash` - On-chain transaction hash (if applicable)
- `cancellation_reason` - Optional reason for cancellation

### order_events

General event log for auditing and debugging.

**Key Columns:**
- `order_hash` - Related order (nullable)
- `event_type` - Type of event (created, cancelled, fulfilled, etc.)
- `actor` - Address that triggered the event
- `event_data` - Additional event data (JSONB)

## Foreign Key Constraints

The migration includes proper foreign key constraints:

1. `seaport_orders.para_user_id` → `users.para_user_id`
   - ON DELETE SET NULL (preserves orders if user deleted)

2. `order_fulfillments.order_hash` → `seaport_orders.order_hash`
   - ON DELETE CASCADE (removes fulfillments if order deleted)

3. `order_cancellations.order_hash` → `seaport_orders.order_hash`
   - ON DELETE CASCADE (removes cancellations if order deleted)

## Verification

After running the migration, you can verify it was successful:

```sql
-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('seaport_orders', 'order_fulfillments', 'order_cancellations', 'order_events')
  AND table_schema = 'public';

-- Check indexes
SELECT tablename, indexname 
FROM pg_indexes 
WHERE tablename LIKE '%order%' OR tablename = 'seaport_orders'
ORDER BY tablename, indexname;

-- Check foreign keys
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name IN ('seaport_orders', 'order_fulfillments', 'order_cancellations');
```

## Troubleshooting

### Migration fails with "relation users does not exist"

The `seaport_orders` table has a foreign key to the `users` table. Ensure the base schema is applied first:

```bash
# Apply base schema first
psql $DATABASE_URL -f database/schema.sql

# Then run Seaport migration
node database/run-seaport-migration.js apply
```

### Migration fails with "permission denied"

Ensure your database user has sufficient privileges:

```sql
GRANT CREATE ON SCHEMA public TO your_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_user;
```

### Need to re-run migration

If you need to re-run the migration:

```bash
# Rollback first
node database/run-seaport-migration.js rollback

# Then apply again
node database/run-seaport-migration.js apply
```

## Performance Considerations

The migration creates multiple indexes to optimize common query patterns:

- **Token lookups**: Fast retrieval of orders for a specific NFT
- **User queries**: Fast retrieval of a user's listings and offers
- **Marketplace queries**: Efficient filtering and sorting of active orders
- **Expiration cleanup**: Fast identification of expired orders
- **Event lookups**: Efficient event log queries

These indexes will slightly slow down write operations but significantly improve read performance, which is the expected access pattern for a marketplace.

## Next Steps

After applying the migration:

1. Implement the OrderService for business logic
2. Implement the OrderValidationService for signature verification
3. Create API routes for order operations
4. Set up WebSocket broadcasting for real-time updates
5. Implement the cleanup cron job for expired orders
6. Implement the fulfillment monitor for blockchain events

See the main implementation plan in `.kiro/specs/seaport-orderbook/tasks.md` for details.
