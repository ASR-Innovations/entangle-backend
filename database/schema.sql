-- Users table (simplified since Para handles user data)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  para_user_id VARCHAR(255) UNIQUE NOT NULL,
  wallet_address VARCHAR(42) UNIQUE,
  email VARCHAR(255),
  auth_type VARCHAR(50), -- email, phone, farcaster, telegram, externalWallet
  oauth_method VARCHAR(50), -- google, x, discord, facebook, apple
  display_name VARCHAR(255),
  profile_image TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Auctions table
CREATE TABLE IF NOT EXISTS auctions (
  id INTEGER PRIMARY KEY,
  contract_address VARCHAR(42) NOT NULL,
  creator_para_id VARCHAR(255) NOT NULL,
  creator_wallet VARCHAR(42) NOT NULL,

  -- Auction info
  title VARCHAR(255) NOT NULL,
  description TEXT,
  metadata_ipfs VARCHAR(255),

  -- Creator display info
  twitter_id VARCHAR(255),
  seller_name VARCHAR(255),
  profile_picture TEXT,

  -- Event details
  event_date TIMESTAMP,
  event_start_time TIMESTAMP,
  event_end_time TIMESTAMP,

  -- Blockchain data cache
  bid_price VARCHAR(50), -- Reserve/starting price
  duration_blocks INTEGER,
  end_block INTEGER,
  highest_bid VARCHAR(50),
  highest_bidder VARCHAR(42),
  blocks_remaining INTEGER,
  time_remaining_seconds INTEGER,

  -- Meeting info
  meeting_duration INTEGER DEFAULT 60,
  nft_token_id INTEGER,
  jitsi_room_id VARCHAR(255),

  -- Status
  auto_ended BOOLEAN DEFAULT FALSE,
  ended BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (creator_wallet) REFERENCES users(wallet_address)
);

-- Meetings table
CREATE TABLE IF NOT EXISTS meetings (
  id SERIAL PRIMARY KEY,
  auction_id INTEGER NOT NULL,
  jitsi_room_id VARCHAR(255) NOT NULL,
  jitsi_room_config JSONB,
  creator_access_token TEXT NOT NULL,
  winner_access_token TEXT NOT NULL,
  room_url TEXT NOT NULL,
  scheduled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (auction_id) REFERENCES auctions(id)
);

