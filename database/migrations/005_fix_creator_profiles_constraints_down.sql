-- Migration Rollback: Restore NOT NULL constraints
-- WARNING: This will fail if there are NULL values in these columns

-- Restore user_id NOT NULL constraint
ALTER TABLE creator_profiles
  ALTER COLUMN user_id SET NOT NULL;

-- Restore para_user_id NOT NULL constraint
ALTER TABLE creator_profiles
  ALTER COLUMN para_user_id SET NOT NULL;

-- Remove the index
DROP INDEX IF EXISTS idx_creator_profiles_wallet_lower;
