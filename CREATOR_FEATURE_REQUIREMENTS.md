# Creator Feature - Backend Requirements
## Strict Analysis Based on Existing Backend & Frontend

**Analyzed Components:**
- Frontend: TrendingCreatorCoins, Creator Profile Page (5 sub-components)
- Backend: Existing database schema (auctions table), routes, services

---

## PART 1: TRENDING CREATOR COINS COMPONENT

### Current Situation:
- **Frontend File:** `frontend/components/marketplace/TrendingCreatorCoins.tsx`
- **Hook:** `frontend/hooks/use-trending-creators.ts`
- **Data Source:** Currently fetches from blockchain (9 hardcoded addresses)
- **Backend Support:** NONE - No API exists

### Critical Issues:
1. **Hardcoded wallet addresses** - 9 addresses hardcoded in hook
2. **Mock price changes** - Using `Math.random()` for price change %
3. **No avatars** - All default to placeholder image
4. **No verification status** - All hardcoded to `true`
5. **No real "trending" algorithm** - Just shows all 9 addresses

---

### REQUIREMENTS FOR TRENDING CREATORS:

#### **R1. Create Creators Table**
**Priority:** CRITICAL

```sql
CREATE TABLE creators (
  wallet_address VARCHAR(42) PRIMARY KEY,
  twitter_handle VARCHAR(255),
  twitter_id VARCHAR(255),
  display_name VARCHAR(255) NOT NULL,
  profile_image_url TEXT,
  bio TEXT,
  verified BOOLEAN DEFAULT false,
  followers_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_creators_twitter_id ON creators(twitter_id);
CREATE INDEX idx_creators_verified ON creators(verified);
```

**Purpose:** Store creator profile data fetched from Twitter API

**Data Collection Method:**
- Backend cron job to fetch Twitter data periodically
- Store in database
- Update daily/weekly

---

#### **R2. Create Token Metadata Table**
**Priority:** CRITICAL

```sql
CREATE TABLE token_metadata (
  token_address VARCHAR(42) PRIMARY KEY,
  creator_wallet VARCHAR(42) REFERENCES creators(wallet_address),
  name VARCHAR(255) NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  decimals INTEGER DEFAULT 18,
  has_pool BOOLEAN DEFAULT false,
  pool_address VARCHAR(42),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_token_creator ON token_metadata(creator_wallet);
```

**Purpose:** Store basic token information

**Data Source:**
- Fetch from blockchain when creator creates token
- Cache in database

---

#### **R3. Create Token Price Snapshots Table**
**Priority:** CRITICAL (for trending calculation)

```sql
CREATE TABLE token_price_snapshots (
  id SERIAL PRIMARY KEY,
  token_address VARCHAR(42) NOT NULL,
  price_usd DECIMAL(36, 18) NOT NULL,
  price_native DECIMAL(36, 18) NOT NULL,
  volume_24h DECIMAL(36, 18) DEFAULT 0,
  snapshot_time TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (token_address) REFERENCES token_metadata(token_address)
);

CREATE INDEX idx_price_token_time ON token_price_snapshots(token_address, snapshot_time DESC);
```

**Purpose:** Store historical price data for calculating trending metrics

**Data Collection:**
- Cron job every 5-15 minutes
- Query pool reserves from blockchain
- Calculate price
- Store snapshot

---

#### **R4. Create Token Trading Volume Table**
**Priority:** HIGH

```sql
CREATE TABLE token_trades (
  id SERIAL PRIMARY KEY,
  token_address VARCHAR(42) NOT NULL,
  trader_address VARCHAR(42) NOT NULL,
  trade_type VARCHAR(10) NOT NULL, -- 'buy' or 'sell'
  amount_in DECIMAL(36, 18) NOT NULL,
  amount_out DECIMAL(36, 18) NOT NULL,
  price_at_trade DECIMAL(36, 18) NOT NULL,
  transaction_hash VARCHAR(66) NOT NULL UNIQUE,
  block_number BIGINT NOT NULL,
  trade_time TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (token_address) REFERENCES token_metadata(token_address)
);

CREATE INDEX idx_trades_token ON token_trades(token_address, trade_time DESC);
CREATE INDEX idx_trades_time ON token_trades(trade_time DESC);
```

