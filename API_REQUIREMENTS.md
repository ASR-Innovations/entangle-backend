# Creator Platform - Backend API Requirements

**Version:** 1.0
**Date:** December 10, 2025
**Purpose:** Complete API specification for Creator Profile functionality

---

## Table of Contents
1. [Overview](#overview)
2. [Current Backend Structure](#current-backend-structure)
3. [New Routes Required](#new-routes-required)
4. [API Endpoint Specifications](#api-endpoint-specifications)
5. [Database Schema Requirements](#database-schema-requirements)
6. [WebSocket Events](#websocket-events)
7. [Integration Points](#integration-points)

---

## Overview

This document outlines all backend API requirements for the Creator Profile feature. The frontend requires 13 new API endpoints to fetch and manage creator-related data including profile statistics, token metrics, event management, and messaging functionality.

### Key Features:
- Creator profile statistics and metrics
- Token price history and real-time metrics
- Event/auction management for creators
- Telegram messaging with creators
- Trending creators ranking
- Real-time updates via WebSocket

---

## Current Backend Structure

### Existing Routes:
- `/api/auth` - Authentication endpoints
- `/api/auctions` - Auction management
- `/api/contract` - Smart contract interactions
- `/api/meetings` - Meeting/Jitsi management
- `/api/admin` - Admin operations
- `/api/orders` - Seaport order management

### Existing Services:
- **ContractService** - Blockchain interactions
- **JitsiService** - Video meeting management
- **LitService** - Encryption/decryption
- **AuctionCronService** - Auction monitoring
- **OrderSocketService** - Real-time order updates

### Database:
- PostgreSQL with connection pooling
- Schema defined in migrations

---

## New Routes Required

Add the following route files to `/src/routes/`:

1. **creators.js** - Creator profile and statistics endpoints
2. **tokens.js** - Token price and metrics endpoints
3. **events.js** - Creator events management
4. **telegram.js** - Telegram messaging endpoints

Register in `server.js`:
```javascript
app.use('/api/creators', require('./routes/creators'));
app.use('/api/tokens', require('./routes/tokens'));
app.use('/api/events', require('./routes/events'));
app.use('/api/telegram', require('./routes/telegram'));
```

---

## API Endpoint Specifications

### 1. Creator Profile Endpoints

#### 1.1 GET `/api/creators/:address/stats`
Get platform statistics for a creator.

**Route:** `GET /api/creators/:address/stats`
**Auth:** Optional (public data)
**Rate Limit:** 100 req/min

**Parameters:**
```javascript
// URL Parameters
address: string; // Creator's wallet address (0x...)
```

**Response:**
```json
{
  "success": true,
  "data": {
    "followers": 15234,
    "auctions": 12,
    "totalVolume": "45.2K",
    "totalVolumeUSD": 45234.56,
    "activeAuctions": 3,
    "completedAuctions": 9,
    "averageBid": "3.5",
    "highestBid": "12.8",
    "createdAt": "2024-01-15T10:00:00Z",
    "lastActive": "2025-12-10T08:30:00Z"
  }
}
```

**Database Query:**
```sql
-- Get auction statistics for creator
SELECT
  COUNT(*) as auctions,
  COUNT(*) FILTER (WHERE status = 'active') as activeAuctions,
  COUNT(*) FILTER (WHERE status = 'ended') as completedAuctions,
  COALESCE(SUM(winning_bid), 0) as totalVolume,
  COALESCE(AVG(winning_bid), 0) as averageBid,
  COALESCE(MAX(winning_bid), 0) as highestBid
FROM auctions
WHERE creator_wallet = $1;
```

**Validation:**
- `address` must be valid Ethereum address (0x + 40 hex chars)

**Error Responses:**
- `400` - Invalid address format
- `404` - Creator not found
- `500` - Internal server error

---

#### 1.2 GET `/api/creators/trending`
Get list of trending creators based on trading activity.

**Route:** `GET /api/creators/trending`
**Auth:** Optional
**Rate Limit:** 50 req/min

**Query Parameters:**
```javascript
limit?: number;  // Max results (default: 7, max: 50)
timeframe?: '24h' | '7d' | '30d';  // Trending timeframe (default: '24h')
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "0x1234...5678",
      "name": "John Creator",
      "symbol": "JOHN",
      "price": "$0.1234",
      "priceRaw": 0.1234,
      "change": 5.2,
      "changePercent": "+5.2%",
      "avatar": "https://...",
      "verified": true,
      "rank": 1,
      "tokenAddress": "0xabcd...efgh",
      "hasPool": true,
      "volume24h": "12.5K",
      "holders": 234,
      "marketCap": "123.4K"
    }
  ],
  "meta": {
    "total": 7,
    "timeframe": "24h",
    "lastUpdated": "2025-12-10T09:00:00Z"
  }
}
```

**Business Logic:**
1. Query creators with most trading volume in timeframe
2. Join with token price data
3. Calculate price change percentage
4. Order by volume DESC
5. Limit results

**Database Query:**
```sql
WITH trading_volume AS (
  SELECT
    creator_wallet,
    SUM(amount) as volume,
    COUNT(*) as trades
  FROM token_trades
  WHERE created_at >= NOW() - INTERVAL '24 hours'
  GROUP BY creator_wallet
)
SELECT
  c.wallet_address as id,
  c.display_name as name,
  t.symbol,
  t.current_price as price,
  t.price_change_24h as change,
  c.profile_image as avatar,
  c.verified,
  t.token_address,
  t.has_pool,
  tv.volume as volume24h,
  t.holders
FROM creators c
JOIN tokens t ON t.creator_wallet = c.wallet_address
JOIN trading_volume tv ON tv.creator_wallet = c.wallet_address
ORDER BY tv.volume DESC
LIMIT $1;
```

---

#### 1.3 GET `/api/creators/:address/token-info`
Get complete token information for a creator.

**Route:** `GET /api/creators/:address/token-info`
**Auth:** Optional
**Rate Limit:** 100 req/min

**Response:**
```json
{
  "success": true,
  "data": {
    "hasToken": true,
    "tokenAddress": "0xabcd...efgh",
    "name": "John Creator Token",
    "symbol": "JOHN",
    "totalSupply": "1000000",
    "circulatingSupply": "750000",
    "decimals": 18,
    "hasPool": true,
    "poolInfo": {
      "exists": true,
      "tokenReserve": "500000",
      "nativeReserve": "125.5",
      "currentPrice": 0.000251,
      "priceFormatted": "$0.000251",
      "liquidityUSD": "25100",
      "poolAddress": "0xpool...addr"
    }
  }
}
```

**Data Sources:**
1. Query database for token metadata
2. Query blockchain via ContractService for real-time pool data
3. Fallback to cached data if blockchain unavailable

---

#### 1.4 GET `/api/creators/:address/events`
Get events/auctions for a creator.

**Route:** `GET /api/creators/:address/events`
**Auth:** Optional
**Rate Limit:** 100 req/min

**Query Parameters:**
```javascript
status?: 'upcoming' | 'live' | 'ended';  // Filter by status
limit?: number;  // Max results (default: 10, max: 50)
offset?: number;  // Pagination offset
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "evt_123abc",
      "title": "1-on-1 Strategy Session",
      "description": "Personalized consultation",
      "date": "2025-12-12T10:00:00Z",
      "startTime": "2025-12-12T10:00:00Z",
      "endTime": "2025-12-12T11:00:00Z",
      "duration": 60,
      "highestBid": "0.5",
      "bidCount": 5,
      "status": "upcoming",
      "reservePrice": "0.1",
      "auctionEnded": false,
      "winner": null,
      "timeUntilStart": "1d 14h",
      "p2pListingPrice": null,
      "creatorWallet": "0x1234...5678",
      "transactionHash": "0xtx...hash"
    }
  ],
  "meta": {
    "total": 12,
    "hasMore": true,
    "nextOffset": 10
  }
}
```

**Database Query:**
```sql
SELECT
  auction_id as id,
  title,
  description,
  event_date as date,
  event_start_time as "startTime",
  event_end_time as "endTime",
  meeting_duration as duration,
  current_bid as "highestBid",
  bid_count as "bidCount",
  status,
  reserve_price as "reservePrice",
  winner_wallet as winner,
  transaction_hash as "transactionHash"
FROM auctions
WHERE creator_wallet = $1
  AND ($2::text IS NULL OR status = $2)
ORDER BY event_date ASC
LIMIT $3 OFFSET $4;
```

---

### 2. Token Price & Metrics Endpoints

#### 2.1 GET `/api/tokens/:tokenAddress/price-history`
Get historical price data for token charting.

**Route:** `GET /api/tokens/:tokenAddress/price-history`
**Auth:** Optional
**Rate Limit:** 50 req/min

**Query Parameters:**
```javascript
timeframe: '1H' | '24H' | '7D' | '30D';  // Required
interval?: '1m' | '5m' | '15m' | '1h' | '1d';  // Data point interval
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "timestamp": 1702387200000,
      "price": 0.1234,
      "volume": 1234.56,
      "high": 0.1250,
      "low": 0.1200,
      "open": 0.1210,
      "close": 0.1234
    }
  ],
  "meta": {
    "timeframe": "24H",
    "interval": "1h",
    "dataPoints": 24,
    "firstTimestamp": 1702300800000,
    "lastTimestamp": 1702387200000
  }
}
```

**Database Table Required:**
```sql
CREATE TABLE token_price_history (
  id SERIAL PRIMARY KEY,
  token_address VARCHAR(42) NOT NULL,
  timestamp BIGINT NOT NULL,
  price DECIMAL(36, 18) NOT NULL,
  volume DECIMAL(36, 18) NOT NULL,
  high DECIMAL(36, 18) NOT NULL,
  low DECIMAL(36, 18) NOT NULL,
  open DECIMAL(36, 18) NOT NULL,
  close DECIMAL(36, 18) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_token_timestamp (token_address, timestamp)
);
```

**Data Collection:**
- Set up cron job to collect price snapshots every 5 minutes
- Query pool reserves from blockchain
- Calculate price from reserves ratio
- Store in database

---

#### 2.2 GET `/api/tokens/:tokenAddress/metrics`
Get current token metrics and statistics.

**Route:** `GET /api/tokens/:tokenAddress/metrics`
**Auth:** Optional
**Rate Limit:** 100 req/min
**Cache:** 30 seconds

**Response:**
```json
{
  "success": true,
  "data": {
    "currentPrice": 0.1234,
    "priceChange24h": 0.0056,
    "priceChangePercent": "+4.76%",
    "volume24h": 12345.67,
    "volume24hChange": 23.4,
    "marketCap": 123456.78,
    "circulatingSupply": 1000000,
    "totalSupply": 1000000,
    "holders": 234,
    "holdersChange24h": 12,
    "high24h": 0.1300,
    "low24h": 0.1150,
    "transactions24h": 567,
    "liquidityUSD": 25000,
    "fullyDilutedValuation": 123456.78
  },
  "meta": {
    "lastUpdated": "2025-12-10T09:30:00Z",
    "cached": false
  }
}
```

**Business Logic:**
1. Get latest price from price_history table
2. Calculate 24h change from price 24h ago
3. Sum volume from last 24h of trades
4. Get holder count from token_holders table
5. Calculate market cap (price * circulating supply)
6. Get 24h high/low from price_history
7. Cache result for 30 seconds

---

#### 2.3 WebSocket `/api/tokens/:tokenAddress/live`
Real-time token price updates.

**Connection:** `ws://api.example.com/api/tokens/:tokenAddress/live`
**Auth:** Optional
**Protocol:** Socket.IO

**Client Subscribe:**
```javascript
socket.on('connect', () => {
  socket.emit('subscribe-token', { tokenAddress: '0x...' });
});
```

**Server Push Events:**
```javascript
// Price update event (every 15-30 seconds)
socket.emit('price-update', {
  tokenAddress: '0x...',
  timestamp: 1702387200000,
  price: 0.1234,
  volume: 1234.56,
  change24h: 4.76
});

// Trade event (real-time)
socket.emit('trade', {
  tokenAddress: '0x...',
  timestamp: 1702387200000,
  type: 'buy' | 'sell',
  amount: '100',
  price: 0.1234,
  txHash: '0x...'
});
```

**Implementation:**
- Extend existing Socket.IO setup in server.js
- Create TokenSocketService similar to OrderSocketService
- Listen to blockchain events for trades
- Emit updates to subscribed clients

---

### 3. Event Management Endpoints

#### 3.1 GET `/api/events/:eventId`
Get detailed event information.

**Route:** `GET /api/events/:eventId`
**Auth:** Optional
**Rate Limit:** 100 req/min

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "evt_123abc",
    "title": "1-on-1 Strategy Session",
    "description": "Personalized consultation for trading strategies",
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
    "creatorWallet": "0x1234...5678",
    "creatorName": "John Creator",
    "creatorAvatar": "https://...",
    "meetingLink": null,
    "p2pListingPrice": null,
    "transactionHash": "0xtx...hash",
    "blockchainData": {
      "auctionId": 123,
      "startBlock": 1000000,
      "endBlock": 1000100,
      "currentBlock": 1000050
    }
  }
}
```

**Database Query:**
```sql
SELECT
  a.*,
  c.display_name as creator_name,
  c.profile_image as creator_avatar
FROM auctions a
JOIN creators c ON c.wallet_address = a.creator_wallet
WHERE a.auction_id = $1;
```

---

#### 3.2 GET `/api/events/:eventId/bids`
Get bidding history for an event.

**Route:** `GET /api/events/:eventId/bids`
**Auth:** Optional
**Rate Limit:** 100 req/min

**Query Parameters:**
```javascript
limit?: number;  // Max results (default: 20, max: 100)
offset?: number;  // Pagination
```

**Response:**
```json
{
  "success": true,
  "data": {
    "eventId": "evt_123abc",
    "highestBid": "0.5",
    "bidCount": 5,
    "reservePrice": "0.1",
    "reserveMet": true,
    "bids": [
      {
        "bidId": "bid_789xyz",
        "bidder": "0xabcd...1234",
        "bidderName": "Alice",
        "bidderAvatar": "https://...",
        "amount": "0.5",
        "amountUSD": 50.23,
        "timestamp": "2025-12-10T08:30:00Z",
        "transactionHash": "0xtx...hash",
        "isWinning": true
      },
      {
        "bidId": "bid_456def",
        "bidder": "0xefgh...5678",
        "amount": "0.3",
        "timestamp": "2025-12-10T08:00:00Z",
        "isWinning": false
      }
    ]
  },
  "meta": {
    "total": 5,
    "hasMore": false
  }
}
```

**Database Table Required:**
```sql
CREATE TABLE bids (
  bid_id SERIAL PRIMARY KEY,
  auction_id INTEGER REFERENCES auctions(auction_id),
  bidder_wallet VARCHAR(42) NOT NULL,
  amount DECIMAL(36, 18) NOT NULL,
  transaction_hash VARCHAR(66) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_auction (auction_id),
  INDEX idx_bidder (bidder_wallet)
);
```

---

### 4. Telegram Messaging Endpoints

#### 4.1 GET `/api/telegram/response-options`
Get available messaging options and pricing.

**Route:** `GET /api/telegram/response-options`
**Auth:** Optional
**Rate Limit:** 100 req/min
**Cache:** 5 minutes

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "type": "quick",
      "title": "Quick Response",
      "description": "Get a reply within 1 hour",
      "responseTime": "Within 1 hour",
      "price": 25,
      "priceUSD": 25.00,
      "popular": true
    },
    {
      "type": "slow",
      "title": "Standard Response",
      "description": "Get a reply within 24 hours",
      "responseTime": "Within 24 hours",
      "price": 10,
      "priceUSD": 10.00,
      "popular": false
    }
  ]
}
```

**Configuration:**
- Store pricing in database config table or environment variables
- Allow dynamic updates without code changes

---

#### 4.2 GET `/api/creators/:address/telegram/stats`
Get creator's Telegram response statistics.

**Route:** `GET /api/creators/:address/telegram/stats`
**Auth:** Optional
**Rate Limit:** 100 req/min

**Response:**
```json
{
  "success": true,
  "data": {
    "responseRate": 98,
    "avgResponseTime": "45 min",
    "avgResponseTimeMinutes": 45,
    "totalMessages": 234,
    "repliedMessages": 229,
    "activeConversations": 5,
    "lastResponseTime": "2025-12-10T08:30:00Z"
  }
}
```

**Business Logic:**
```sql
WITH response_stats AS (
  SELECT
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE response_time IS NOT NULL) as replied,
    AVG(EXTRACT(EPOCH FROM (response_time - created_at))/60) as avg_minutes
  FROM telegram_messages
  WHERE creator_wallet = $1
)
SELECT
  ROUND((replied::decimal / total * 100), 0) as response_rate,
  ROUND(avg_minutes, 0) as avg_response_minutes,
  total as total_messages,
  replied as replied_messages
FROM response_stats;
```

---

#### 4.3 POST `/api/telegram/messages`
Send a message to a creator.

**Route:** `POST /api/telegram/messages`
**Auth:** Required (authenticateToken)
**Rate Limit:** 10 req/min per user

**Request Body:**
```json
{
  "creatorAddress": "0x1234...5678",
  "message": "Hello, I'd like to discuss...",
  "responseType": "quick"
}
```

**Validation:**
```javascript
const sendMessageSchema = Joi.object({
  creatorAddress: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  message: Joi.string().min(15).max(200).required(),
  responseType: Joi.string().valid('quick', 'slow').required()
});
```

**Response:**
```json
{
  "success": true,
  "data": {
    "messageId": "msg_abc123",
    "status": "pending",
    "price": 25,
    "priceUSD": 25.00,
    "estimatedResponseTime": "Within 1 hour",
    "createdAt": "2025-12-10T09:00:00Z",
    "expiresAt": "2025-12-10T10:00:00Z"
  }
}
```

**Business Logic:**
1. Validate request and authentication
2. Check message length (15-200 chars)
3. Get pricing for response type
4. Create database record
5. Trigger Telegram notification to creator
6. Return message ID for status tracking

**Database Table:**
```sql
CREATE TABLE telegram_messages (
  message_id VARCHAR(50) PRIMARY KEY,
  sender_wallet VARCHAR(42) NOT NULL,
  creator_wallet VARCHAR(42) NOT NULL,
  message TEXT NOT NULL,
  response_type VARCHAR(20) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  response TEXT,
  response_time TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  INDEX idx_creator (creator_wallet),
  INDEX idx_sender (sender_wallet),
  INDEX idx_status (status)
);
```

---

#### 4.4 GET `/api/telegram/messages/:messageId`
Get message status and reply.

**Route:** `GET /api/telegram/messages/:messageId`
**Auth:** Required (must be sender or creator)
**Rate Limit:** 100 req/min

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "msg_abc123",
    "status": "replied",
    "message": "Hello, I'd like to discuss...",
    "response": "Thanks for reaching out! Let's schedule...",
    "responseTimestamp": "2025-12-10T09:30:00Z",
    "responseTime": "30 min",
    "creatorWallet": "0x1234...5678",
    "senderWallet": "0xabcd...efgh",
    "createdAt": "2025-12-10T09:00:00Z",
    "price": 25
  }
}
```

**Authorization Check:**
```javascript
// Verify requester is either sender or creator
if (req.user.walletAddress !== message.sender_wallet &&
    req.user.walletAddress !== message.creator_wallet) {
  return res.status(403).json({ error: 'Unauthorized' });
}
```

---

## Database Schema Requirements

### New Tables Needed:

#### 1. creators
```sql
CREATE TABLE creators (
  wallet_address VARCHAR(42) PRIMARY KEY,
  display_name VARCHAR(255),
  twitter_id VARCHAR(255),
  twitter_handle VARCHAR(255),
  profile_image TEXT,
  bio TEXT,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_creators_twitter ON creators(twitter_id);
CREATE INDEX idx_creators_verified ON creators(verified);
```

#### 2. tokens
```sql
CREATE TABLE tokens (
  token_address VARCHAR(42) PRIMARY KEY,
  creator_wallet VARCHAR(42) REFERENCES creators(wallet_address),
  name VARCHAR(255) NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  decimals INTEGER DEFAULT 18,
  total_supply DECIMAL(36, 18),
  circulating_supply DECIMAL(36, 18),
  current_price DECIMAL(36, 18),
  price_change_24h DECIMAL(10, 4),
  volume_24h DECIMAL(36, 18),
  market_cap DECIMAL(36, 18),
  holders INTEGER DEFAULT 0,
  has_pool BOOLEAN DEFAULT false,
  pool_address VARCHAR(42),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tokens_creator ON tokens(creator_wallet);
CREATE INDEX idx_tokens_price ON tokens(current_price);
```

#### 3. token_price_history
```sql
CREATE TABLE token_price_history (
  id SERIAL PRIMARY KEY,
  token_address VARCHAR(42) REFERENCES tokens(token_address),
  timestamp BIGINT NOT NULL,
  price DECIMAL(36, 18) NOT NULL,
  volume DECIMAL(36, 18) NOT NULL,
  high DECIMAL(36, 18) NOT NULL,
  low DECIMAL(36, 18) NOT NULL,
  open DECIMAL(36, 18) NOT NULL,
  close DECIMAL(36, 18) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_price_history_token_time ON token_price_history(token_address, timestamp DESC);
```

#### 4. token_trades
```sql
CREATE TABLE token_trades (
  trade_id SERIAL PRIMARY KEY,
  token_address VARCHAR(42) REFERENCES tokens(token_address),
  trader_wallet VARCHAR(42) NOT NULL,
  trade_type VARCHAR(10) NOT NULL, -- 'buy' or 'sell'
  amount_token DECIMAL(36, 18) NOT NULL,
  amount_native DECIMAL(36, 18) NOT NULL,
  price DECIMAL(36, 18) NOT NULL,
  transaction_hash VARCHAR(66) NOT NULL UNIQUE,
  block_number BIGINT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_trades_token ON token_trades(token_address, created_at DESC);
CREATE INDEX idx_trades_trader ON token_trades(trader_wallet);
CREATE INDEX idx_trades_tx ON token_trades(transaction_hash);
```

#### 5. token_holders
```sql
CREATE TABLE token_holders (
  id SERIAL PRIMARY KEY,
  token_address VARCHAR(42) REFERENCES tokens(token_address),
  holder_wallet VARCHAR(42) NOT NULL,
  balance DECIMAL(36, 18) NOT NULL,
  first_acquired TIMESTAMP DEFAULT NOW(),
  last_updated TIMESTAMP DEFAULT NOW(),
  UNIQUE(token_address, holder_wallet)
);

CREATE INDEX idx_holders_token ON token_holders(token_address);
CREATE INDEX idx_holders_wallet ON token_holders(holder_wallet);
```

#### 6. telegram_messages
```sql
CREATE TABLE telegram_messages (
  message_id VARCHAR(50) PRIMARY KEY,
  sender_wallet VARCHAR(42) NOT NULL,
  creator_wallet VARCHAR(42) REFERENCES creators(wallet_address),
  message TEXT NOT NULL,
  response_type VARCHAR(20) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  response TEXT,
  response_time TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  CHECK (char_length(message) >= 15 AND char_length(message) <= 200)
);

CREATE INDEX idx_telegram_creator ON telegram_messages(creator_wallet, status);
CREATE INDEX idx_telegram_sender ON telegram_messages(sender_wallet);
CREATE INDEX idx_telegram_status ON telegram_messages(status, created_at);
```

#### 7. bids (extend existing or create new)
```sql
CREATE TABLE bids (
  bid_id SERIAL PRIMARY KEY,
  auction_id INTEGER REFERENCES auctions(auction_id),
  bidder_wallet VARCHAR(42) NOT NULL,
  amount DECIMAL(36, 18) NOT NULL,
  transaction_hash VARCHAR(66) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bids_auction ON bids(auction_id, amount DESC);
CREATE INDEX idx_bids_bidder ON bids(bidder_wallet);
```

---

## WebSocket Events

### Socket.IO Namespaces:

#### 1. Token Price Updates
```javascript
// Client subscribes to token
socket.emit('subscribe-token', { tokenAddress: '0x...' });

// Server emits price updates
socket.emit('price-update', {
  tokenAddress: '0x...',
  price: 0.1234,
  change24h: 4.76,
  volume24h: 12345.67,
  timestamp: 1702387200000
});

// Client unsubscribes
socket.emit('unsubscribe-token', { tokenAddress: '0x...' });
```

#### 2. Auction/Event Updates
```javascript
// Subscribe to event
socket.emit('join-event', { eventId: 'evt_123' });

// New bid notification
socket.emit('new-bid', {
  eventId: 'evt_123',
  bidder: '0x...',
  amount: '0.5',
  timestamp: 1702387200000
});

// Auction ended
socket.emit('auction-ended', {
  eventId: 'evt_123',
  winner: '0x...',
  winningBid: '1.5'
});
```

#### 3. Telegram Message Updates
```javascript
// Subscribe to messages (authenticated)
socket.emit('subscribe-messages', { walletAddress: '0x...' });

// New message received
socket.emit('new-message', {
  messageId: 'msg_abc',
  from: '0x...',
  preview: 'Hello, I would like...'
});

// Message replied
socket.emit('message-replied', {
  messageId: 'msg_abc',
  responseTime: '30 min'
});
```

---

## Integration Points

### 1. ContractService Integration
Extend existing ContractService to support:
- Token pool queries (reserves, price)
- Token holder queries
- Trade event listening
- Token metadata reading

```javascript
// Example methods to add
class ContractService {
  async getTokenInfo(tokenAddress) { }
  async getPoolReserves(poolAddress) { }
  async getTokenHolders(tokenAddress) { }
  async listenToTradeEvents(tokenAddress, callback) { }
}
```

### 2. Cron Services Needed

#### TokenPriceCronService
```javascript
// Collect price snapshots every 5 minutes
class TokenPriceCronService {
  async collectPriceSnapshot() {
    // For each active token:
    // 1. Query pool reserves from blockchain
    // 2. Calculate price
    // 3. Store in token_price_history
  }

  start() {
    // Run every 5 minutes
    cron.schedule('*/5 * * * *', this.collectPriceSnapshot);
  }
}
```

#### TrendingCreatorsCronService
```javascript
// Update trending creators ranking every 15 minutes
class TrendingCreatorsCronService {
  async updateTrendingRankings() {
    // 1. Calculate 24h trading volumes
    // 2. Rank creators
    // 3. Cache results
  }

  start() {
    cron.schedule('*/15 * * * *', this.updateTrendingRankings);
  }
}
```

### 3. External Service Integration

#### Telegram Bot Service
```javascript
// New service for Telegram notifications
class TelegramBotService {
  async notifyCreator(creatorWallet, message) {
    // Send Telegram notification to creator
  }

  async sendResponse(messageId, response) {
    // Send response back to sender
  }
}
```

### 4. Cache Strategy
Implement Redis caching for:
- Token metrics (30 second TTL)
- Trending creators (5 minute TTL)
- Response options (5 minute TTL)
- Creator stats (1 minute TTL)

---

## Error Handling Standards

All endpoints should follow consistent error response format:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid token address format",
    "details": {
      "field": "tokenAddress",
      "received": "0xinvalid"
    }
  }
}
```

### Error Codes:
- `VALIDATION_ERROR` - Invalid input
- `NOT_FOUND` - Resource not found
- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - Insufficient permissions
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `BLOCKCHAIN_ERROR` - Blockchain query failed
- `DATABASE_ERROR` - Database operation failed
- `INTERNAL_ERROR` - Generic server error

---

## Rate Limiting

Implement per-endpoint rate limits:

```javascript
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // requests per window
  message: { error: 'Too many requests, please try again later' }
});

// Apply to routes
router.get('/creators/:address/stats', apiLimiter, handler);
```

**Limits by endpoint type:**
- Public read endpoints: 100 req/min
- Price/chart data: 50 req/min
- Write operations: 10 req/min
- Authenticated endpoints: 200 req/min

---

## Testing Requirements

### Unit Tests
- Test all validation schemas
- Test business logic functions
- Test database queries
- Test error handling

### Integration Tests
- Test complete API flows
- Test database transactions
- Test blockchain integration
- Test WebSocket events

### Load Tests
- Simulate 1000 concurrent users
- Test rate limiting effectiveness
- Test database connection pooling
- Test cache hit rates

---

## Deployment Checklist

- [ ] Create all database tables and indexes
- [ ] Set up environment variables
- [ ] Configure rate limiting
- [ ] Set up Redis for caching
- [ ] Deploy cron services
- [ ] Configure WebSocket server
- [ ] Set up monitoring and logging
- [ ] Test all endpoints
- [ ] Load test critical paths
- [ ] Update API documentation
- [ ] Set up error tracking (Sentry)
- [ ] Configure database backups

---

## Priority Implementation Order

### Phase 1 (Critical - Week 1):
1. `/api/creators/:address/stats` - Creator statistics
2. `/api/creators/trending` - Trending creators list
3. `/api/tokens/:tokenAddress/metrics` - Token metrics
4. Database schema setup
5. TokenPriceCronService

### Phase 2 (High Priority - Week 2):
6. `/api/tokens/:tokenAddress/price-history` - Price charts
7. `/api/creators/:address/events` - Event listing
8. `/api/events/:eventId` - Event details
9. `/api/events/:eventId/bids` - Bid history
10. WebSocket token price updates

### Phase 3 (Medium Priority - Week 3):
11. `/api/telegram/response-options` - Messaging options
12. `/api/creators/:address/telegram/stats` - Response stats
13. `/api/telegram/messages` - Send messages
14. `/api/telegram/messages/:messageId` - Message status
15. TelegramBotService integration

### Phase 4 (Polish - Week 4):
- Performance optimization
- Caching implementation
- Load testing
- Documentation updates
- Monitoring setup

---

## Support & Questions

For questions about this specification:
- Technical questions: Contact backend team lead
- Business logic questions: Contact product manager
- Blockchain integration: Contact smart contract team

**Document Version:** 1.0
**Last Updated:** December 10, 2025
**Next Review:** January 10, 2026