-- Meeting access logs
CREATE TABLE IF NOT EXISTS meeting_access_logs (
  id SERIAL PRIMARY KEY,
  auction_id INTEGER NOT NULL,
  user_para_id VARCHAR(255) NOT NULL,
  wallet_address VARCHAR(42) NOT NULL,
  nft_token_id INTEGER,
  transaction_hash VARCHAR(66),
  lit_gate_pass_hash VARCHAR(66),
  access_method VARCHAR(50) DEFAULT 'nft_burn_lit',
  accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (auction_id) REFERENCES auctions(id)
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_para_id VARCHAR(255) NOT NULL,
  wallet_address VARCHAR(42) NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Lit gate passes
CREATE TABLE IF NOT EXISTS lit_gate_passes (
  id SERIAL PRIMARY KEY,
  nonce VARCHAR(255) UNIQUE NOT NULL,
  user_para_id VARCHAR(255) NOT NULL,
  wallet_address VARCHAR(42) NOT NULL,
  auction_id INTEGER NOT NULL,
  payload_hash VARCHAR(66) NOT NULL,
  signature VARCHAR(255) NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Para sessions cache (optional, for performance)
CREATE TABLE IF NOT EXISTS para_sessions (
  id SERIAL PRIMARY KEY,
  para_user_id VARCHAR(255) UNIQUE NOT NULL,
  session_data JSONB,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_para_id ON users(para_user_id);
CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_auctions_creator ON auctions(creator_para_id);
CREATE INDEX IF NOT EXISTS idx_auctions_twitter_id ON auctions(twitter_id);
CREATE INDEX IF NOT EXISTS idx_auctions_event_date ON auctions(event_date);
CREATE INDEX IF NOT EXISTS idx_auctions_ended ON auctions(ended);
CREATE INDEX IF NOT EXISTS idx_auctions_end_block ON auctions(end_block);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_para_id);
CREATE INDEX IF NOT EXISTS idx_meetings_auction ON meetings(auction_id);
CREATE INDEX IF NOT EXISTS idx_lit_gate_passes_nonce ON lit_gate_passes(nonce);
CREATE INDEX IF NOT EXISTS idx_para_sessions_user ON para_sessions(para_user_id);
--
-- ============================================================================
-- SEAPORT ORDERBOOK TABLES
-- ============================================================================

-- Seaport Orders table
CREATE TABLE IF NOT EXISTS seaport_orders (
  order_hash VARCHAR(66) PRIMARY KEY,
  order_type VARCHAR(20) NOT NULL CHECK (order_type IN ('listing', 'offer')),
  nft_contract VARCHAR(42) NOT NULL,
  token_id VARCHAR(78) NOT NULL,
  maker VARCHAR(42) NOT NULL,
  taker VARCHAR(42),
  payment_token VARCHAR(42) NOT NULL,
  price VARCHAR(78) NOT NULL,
  price_decimal VARCHAR(50),
  platform_fee_amount VARCHAR(78),
  platform_fee_recipient VARCHAR(42),
  start_time BIGINT NOT NULL,
  end_time BIGINT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  order_components JSONB NOT NULL,
  signature TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  is_cancelled BOOLEAN DEFAULT false,
  is_fulfilled BOOLEAN DEFAULT false,
  fulfilled_at TIMESTAMP,
  fulfilled_by VARCHAR(42),
  fulfillment_tx_hash VARCHAR(66),
  cancelled_at TIMESTAMP,
  cancellation_tx_hash VARCHAR(66),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  para_user_id VARCHAR(255),
  CONSTRAINT fk_seaport_orders_user FOREIGN KEY (para_user_id) 
    REFERENCES users(para_user_id) ON DELETE SET NULL
);

-- Order Fulfillments table
CREATE TABLE IF NOT EXISTS order_fulfillments (
  id SERIAL PRIMARY KEY,
  order_hash VARCHAR(66) NOT NULL,
  fulfiller VARCHAR(42) NOT NULL,
  transaction_hash VARCHAR(66) NOT NULL UNIQUE,
  block_number BIGINT NOT NULL,
  amount_paid VARCHAR(78),
  platform_fee_paid VARCHAR(78),
  fulfilled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_fulfillments_order FOREIGN KEY (order_hash) 
    REFERENCES seaport_orders(order_hash) ON DELETE CASCADE
);

-- Order Cancellations table
CREATE TABLE IF NOT EXISTS order_cancellations (
  id SERIAL PRIMARY KEY,
  order_hash VARCHAR(66) NOT NULL,
  cancelled_by VARCHAR(42) NOT NULL,
  transaction_hash VARCHAR(66) UNIQUE,
  cancellation_reason VARCHAR(255),
  cancelled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_cancellations_order FOREIGN KEY (order_hash) 
    REFERENCES seaport_orders(order_hash) ON DELETE CASCADE
);

-- Order Events table
CREATE TABLE IF NOT EXISTS order_events (
  id SERIAL PRIMARY KEY,
  order_hash VARCHAR(66),
  event_type VARCHAR(50) NOT NULL,
  actor VARCHAR(42),
  event_data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seaport Orders indexes
CREATE INDEX IF NOT EXISTS idx_seaport_orders_token_id ON seaport_orders(token_id, nft_contract);
CREATE INDEX IF NOT EXISTS idx_seaport_orders_maker ON seaport_orders(maker);
CREATE INDEX IF NOT EXISTS idx_seaport_orders_order_type ON seaport_orders(order_type);
CREATE INDEX IF NOT EXISTS idx_seaport_orders_is_active ON seaport_orders(is_active);
CREATE INDEX IF NOT EXISTS idx_seaport_orders_expires_at ON seaport_orders(expires_at);
CREATE INDEX IF NOT EXISTS idx_seaport_orders_created_at ON seaport_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_seaport_orders_para_user_id ON seaport_orders(para_user_id);
CREATE INDEX IF NOT EXISTS idx_seaport_orders_active_orders ON seaport_orders(order_type, token_id, is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_seaport_orders_marketplace ON seaport_orders(is_active, order_type, created_at DESC) WHERE is_active = true;

-- Order Fulfillments indexes
CREATE INDEX IF NOT EXISTS idx_order_fulfillments_order_hash ON order_fulfillments(order_hash);
CREATE INDEX IF NOT EXISTS idx_order_fulfillments_fulfiller ON order_fulfillments(fulfiller);
CREATE INDEX IF NOT EXISTS idx_order_fulfillments_tx_hash ON order_fulfillments(transaction_hash);

-- Order Cancellations indexes
CREATE INDEX IF NOT EXISTS idx_order_cancellations_order_hash ON order_cancellations(order_hash);
CREATE INDEX IF NOT EXISTS idx_order_cancellations_cancelled_by ON order_cancellations(cancelled_by);

-- Order Events indexes
CREATE INDEX IF NOT EXISTS idx_order_events_order_hash ON order_events(order_hash);
CREATE INDEX IF NOT EXISTS idx_order_events_event_type ON order_events(event_type);
CREATE INDEX IF NOT EXISTS idx_order_events_created_at ON order_events(created_at DESC);

-- Trigger for auto-updating updated_at on seaport_orders
CREATE OR REPLACE FUNCTION update_seaport_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_seaport_orders_updated_at ON seaport_orders;
CREATE TRIGGER trigger_update_seaport_orders_updated_at
    BEFORE UPDATE ON seaport_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_seaport_orders_updated_at();