**Purpose:** Track all token swaps for volume calculation

**Data Collection:**
- Listen to blockchain Swap events
- Index all trades
- Store in real-time

---

#### **R5. API Endpoint: GET /api/creators/trending**
**Priority:** CRITICAL

**Route:** `GET /api/creators/trending`

**Query Parameters:**
- `limit` (optional, default: 7, max: 50)
- `timeframe` (optional: '24h' | '7d' | '30d', default: '24h')

**Response Structure:**
```json
{
  "success": true,
  "data": [
    {
      "id": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb7",
      "name": "John Creator",
      "avatar": "https://pbs.twimg.com/profile_images/...",
      "verified": true,
      "symbol": "JOHN",
      "tokenAddress": "0xtoken...",
      "price": "$0.1234",
      "priceRaw": 0.1234,
      "change": 5.2,
      "changePercent": "+5.2%",
      "hasPool": true,
      "volume24h": 12345.67,
      "rank": 1
    }
  ],
  "meta": {
    "total": 7,
    "timeframe": "24h",
    "lastUpdated": "2025-12-10T10:00:00Z"
  }
}
```

**SQL Query (Complex):**
```sql
WITH price_changes AS (
  -- Get current and 24h ago prices
  SELECT
    token_address,
    FIRST_VALUE(price_usd) OVER (PARTITION BY token_address ORDER BY snapshot_time DESC) as current_price,
    FIRST_VALUE(price_usd) OVER (PARTITION BY token_address ORDER BY snapshot_time ASC) as price_24h_ago
  FROM token_price_snapshots
  WHERE snapshot_time >= NOW() - INTERVAL '24 hours'
),
volume_24h AS (
  -- Calculate 24h trading volume
  SELECT
    token_address,
    SUM(amount_in * price_at_trade) as volume_usd
  FROM token_trades
  WHERE trade_time >= NOW() - INTERVAL '24 hours'
  GROUP BY token_address
)
SELECT
  c.wallet_address as id,
  c.display_name as name,
  c.profile_image_url as avatar,
  c.verified,
  tm.symbol,
  tm.token_address as "tokenAddress",
  pc.current_price as "priceRaw",
  CONCAT('$', pc.current_price::text) as price,
  ((pc.current_price - pc.price_24h_ago) / pc.price_24h_ago * 100) as change,
  CONCAT(
    CASE WHEN ((pc.current_price - pc.price_24h_ago) / pc.price_24h_ago * 100) >= 0 THEN '+' ELSE '' END,
    ROUND(((pc.current_price - pc.price_24h_ago) / pc.price_24h_ago * 100)::numeric, 2)::text,
    '%'
  ) as "changePercent",
  tm.has_pool as "hasPool",
  COALESCE(v.volume_usd, 0) as "volume24h",
  ROW_NUMBER() OVER (ORDER BY COALESCE(v.volume_usd, 0) DESC) as rank
FROM creators c
JOIN token_metadata tm ON tm.creator_wallet = c.wallet_address
LEFT JOIN price_changes pc ON pc.token_address = tm.token_address
LEFT JOIN volume_24h v ON v.token_address = tm.token_address
WHERE tm.has_pool = true
ORDER BY COALESCE(v.volume_usd, 0) DESC
LIMIT $1;
```

**Business Logic:**
1. Calculate price change from 24h ago
2. Calculate 24h trading volume
3. Rank by volume (trending = highest volume)
4. Return top N creators

**Implementation File:** Create `src/routes/creators.js`

---

#### **R6. Cron Service: TokenPriceCollector**
**Priority:** CRITICAL

