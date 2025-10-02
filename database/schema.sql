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
  title VARCHAR(255) NOT NULL,
  description TEXT,
  metadata_ipfs VARCHAR(255),
  meeting_duration INTEGER DEFAULT 60,
  nft_token_id INTEGER,
  jitsi_room_id VARCHAR(255),
  auto_ended BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_para_id);
CREATE INDEX IF NOT EXISTS idx_meetings_auction ON meetings(auction_id);
CREATE INDEX IF NOT EXISTS idx_lit_gate_passes_nonce ON lit_gate_passes(nonce);
CREATE INDEX IF NOT EXISTS idx_para_sessions_user ON para_sessions(para_user_id);