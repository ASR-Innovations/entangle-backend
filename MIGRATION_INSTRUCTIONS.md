# 🔧 Database Migration Instructions

## Problem
You're getting this error:
```
column a.highest_bid does not exist
```

This means the new cache columns haven't been added to your database yet.

## ✅ Solution: Add the Cache Columns

You have **3 options** to fix this:

---

## Option 1: Run SQL Script Directly (Recommended)

### Step 1: Connect to your PostgreSQL database
```bash
# Using psql command line
psql -h your_host -U your_user -d your_database

# Or using your database GUI (pgAdmin, DBeaver, etc.)
```

### Step 2: Run the SQL script
```sql
-- Copy and paste the contents of database/add_cache_columns.sql
-- Or run it directly:
\i database/add_cache_columns.sql
```

### Step 3: Verify columns were added
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'auctions' 
AND column_name IN ('highest_bid', 'highest_bidder', 'end_block', 'current_block', 'time_remaining_seconds', 'last_updated');
```

You should see 6 rows returned.

---

## Option 2: Run Migration Script (If DATABASE_URL is set)

### Step 1: Set your DATABASE_URL environment variable
```bash
# In your .env file or export it
export DATABASE_URL="postgresql://user:password@host:port/database"
```

### Step 2: Run the migration script
```bash
node database/migrate_add_auction_cache.js
```

---

## Option 3: Manual SQL Commands

Run these SQL commands one by one in your database:

```sql
-- Add all cache columns
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS highest_bid NUMERIC;
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS highest_bidder VARCHAR(42);
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS end_block BIGINT;
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS current_block BIGINT;
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS time_remaining_seconds INTEGER;
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_auctions_active ON auctions(auto_ended, last_updated);
CREATE INDEX IF NOT EXISTS idx_auctions_end_block ON auctions(end_block);
```

---

## ✅ Verification

After running the migration, test the endpoint again:

```bash
GET http://your-backend-url/api/auctions/active
```

You should now get a successful response with auction data.

---

## 🐛 Troubleshooting

### Error: "column already exists"
- This is fine! The columns are already there.
- You can skip the migration.

### Error: "relation auctions does not exist"
- Your `auctions` table doesn't exist yet.
- Run the full schema.sql first:
  ```bash
  psql -d your_database -f database/schema.sql
  ```

### Error: "permission denied"
- Make sure your database user has ALTER TABLE permissions.
- Contact your database administrator.

---

## 📝 Quick Reference

**File to run:** `database/add_cache_columns.sql`

**Columns being added:**
- `highest_bid` (NUMERIC)
- `highest_bidder` (VARCHAR(42))
- `end_block` (BIGINT)
- `current_block` (BIGINT)
- `time_remaining_seconds` (INTEGER)
- `last_updated` (TIMESTAMP)

**Indexes being created:**
- `idx_auctions_active`
- `idx_auctions_end_block`