**Purpose:** Collect price snapshots every 5-15 minutes

**Implementation:** Create `src/services/TokenPriceCollectorService.js`

```javascript
class TokenPriceCollectorService {
  async collectPrices() {
    // 1. Get all tokens with pools from database
    const tokens = await getTokensWithPools();

    // 2. For each token:
    for (const token of tokens) {
      // 2a. Get pool reserves from blockchain
      const reserves = await getPoolReserves(token.pool_address);

      // 2b. Calculate price (reserve_native / reserve_token)
      const price = calculatePrice(reserves);

      // 2c. Calculate 24h volume from recent trades
      const volume24h = await calculate24hVolume(token.token_address);

      // 2d. Store snapshot
      await storeSnapshot(token.token_address, price, volume24h);
    }
  }

  start() {
    // Run every 5 minutes
    cron.schedule('*/5 * * * *', () => this.collectPrices());
  }
}
```

**Register in server.js:**
```javascript
const { getTokenPriceCollectorService } = require('./services/TokenPriceCollectorService');
const priceCollector = getTokenPriceCollectorService();
priceCollector.start();
```

---

#### **R7. Blockchain Event Listener: Trade Indexer**
**Priority:** HIGH

**Purpose:** Listen to Swap events and index all trades

**Implementation:** Extend `ContractService` or create `TradeIndexerService`

```javascript
async function listenToSwapEvents() {
  const poolContract = new ethers.Contract(poolAddress, poolABI, provider);

  poolContract.on('Swap', async (sender, amount0In, amount1In, amount0Out, amount1Out, to, event) => {
    // Parse trade details
    const trade = {
      token_address: getTokenAddress(event.address),
      trader_address: sender,
      trade_type: amount0In > 0 ? 'buy' : 'sell',
      amount_in: amount0In || amount1In,
      amount_out: amount0Out || amount1Out,
      price_at_trade: calculateTradePrice(amount0In, amount1In, amount0Out, amount1Out),
      transaction_hash: event.transactionHash,
      block_number: event.blockNumber,
      trade_time: new Date()
    };

    // Store in database
    await storeTrade(trade);
  });
}
```

---

## PART 2: CREATOR PROFILE PAGE

### Current Situation:
- **Frontend File:** `frontend/app/creator/[username]/page.tsx`
- **Sub-components:** 5 components (Header, Chart, Swap, Events, Telegram)
- **Backend Support:** PARTIAL - Only auctions table exists
- **Critical Gap:** No creator profile API, no token chart data API

---

### REQUIREMENTS FOR CREATOR PROFILE:

#### **R8. API Endpoint: GET /api/creators/:address/profile**
**Priority:** CRITICAL

**Route:** `GET /api/creators/:address/profile`

**Response:**
```json
{
  "success": true,
  "data": {
    "walletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb7",
    "twitterHandle": "johncreator",
    "twitterId": "1234567890",
    "displayName": "John Creator",
    "profileImageUrl": "https://pbs.twimg.com/profile_images/...",
    "bio": "Crypto trader and investor",
    "verified": true,
    "followersCount": 15234,
    "stats": {
      "auctions": 12,
      "totalVolume": "45.2K",
      "totalVolumeUSD": 45234.56,
      "activeAuctions": 3,
      "completedAuctions": 9
    }
  }
}
```

**SQL Query:**
```sql
SELECT
  c.*,
  COUNT(a.id) as auctions,
  COUNT(a.id) FILTER (WHERE a.ended = false) as active_auctions,
  COUNT(a.id) FILTER (WHERE a.ended = true) as completed_auctions,
  COALESCE(SUM(a.highest_bid), 0) as total_volume
FROM creators c
LEFT JOIN auctions a ON a.creator_wallet = c.wallet_address
WHERE c.wallet_address = $1
GROUP BY c.wallet_address;
```

**Implementation:** Add to `src/routes/creators.js`

