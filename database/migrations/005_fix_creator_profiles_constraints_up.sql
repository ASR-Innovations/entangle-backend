-- Migration: Fix creator_profiles NOT NULL constraints
-- Issue: user_id and para_user_id are NOT NULL but not always available
-- when caching Twitter data for creators who haven't logged in yet

-- Make user_id nullable (creator profiles can exist without user accounts)
ALTER TABLE creator_profiles
  ALTER COLUMN user_id DROP NOT NULL;

-- Make para_user_id nullable (creator profiles can exist without Para accounts)
ALTER TABLE creator_profiles
  ALTER COLUMN para_user_id DROP NOT NULL;

-- Add index for faster lookups by wallet_address (if not exists)
CREATE INDEX IF NOT EXISTS idx_creator_profiles_wallet_lower
  ON creator_profiles(LOWER(wallet_address));
