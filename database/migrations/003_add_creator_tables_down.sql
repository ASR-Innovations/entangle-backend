-- Migration Rollback: Remove creator tables and related structures

-- Drop triggers
DROP TRIGGER IF EXISTS trigger_update_telegram_rooms_updated_at ON telegram_rooms;
DROP TRIGGER IF EXISTS trigger_update_token_holders_updated_at ON token_holders;
DROP TRIGGER IF EXISTS trigger_update_creator_tokens_updated_at ON creator_tokens;
DROP TRIGGER IF EXISTS trigger_update_creator_profiles_updated_at ON creator_profiles;

-- Drop functions
DROP FUNCTION IF EXISTS update_telegram_rooms_updated_at();
DROP FUNCTION IF EXISTS update_token_holders_updated_at();
DROP FUNCTION IF EXISTS update_creator_tokens_updated_at();
DROP FUNCTION IF EXISTS update_creator_profiles_updated_at();

-- Drop tables (in reverse dependency order)
DROP TABLE IF EXISTS creator_followers CASCADE;
DROP TABLE IF EXISTS telegram_purchases CASCADE;
DROP TABLE IF EXISTS telegram_rooms CASCADE;
DROP TABLE IF EXISTS token_transactions CASCADE;
DROP TABLE IF EXISTS token_holders CASCADE;
DROP TABLE IF EXISTS token_price_history CASCADE;
DROP TABLE IF EXISTS creator_tokens CASCADE;
DROP TABLE IF EXISTS creator_profiles CASCADE;