---

#### **R9. API Endpoint: GET /api/tokens/:address/chart-data**
**Priority:** CRITICAL

**Route:** `GET /api/tokens/:address/chart-data`

**Query Parameters:**
- `timeframe`: '1H' | '24H' | '7D' | '30D' (required)

**Response:**
```json
{
  "success": true,
  "data": {
    "currentPrice": 0.1234,
    "priceChange24h": 0.0056,
    "priceChangePercent": "+4.76%",
    "volume24h": 12345.67,
    "marketCap": 123456.78,
    "holders": 234,
    "high24h": 0.1300,
    "low24h": 0.1150,
    "priceHistory": [
      {
        "timestamp": 1702387200000,
        "price": 0.1234,
        "volume": 1234.56
      }
    ]
  },
  "meta": {
    "timeframe": "24H",
    "dataPoints": 24
  }
}
```

**SQL Query:**
```sql
-- Get price history for chart
SELECT
  EXTRACT(EPOCH FROM snapshot_time) * 1000 as timestamp,
  price_usd as price,
  volume_24h as volume
FROM token_price_snapshots
WHERE token_address = $1
  AND snapshot_time >= NOW() - INTERVAL '24 hours'
ORDER BY snapshot_time ASC;

-- Get current stats
SELECT
  FIRST_VALUE(price_usd) OVER (ORDER BY snapshot_time DESC) as current_price,
  MAX(price_usd) as high_24h,
  MIN(price_usd) as low_24h,
  AVG(volume_24h) as avg_volume_24h
FROM token_price_snapshots
WHERE token_address = $1
  AND snapshot_time >= NOW() - INTERVAL '24 hours';
```

**Implementation:** Create `src/routes/tokens.js`

---

#### **R10. Extend Auctions Table (Already Exists)**
**Priority:** MEDIUM (Already partially done)

**Current Schema (from auctions.js):**
```sql
-- Already exists:
id, contract_address, creator_para_id, creator_wallet,
title, description, metadata_ipfs, meeting_duration,
twitter_id, seller_name, profile_picture,
event_date, event_start_time, event_end_time,
bid_price, duration_blocks, end_block,
highest_bid, highest_bidder,
blocks_remaining, time_remaining_seconds, ended
```

**Additional Fields Needed:**
```sql
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'upcoming';
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS reserve_price DECIMAL(36, 18);
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS bid_count INTEGER DEFAULT 0;
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS p2p_listing_price DECIMAL(36, 18);

CREATE INDEX IF NOT EXISTS idx_auctions_creator ON auctions(creator_wallet, ended);
CREATE INDEX IF NOT EXISTS idx_auctions_status ON auctions(status);
```

---

#### **R11. API Endpoint: GET /api/creators/:address/events**
**Priority:** HIGH

**Route:** `GET /api/creators/:address/events`

**Query Parameters:**
- `status`: 'upcoming' | 'live' | 'ended' (optional)
- `limit`: number (default: 10, max: 50)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "title": "1-on-1 Strategy Session",
      "description": "Personalized consultation",
      "date": "2025-12-12T10:00:00Z",
      "startTime": "2025-12-12T10:00:00Z",
      "endTime": "2025-12-12T11:00:00Z",
      "duration": 60,
      "status": "upcoming",
      "reservePrice": "0.1",
      "highestBid": "0.5",
      "bidCount": 5,
      "auctionEnded": false,
      "winner": null,
      "timeUntilStart": "1d 14h",
      "p2pListingPrice": null
    }
  ]
}
```

**SQL Query:**
```sql
SELECT
  id,
  title,
  description,
  event_date as date,
  event_start_time as "startTime",
  event_end_time as "endTime",
  meeting_duration as duration,
  status,
  reserve_price as "reservePrice",
  highest_bid as "highestBid",
  bid_count as "bidCount",
  ended as "auctionEnded",
  highest_bidder as winner,
  p2p_listing_price as "p2pListingPrice"
