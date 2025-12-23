-- Migration: Add creator profiles and tokens tables
-- This adds support for creator profiles, tokens, and social features

-- Creator Profiles table
CREATE TABLE IF NOT EXISTS creator_profiles (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(42) UNIQUE NOT NULL,
  twitter_username VARCHAR(255) UNIQUE,
  twitter_id VARCHAR(255),
  twitter_followers_count INTEGER DEFAULT 0,
  twitter_following_count INTEGER DEFAULT 0,
  twitter_tweet_count INTEGER DEFAULT 0,
  twitter_verified BOOLEAN DEFAULT FALSE,
  twitter_url TEXT,
  bio TEXT,
  profile_image TEXT,
  cover_image TEXT,
  website_url TEXT,
  telegram_url TEXT,
  discord_url TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  badge_tier VARCHAR(50),
  total_events_created INTEGER DEFAULT 0,
  total_followers INTEGER DEFAULT 0,
  last_synced_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Creator Tokens table
CREATE TABLE IF NOT EXISTS creator_tokens (
  id SERIAL PRIMARY KEY,
  creator_profile_id INTEGER NOT NULL,
  contract_address VARCHAR(42) UNIQUE NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  name VARCHAR(255) NOT NULL,
  decimals INTEGER DEFAULT 18,
  total_supply VARCHAR(78),
  circulating_supply VARCHAR(78),
  current_price NUMERIC(36, 18) DEFAULT 0,
  price_change_24h NUMERIC(10, 2) DEFAULT 0,
  price_change_7d NUMERIC(10, 2) DEFAULT 0,
  volume_24h NUMERIC(36, 18) DEFAULT 0,
  market_cap NUMERIC(36, 18) DEFAULT 0,
  liquidity_pool_address VARCHAR(42),
  total_transactions INTEGER DEFAULT 0,
  unique_traders INTEGER DEFAULT 0,
  buy_count_24h INTEGER DEFAULT 0,
  sell_count_24h INTEGER DEFAULT 0,
  high_24h NUMERIC(36, 18),
  low_24h NUMERIC(36, 18),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (creator_profile_id) REFERENCES creator_profiles(id) ON DELETE CASCADE
);

-- Token Price History table
CREATE TABLE IF NOT EXISTS token_price_history (
  id SERIAL PRIMARY KEY,
  token_id INTEGER NOT NULL,
  timestamp BIGINT NOT NULL,
  open_price NUMERIC(36, 18) NOT NULL,
  high_price NUMERIC(36, 18) NOT NULL,
  low_price NUMERIC(36, 18) NOT NULL,
  close_price NUMERIC(36, 18) NOT NULL,
  volume NUMERIC(36, 18) DEFAULT 0,
  time_interval VARCHAR(10) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (token_id) REFERENCES creator_tokens(id) ON DELETE CASCADE,
  UNIQUE(token_id, timestamp, time_interval)
);

-- Token Holders table
CREATE TABLE IF NOT EXISTS token_holders (
  id SERIAL PRIMARY KEY,
  token_id INTEGER NOT NULL,
  holder_address VARCHAR(42) NOT NULL,
  balance VARCHAR(78) NOT NULL,
  percentage NUMERIC(10, 4) DEFAULT 0,
  first_acquired_at TIMESTAMP,
  last_transaction_at TIMESTAMP,
  total_transactions INTEGER DEFAULT 0,
  is_whale BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (token_id) REFERENCES creator_tokens(id) ON DELETE CASCADE,
  UNIQUE(token_id, holder_address)
);

-- Token Transactions table
CREATE TABLE IF NOT EXISTS token_transactions (
  id SERIAL PRIMARY KEY,
  token_id INTEGER NOT NULL,
  transaction_hash VARCHAR(66) UNIQUE NOT NULL,
  transaction_type VARCHAR(20) NOT NULL,
  trader_address VARCHAR(42) NOT NULL,
  token_amount VARCHAR(78) NOT NULL,
  payment_amount VARCHAR(78),
  payment_token VARCHAR(42),
  price_per_token NUMERIC(36, 18),
  usd_value NUMERIC(36, 18),
  gas_used VARCHAR(78),
  gas_price VARCHAR(78),
  dex VARCHAR(50),
  block_number BIGINT,
  timestamp TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (token_id) REFERENCES creator_tokens(id) ON DELETE CASCADE
);

-- Telegram Rooms table
CREATE TABLE IF NOT EXISTS telegram_rooms (
  id SERIAL PRIMARY KEY,
  creator_profile_id INTEGER NOT NULL,
  room_id VARCHAR(255) UNIQUE NOT NULL,
  room_name VARCHAR(255) NOT NULL,
  invite_link TEXT,
  price_per_minute NUMERIC(10, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USDC',
  active_members INTEGER DEFAULT 0,
  total_members INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (creator_profile_id) REFERENCES creator_profiles(id) ON DELETE CASCADE
);

-- Telegram Access Purchases table
CREATE TABLE IF NOT EXISTS telegram_purchases (
  id SERIAL PRIMARY KEY,
  telegram_room_id INTEGER NOT NULL,
  user_para_id VARCHAR(255) NOT NULL,
  wallet_address VARCHAR(42) NOT NULL,
  duration_minutes INTEGER NOT NULL,
  price_paid NUMERIC(36, 18) NOT NULL,
  payment_token VARCHAR(42) NOT NULL,
  transaction_hash VARCHAR(66),
  invite_link TEXT,
  access_granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  access_expires_at TIMESTAMP NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (telegram_room_id) REFERENCES telegram_rooms(id) ON DELETE CASCADE
);

-- Creator Followers table
CREATE TABLE IF NOT EXISTS creator_followers (
  id SERIAL PRIMARY KEY,
  creator_profile_id INTEGER NOT NULL,
  follower_para_id VARCHAR(255) NOT NULL,
  follower_wallet VARCHAR(42) NOT NULL,
  notifications_enabled BOOLEAN DEFAULT TRUE,
  followed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (creator_profile_id) REFERENCES creator_profiles(id) ON DELETE CASCADE,
  UNIQUE(creator_profile_id, follower_para_id)
);

-- Indexes for creator_profiles
CREATE INDEX IF NOT EXISTS idx_creator_profiles_wallet ON creator_profiles(wallet_address);
CREATE INDEX IF NOT EXISTS idx_creator_profiles_twitter_username ON creator_profiles(twitter_username);
CREATE INDEX IF NOT EXISTS idx_creator_profiles_twitter_id ON creator_profiles(twitter_id);
CREATE INDEX IF NOT EXISTS idx_creator_profiles_verified ON creator_profiles(is_verified);

-- Indexes for creator_tokens
CREATE INDEX IF NOT EXISTS idx_creator_tokens_creator_id ON creator_tokens(creator_profile_id);
CREATE INDEX IF NOT EXISTS idx_creator_tokens_contract ON creator_tokens(contract_address);
CREATE INDEX IF NOT EXISTS idx_creator_tokens_volume ON creator_tokens(volume_24h DESC);
CREATE INDEX IF NOT EXISTS idx_creator_tokens_market_cap ON creator_tokens(market_cap DESC);

-- Indexes for token_price_history
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'token_price_history') THEN
    CREATE INDEX IF NOT EXISTS idx_token_price_history_token_id ON token_price_history(token_id);
    CREATE INDEX IF NOT EXISTS idx_token_price_history_timestamp ON token_price_history(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_token_price_history_interval ON token_price_history(time_interval);
  END IF;
END $$;

-- Indexes for token_holders
CREATE INDEX IF NOT EXISTS idx_token_holders_token_id ON token_holders(token_id);
CREATE INDEX IF NOT EXISTS idx_token_holders_address ON token_holders(holder_address);
CREATE INDEX IF NOT EXISTS idx_token_holders_balance ON token_holders(token_id, balance DESC);

-- Indexes for token_transactions
CREATE INDEX IF NOT EXISTS idx_token_transactions_token_id ON token_transactions(token_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_trader ON token_transactions(trader_address);
CREATE INDEX IF NOT EXISTS idx_token_transactions_type ON token_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_token_transactions_timestamp ON token_transactions(timestamp DESC);

-- Indexes for telegram_rooms
CREATE INDEX IF NOT EXISTS idx_telegram_rooms_creator_id ON telegram_rooms(creator_profile_id);
CREATE INDEX IF NOT EXISTS idx_telegram_rooms_active ON telegram_rooms(is_active);

-- Indexes for telegram_purchases
CREATE INDEX IF NOT EXISTS idx_telegram_purchases_room_id ON telegram_purchases(telegram_room_id);
CREATE INDEX IF NOT EXISTS idx_telegram_purchases_user ON telegram_purchases(user_para_id);
CREATE INDEX IF NOT EXISTS idx_telegram_purchases_status ON telegram_purchases(status);
CREATE INDEX IF NOT EXISTS idx_telegram_purchases_expires ON telegram_purchases(access_expires_at);

-- Indexes for creator_followers
CREATE INDEX IF NOT EXISTS idx_creator_followers_creator_id ON creator_followers(creator_profile_id);
CREATE INDEX IF NOT EXISTS idx_creator_followers_follower ON creator_followers(follower_para_id);

-- Triggers for auto-updating updated_at
CREATE OR REPLACE FUNCTION update_creator_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_creator_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_token_holders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_telegram_rooms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_creator_profiles_updated_at ON creator_profiles;
CREATE TRIGGER trigger_update_creator_profiles_updated_at
    BEFORE UPDATE ON creator_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_creator_profiles_updated_at();

DROP TRIGGER IF EXISTS trigger_update_creator_tokens_updated_at ON creator_tokens;
CREATE TRIGGER trigger_update_creator_tokens_updated_at
    BEFORE UPDATE ON creator_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_creator_tokens_updated_at();

DROP TRIGGER IF EXISTS trigger_update_token_holders_updated_at ON token_holders;
CREATE TRIGGER trigger_update_token_holders_updated_at
    BEFORE UPDATE ON token_holders
    FOR EACH ROW
    EXECUTE FUNCTION update_token_holders_updated_at();

DROP TRIGGER IF EXISTS trigger_update_telegram_rooms_updated_at ON telegram_rooms;
CREATE TRIGGER trigger_update_telegram_rooms_updated_at
    BEFORE UPDATE ON telegram_rooms
    FOR EACH ROW
    EXECUTE FUNCTION update_telegram_rooms_updated_at();
