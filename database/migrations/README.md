# Database Migrations

This directory contains database migration scripts for the Entangle platform's Seaport orderbook integration.

## Overview

The migration system provides a structured way to manage database schema changes with:
- **Version control** for database schema
- **Rollback capability** for safe deployments
- **Transaction safety** to prevent partial migrations
- **Migration tracking** to prevent duplicate runs
- **Dry-run mode** for testing before applying

## Directory Structure

```
database/migrations/
├── README.md                           # This file
├── migrate.js                          # Migration runner script
├── 002_seaport_orderbook_up.sql      # Migration 002 (apply)
└── 002_seaport_orderbook_down.sql    # Migration 002 (rollback)
```

## Migration Files

### Migration 002: Seaport Orderbook Tables

**Purpose**: Creates the complete database schema for Seaport protocol orderbook functionality.

**Tables Created**:
- `seaport_orders` - Main table for storing all orders (listings and offers)
- `order_fulfillments` - Tracks on-chain order fulfillment events
- `order_cancellations` - Records order cancellation events
- `order_events` - General event log for all order activities
- `schema_migrations` - Tracks applied migrations

**Indexes Created**: 19 indexes for optimal query performance
- Token ID lookups
- Maker/fulfiller queries
- Active order filtering
- Marketplace browsing
- Event logging

**Triggers Created**:
- Auto-update `updated_at` timestamp on `seaport_orders` table

## Usage

### Prerequisites

1. Ensure PostgreSQL is running
2. Configure database connection in `.env`:
   ```bash
   # Option 1: Individual parameters
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=meeting_auction
   DB_USER=postgres
   DB_PASSWORD=your_password
   
   # Option 2: Connection string
   DATABASE_URL=postgresql://user:password@host:port/database
   ```

### Commands

#### Show Migration Status
```bash
node database/migrations/migrate.js status
```

Shows which migrations are applied and which are pending.

#### Apply All Pending Migrations
```bash
node database/migrations/migrate.js up
```

Applies all migrations that haven't been run yet.

#### Apply Specific Migration
```bash
node database/migrations/migrate.js up 002
```

Applies only migration version 002.

#### Rollback Specific Migration
```bash
node database/migrations/migrate.js down 002
```

Rolls back migration version 002 (removes all tables and indexes).

#### Dry Run (Test Mode)
```bash
node database/migrations/migrate.js up --dry-run
```

Shows what would be executed without actually applying changes.

#### Show Help
```bash
node database/migrations/migrate.js help
```

Displays usage information and examples.

## Migration Workflow

### Development Environment

1. **Check current status**:
   ```bash
   node database/migrations/migrate.js status
   ```

2. **Test migration (dry-run)**:
   ```bash
   node database/migrations/migrate.js up 002 --dry-run
   ```

3. **Apply migration**:
   ```bash
   node database/migrations/migrate.js up 002
   ```

4. **Verify tables created**:
   ```bash
   node database/verify-seaport-schema.js
   ```

### Production Environment

1. **Backup database** (CRITICAL):
   ```bash
   pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Test on staging** first with same data

3. **Apply migration** during maintenance window:
   ```bash
   node database/migrations/migrate.js up 002
   ```

4. **Verify migration**:
   ```bash
   node database/migrations/migrate.js status
   node database/verify-seaport-schema.js
   ```

5. **Monitor application** for errors

### Rollback Procedure

If issues occur after migration:

1. **Stop application** to prevent data corruption

2. **Rollback migration**:
   ```bash
   node database/migrations/migrate.js down 002
   ```

3. **Restore from backup** if needed:
   ```bash
   psql -h $DB_HOST -U $DB_USER -d $DB_NAME < backup_file.sql
   ```

4. **Restart application** with previous version

## Migration Safety Features

### Transaction-Based Execution
All migrations run within a database transaction. If any part fails, the entire migration is rolled back automatically.

### Migration Tracking
The `schema_migrations` table tracks which migrations have been applied:
```sql
SELECT * FROM schema_migrations;
```

### Idempotent Operations
Migration scripts use `IF NOT EXISTS` and `IF EXISTS` clauses to safely run multiple times.

### Foreign Key Constraints
Proper CASCADE rules ensure data integrity when rolling back.

## Verification

After applying migrations, verify the schema:

```bash
# Run verification script
node database/verify-seaport-schema.js

# Or manually check tables
psql -h localhost -U postgres -d meeting_auction -c "\dt"

# Check indexes
psql -h localhost -U postgres -d meeting_auction -c "\di"
```

## Troubleshooting

### Migration Already Applied
```
⚠️  Migration 002 is already applied
```
**Solution**: Migration is already in database. Check status with `status` command.

### Connection Failed
```
❌ Migration failed: connection refused
```
**Solution**: 
- Verify PostgreSQL is running
- Check `.env` configuration
- Test connection: `psql -h $DB_HOST -U $DB_USER -d $DB_NAME`

### Foreign Key Constraint Error
```
❌ Migration failed: foreign key constraint
```
**Solution**: 
- Ensure `users` table exists (required for foreign key)
- Run migrations in order (001 before 002)

### Permission Denied
```
❌ Migration failed: permission denied
```
**Solution**: 
- Verify database user has CREATE TABLE privileges
- Grant permissions: `GRANT ALL PRIVILEGES ON DATABASE meeting_auction TO postgres;`

## Creating New Migrations

To create a new migration:

1. **Create migration files**:
   ```bash
   # Up migration (apply)
   touch database/migrations/003_your_feature_up.sql
   
   # Down migration (rollback)
   touch database/migrations/003_your_feature_down.sql
   ```

2. **Write SQL** in both files:
   - `_up.sql`: CREATE statements
   - `_down.sql`: DROP statements (reverse order)

3. **Add migration tracking**:
   ```sql
   -- In _up.sql
   INSERT INTO schema_migrations (version, description)
   VALUES ('003', 'Your Feature Description')
   ON CONFLICT (version) DO NOTHING;
   
   -- In _down.sql
   DELETE FROM schema_migrations WHERE version = '003';
   ```

4. **Test thoroughly**:
   ```bash
   # Test apply
   node database/migrations/migrate.js up 003 --dry-run
   node database/migrations/migrate.js up 003
   
   # Test rollback
   node database/migrations/migrate.js down 003
   ```

## Best Practices

1. **Always backup** before running migrations in production
2. **Test on staging** environment first
3. **Use transactions** for all schema changes
4. **Write rollback scripts** for every migration
5. **Document changes** in migration comments
6. **Version control** all migration files
7. **Never modify** applied migrations (create new ones instead)
8. **Monitor performance** after adding indexes
9. **Plan maintenance windows** for large migrations
10. **Keep migrations small** and focused

## Related Files

- `database/schema.sql` - Complete database schema
- `database/verify-seaport-schema.js` - Schema verification script
- `database/test-seaport-schema.js` - Schema testing script
- `database/SEAPORT_MIGRATION_README.md` - Legacy migration docs

## Support

For issues or questions:
1. Check this README
2. Review error messages carefully
3. Check database logs
4. Verify environment configuration
5. Test connection manually with `psql`

## Migration History

| Version | Description | Date | Status |
|---------|-------------|------|--------|
| 002 | Seaport Orderbook Tables | 2024 | ✅ Ready |

---

**Note**: Always test migrations in a development environment before applying to production.