FROM auctions
WHERE creator_wallet = $1
  AND ($2::text IS NULL OR status = $2)
ORDER BY event_date ASC
LIMIT $3;
```

**Implementation:** Add to `src/routes/creators.js` or existing `src/routes/auctions.js`

---

#### **R12. Create Token Holders Table**
**Priority:** MEDIUM

```sql
CREATE TABLE token_holders (
  id SERIAL PRIMARY KEY,
  token_address VARCHAR(42) NOT NULL,
  holder_address VARCHAR(42) NOT NULL,
  balance DECIMAL(36, 18) NOT NULL,
  first_acquired TIMESTAMP DEFAULT NOW(),
  last_updated TIMESTAMP DEFAULT NOW(),
  UNIQUE(token_address, holder_address),
  FOREIGN KEY (token_address) REFERENCES token_metadata(token_address)
);

CREATE INDEX idx_holders_token ON token_holders(token_address);
CREATE INDEX idx_holders_balance ON token_holders(token_address, balance DESC);
```

**Purpose:** Track token holders for displaying holder count

**Data Collection:**
- Listen to Transfer events
- Update holder balances
- Calculate holder count

---

#### **R13. Telegram Integration (Future Feature)**
**Priority:** LOW (Feature shows "Coming Soon")

**Tables Needed:**
```sql
CREATE TABLE telegram_messages (
  message_id VARCHAR(50) PRIMARY KEY,
  sender_wallet VARCHAR(42) NOT NULL,
  creator_wallet VARCHAR(42) REFERENCES creators(wallet_address),
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 15 AND 200),
  response_type VARCHAR(20) NOT NULL,
  price_usd DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  response TEXT,
  response_time TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

