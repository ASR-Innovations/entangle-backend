# Seaport Orderbook Migration Guide

Quick reference for running the Seaport orderbook database migration.

## Quick Start

### 1. Check Migration Status
```bash
node database/migrations/migrate.js status
```

### 2. Apply Migration (Development)
```bash
# Test first (dry-run)
node database/migrations/migrate.js up 002 --dry-run

# Apply migration
node database/migrations/migrate.js up 002

# Verify
node database/verify-seaport-schema.js
```

### 3. Apply Migration (Production)

**⚠️ CRITICAL: Backup database first!**

```bash
# 1. Backup database
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Test on staging environment first

# 3. Apply migration during maintenance window
node database/migrations/migrate.js up 002

# 4. Verify
node database/migrations/migrate.js status
node database/verify-seaport-schema.js

# 5. Monitor application logs
```

## Rollback Procedure

If issues occur after migration:

```bash
# 1. Stop application
pm2 stop all  # or your process manager

# 2. Rollback migration
node database/migrations/migrate.js down 002

# 3. Verify rollback
node database/migrations/migrate.js status

# 4. Restart application with previous version
```

## What Gets Created

### Tables (4)
- `seaport_orders` - Main orders table
- `order_fulfillments` - Fulfillment tracking
- `order_cancellations` - Cancellation tracking
- `order_events` - Event logging
- `schema_migrations` - Migration tracking

### Indexes (23)
Optimized for:
- Token ID lookups
- Maker/fulfiller queries
- Active order filtering
- Marketplace browsing
- Event logging

### Triggers (1)
- Auto-update `updated_at` on `seaport_orders`

## Verification Checklist

After migration, verify:

- [ ] All 4 tables created
- [ ] 23 indexes created
- [ ] Foreign key constraints working
- [ ] Trigger functioning
- [ ] Migration tracked in `schema_migrations`
- [ ] Application can connect to database
- [ ] Order creation endpoint works
- [ ] Order retrieval endpoint works

## Troubleshooting

### Migration Already Applied
```
⚠️  Migration 002 is already applied
```
**Solution**: Check status with `node database/migrations/migrate.js status`

### Connection Failed
```
❌ Migration failed: connection refused
```
**Solution**: 
1. Check PostgreSQL is running: `pg_isready`
2. Verify `.env` configuration
3. Test connection: `psql -h $DB_HOST -U $DB_USER -d $DB_NAME`

### Foreign Key Error
```
❌ Migration failed: foreign key constraint
```
**Solution**: Ensure `users` table exists (run earlier migrations first)

## Environment Variables

Required in `.env`:

```bash
# Option 1: Connection string (recommended for production)
DATABASE_URL=postgresql://user:password@host:port/database

# Option 2: Individual parameters (for development)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=meeting_auction
DB_USER=postgres
DB_PASSWORD=your_password
```

## Migration Files

Located in `database/migrations/`:
- `002_seaport_orderbook_up.sql` - Creates tables
- `002_seaport_orderbook_down.sql` - Removes tables
- `migrate.js` - Migration runner
- `README.md` - Full documentation

## Support Commands

```bash
# Show help
node database/migrations/migrate.js help

# Check status
node database/migrations/migrate.js status

# Dry run (test without applying)
node database/migrations/migrate.js up --dry-run

# Apply specific migration
node database/migrations/migrate.js up 002

# Apply all pending
node database/migrations/migrate.js up

# Rollback specific migration
node database/migrations/migrate.js down 002

# Verify schema
node database/verify-seaport-schema.js
```

## Best Practices

1. ✅ **Always backup** before production migrations
2. ✅ **Test on staging** first
3. ✅ **Use dry-run** to preview changes
4. ✅ **Plan maintenance window** for production
5. ✅ **Monitor logs** after migration
6. ✅ **Have rollback plan** ready
7. ✅ **Verify schema** after migration
8. ✅ **Test application** endpoints

## Timeline Estimate

- Development: 2-5 minutes
- Staging: 5-10 minutes (with verification)
- Production: 15-30 minutes (with backup and verification)

## Related Documentation

- `README.md` - Full migration documentation
- `database/SEAPORT_MIGRATION_README.md` - Legacy docs
- `database/SEAPORT_QUICK_START.md` - Quick start guide
- `.kiro/specs/seaport-orderbook/requirements.md` - Requirements
- `.kiro/specs/seaport-orderbook/design.md` - Design document

---

**Last Updated**: 2024
**Migration Version**: 002
**Status**: ✅ Ready for production
