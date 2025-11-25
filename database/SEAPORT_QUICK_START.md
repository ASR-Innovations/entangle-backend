# Seaport Orderbook - Quick Start Guide

## TL;DR

```bash
# Apply the migration
node database/run-seaport-migration.js apply

# Verify it worked
node database/verify-seaport-schema.js

# Test functionality
node database/test-seaport-schema.js
```

## What Was Created?

4 new tables for NFT marketplace orders:
- `seaport_orders` - All listings and offers
- `order_fulfillments` - On-chain fulfillment tracking
- `order_cancellations` - Cancellation tracking
- `order_events` - Audit log

## Common Queries

### Get active listing for an NFT
```sql
SELECT * FROM seaport_orders
WHERE token_id = '123'
  AND nft_contract = '0x...'
  AND order_type = 'listing'
  AND is_active = true
  AND expires_at > NOW()
LIMIT 1;
```

### Get all offers for an NFT
```sql
SELECT * FROM seaport_orders
WHERE token_id = '123'
  AND nft_contract = '0x...'
  AND order_type = 'offer'
  AND is_active = true
  AND expires_at > NOW()
ORDER BY CAST(price AS NUMERIC) DESC;
```

### Get user's active listings
```sql
SELECT * FROM seaport_orders
WHERE maker = '0x...'
  AND order_type = 'listing'
  AND is_active = true
  AND expires_at > NOW()
ORDER BY created_at DESC;
```

### Get expired orders (for cleanup cron)
```sql
SELECT order_hash FROM seaport_orders
WHERE is_active = true
  AND expires_at < NOW();
```

### Get order with fulfillment details
```sql
SELECT 
  o.*,
  f.fulfiller,
  f.transaction_hash,
  f.block_number,
  f.fulfilled_at
FROM seaport_orders o
LEFT JOIN order_fulfillments f ON o.order_hash = f.order_hash
WHERE o.order_hash = '0x...';
```

## Schema Overview

### seaport_orders
```
order_hash (PK)          - Unique order identifier
order_type               - 'listing' or 'offer'
nft_contract             - NFT contract address
token_id                 - NFT token ID
maker                    - Order creator address
price                    - Price in wei (string)
order_components (JSONB) - Full Seaport order data
signature                - EIP-712 signature
is_active                - Currently active?
is_fulfilled             - Fulfilled on-chain?
is_cancelled             - Cancelled?
expires_at               - Expiration timestamp
```

### Indexes
- Fast token lookups: `(token_id, nft_contract)`
- Fast user queries: `(maker)`, `(para_user_id)`
- Fast marketplace queries: `(is_active, order_type, created_at)`
- Fast expiration cleanup: `(expires_at)`

## Rollback

If you need to remove the tables:

```bash
node database/run-seaport-migration.js rollback
```

⚠️ This will delete all order data!

## Documentation

- Full details: `SEAPORT_MIGRATION_README.md`
- Migration summary: `MIGRATION_SUMMARY.md`
- Design doc: `.kiro/specs/seaport-orderbook/design.md`
- Requirements: `.kiro/specs/seaport-orderbook/requirements.md`