CREATE TABLE telegram_stats (
  creator_wallet VARCHAR(42) PRIMARY KEY REFERENCES creators(wallet_address),
  total_messages INTEGER DEFAULT 0,
  responded_messages INTEGER DEFAULT 0,
  avg_response_time_minutes INTEGER,
  response_rate DECIMAL(5, 2),
  last_updated TIMESTAMP DEFAULT NOW()
);
```

**APIs Needed:**
- `GET /api/creators/:address/telegram-stats`
- `POST /api/creators/:address/telegram-messages`
- `GET /api/telegram/messages/:messageId`

**Note:** Can be implemented later - frontend currently shows "Coming Soon" overlay

---

## IMPLEMENTATION PRIORITY

### Phase 1 (Week 1) - CRITICAL:
1. ✅ **R1**: Create `creators` table
2. ✅ **R2**: Create `token_metadata` table
3. ✅ **R3**: Create `token_price_snapshots` table
4. ✅ **R5**: API `/api/creators/trending`
5. ✅ **R6**: TokenPriceCollector cron service
6. ✅ **R8**: API `/api/creators/:address/profile`

**Goal:** Get Trending Creators component working with real data

### Phase 2 (Week 2) - HIGH:
7. ✅ **R4**: Create `token_trades` table
8. ✅ **R7**: Trade indexer (blockchain event listener)
9. ✅ **R9**: API `/api/tokens/:address/chart-data`
10. ✅ **R11**: API `/api/creators/:address/events`
11. ✅ **R10**: Extend auctions table

**Goal:** Get Creator Profile Page fully functional (except Telegram)

### Phase 3 (Week 3) - MEDIUM:
12. ✅ **R12**: Token holders tracking
13. ⏸️ **R13**: Telegram integration (can wait - shows "Coming Soon")

---

## BACKEND SERVICE ARCHITECTURE

### New Services to Create:

1. **TokenPriceCollectorService** (`src/services/TokenPriceCollectorService.js`)
   - Collects price snapshots every 5 minutes
   - Queries pool reserves from blockchain
   - Calculates and stores prices

2. **TradeIndexerService** (`src/services/TradeIndexerService.js`)
   - Listens to blockchain Swap events
   - Indexes all trades in real-time
   - Updates volume metrics

3. **CreatorSyncService** (`src/services/CreatorSyncService.js`)
   - Syncs creator data from Twitter API
   - Updates profile images, follower counts
   - Runs daily/weekly

4. **TokenHolderTrackerService** (`src/services/TokenHolderTrackerService.js`)
   - Listens to Transfer events
   - Tracks holder balances
   - Calculates holder counts

### New Routes to Create:

1. **`src/routes/creators.js`**
   - `GET /api/creators/trending`
   - `GET /api/creators/:address/profile`
   - `GET /api/creators/:address/events`

2. **`src/routes/tokens.js`**
   - `GET /api/tokens/:address/chart-data`
   - `GET /api/tokens/:address/stats`

### Extend Existing Routes:

1. **`src/routes/auctions.js`** (already exists)
   - No changes needed, already has auction endpoints
   - Just need to extend schema with new fields

---

## DATABASE MIGRATION PLAN

### Migration 003: Creator and Token Tables

**File:** `database/migrations/003_creator_tokens_up.sql`

```sql
-- Step 1: Create creators table
CREATE TABLE IF NOT EXISTS creators (
  wallet_address VARCHAR(42) PRIMARY KEY,
  twitter_handle VARCHAR(255),
  twitter_id VARCHAR(255),
  display_name VARCHAR(255) NOT NULL,
  profile_image_url TEXT,
  bio TEXT,
  verified BOOLEAN DEFAULT false,
  followers_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_creators_twitter_id ON creators(twitter_id);
CREATE INDEX idx_creators_verified ON creators(verified);

-- Step 2: Create token_metadata table
CREATE TABLE IF NOT EXISTS token_metadata (
  token_address VARCHAR(42) PRIMARY KEY,
  creator_wallet VARCHAR(42) REFERENCES creators(wallet_address),
  name VARCHAR(255) NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  decimals INTEGER DEFAULT 18,
  has_pool BOOLEAN DEFAULT false,
  pool_address VARCHAR(42),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_token_creator ON token_metadata(creator_wallet);

-- Step 3: Create token_price_snapshots table
CREATE TABLE IF NOT EXISTS token_price_snapshots (
  id SERIAL PRIMARY KEY,
  token_address VARCHAR(42) NOT NULL,
  price_usd DECIMAL(36, 18) NOT NULL,
  price_native DECIMAL(36, 18) NOT NULL,
  volume_24h DECIMAL(36, 18) DEFAULT 0,
  snapshot_time TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (token_address) REFERENCES token_metadata(token_address)
);

CREATE INDEX idx_price_token_time ON token_price_snapshots(token_address, snapshot_time DESC);

-- Step 4: Create token_trades table
CREATE TABLE IF NOT EXISTS token_trades (
  id SERIAL PRIMARY KEY,
  token_address VARCHAR(42) NOT NULL,
  trader_address VARCHAR(42) NOT NULL,
  trade_type VARCHAR(10) NOT NULL,
  amount_in DECIMAL(36, 18) NOT NULL,
  amount_out DECIMAL(36, 18) NOT NULL,
  price_at_trade DECIMAL(36, 18) NOT NULL,
  transaction_hash VARCHAR(66) NOT NULL UNIQUE,
  block_number BIGINT NOT NULL,
  trade_time TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (token_address) REFERENCES token_metadata(token_address)
);

CREATE INDEX idx_trades_token ON token_trades(token_address, trade_time DESC);
CREATE INDEX idx_trades_time ON token_trades(trade_time DESC);

-- Step 5: Create token_holders table
CREATE TABLE IF NOT EXISTS token_holders (
  id SERIAL PRIMARY KEY,
  token_address VARCHAR(42) NOT NULL,
  holder_address VARCHAR(42) NOT NULL,
  balance DECIMAL(36, 18) NOT NULL,
  first_acquired TIMESTAMP DEFAULT NOW(),
  last_updated TIMESTAMP DEFAULT NOW(),
  UNIQUE(token_address, holder_address),
  FOREIGN KEY (token_address) REFERENCES token_metadata(token_address)
);

CREATE INDEX idx_holders_token ON token_holders(token_address);
CREATE INDEX idx_holders_balance ON token_holders(token_address, balance DESC);

-- Step 6: Extend auctions table
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'upcoming';
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS reserve_price DECIMAL(36, 18);
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS bid_count INTEGER DEFAULT 0;
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS p2p_listing_price DECIMAL(36, 18);

CREATE INDEX IF NOT EXISTS idx_auctions_creator ON auctions(creator_wallet, ended);
CREATE INDEX IF NOT EXISTS idx_auctions_status ON auctions(status);

-- Step 7: Insert into migrations tracking
INSERT INTO schema_migrations (version, description)
VALUES ('003', 'creator_tokens')
ON CONFLICT (version) DO NOTHING;
```

**Run Migration:**
```bash
cd database/migrations
node migrate.js up 003
```

---

## TESTING CHECKLIST

### API Testing:
- [ ] `GET /api/creators/trending` returns 7 creators with real data
- [ ] `GET /api/creators/:address/profile` returns profile with stats
- [ ] `GET /api/tokens/:address/chart-data` returns price history
- [ ] `GET /api/creators/:address/events` returns creator's events
- [ ] All APIs handle invalid addresses gracefully
- [ ] All APIs have proper error responses

### Data Collection Testing:
- [ ] TokenPriceCollector runs every 5 minutes
- [ ] Price snapshots are stored correctly
- [ ] TradeIndexer listens to Swap events
- [ ] Trades are indexed in real-time
- [ ] Volume calculations are accurate

### Frontend Integration Testing:
- [ ] TrendingCreatorCoins shows real avatars
- [ ] TrendingCreatorCoins shows real price changes
- [ ] Creator profile page loads profile data
- [ ] Token chart shows real price history
- [ ] Events list shows creator's auctions

---

## ENVIRONMENT VARIABLES NEEDED

Add to `.env`:

```bash
# Twitter API (for creator profiles)
TWITTER_API_KEY=your_key
TWITTER_API_SECRET=your_secret
TWITTER_BEARER_TOKEN=your_bearer_token

# Blockchain RPC (already exists)
ETH_WSS_ENDPOINT=wss://sepolia.infura.io/ws/v3/your_key
ETH_HTTP_ENDPOINT=https://sepolia.infura.io/v3/your_key

# Cron job settings
PRICE_COLLECTION_INTERVAL=5 # minutes
ENABLE_TRADE_INDEXER=true
ENABLE_PRICE_COLLECTOR=true

# Cache settings
ENABLE_REDIS_CACHE=true
REDIS_URL=redis://localhost:6379
TRENDING_CACHE_TTL=300 # 5 minutes
```

---

## SUMMARY

### What Already Exists:
✅ `auctions` table with event/auction data
✅ Blockchain integration (ContractService)
✅ Database connection and pooling
✅ Authentication middleware

### What's Missing (CRITICAL):
❌ Creator profile data storage
❌ Token price history collection
❌ Trading volume tracking
❌ Trending creators API
❌ Token chart data API
❌ Cron services for data collection

### Next Steps for Backend Team:
1. Run migration 003 to create all tables
2. Implement 4 new services (Price Collector, Trade Indexer, etc.)
3. Create 2 new route files (creators.js, tokens.js)
4. Set up cron jobs in server.js
5. Test APIs with frontend
6. Deploy and monitor

**Estimated Effort:** 3-4 weeks for complete implementation

---

**Document Version:** 2.0 (Strict Analysis)
**Date:** December 10, 2025
**Based On:** Actual frontend code + existing backend schema
