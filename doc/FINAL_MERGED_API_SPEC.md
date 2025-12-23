# Final Merged API Specification - Creator Platform

> **This specification combines your previous API design with the new enhanced design, ensuring backward compatibility while adding powerful new features.**

---

## 🎯 Core Principles

1. ✅ **Backward Compatible** - All existing endpoints continue to work
2. ✅ **Flexible Identifiers** - Support both wallet addresses AND usernames
3. ✅ **Standardized Responses** - Consistent `data` + `meta` structure
4. ✅ **Enhanced Features** - New capabilities without breaking changes

---

## 📡 API Endpoints

### Base URL
```
Production: https://your-backend-url.com/api
Development: http://localhost:5000/api
```

### Authentication
```http
Authorization: Bearer <jwt_token>
```

---

## 1️⃣ Trending Creators

### Endpoint
```http
GET /api/creators/trending
```

### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | 10 | Max creators to return (1-50) |
| `offset` | integer | 0 | Pagination offset |
| `timeframe` | string | '24h' | '24h', '7d', '30d' |

### Response
```json
{
  "success": true,
  "data": [
    {
      // Identifiers (supports both)
      "id": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb7",
      "walletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb7",
      "username": "elonmusk",
      "twitterHandle": "elonmusk",
      "twitterId": "1234567890",

      // Profile
      "displayName": "Elon Musk",
      "profileImage": "https://pbs.twimg.com/profile_images/...",
      "avatar": "https://pbs.twimg.com/profile_images/...", // alias
      "verified": true,
      "badges": ["top_creator", "trending", "verified"],

      // Token
      "token": {
        "symbol": "ELON",
        "address": "0xtoken...",
        "tokenAddress": "0xtoken...", // alias
        "price": "$0.0543",
        "priceRaw": 0.0543,
        "change": 8.2,
        "changePercent": "+8.2%",
        "hasPool": true,
        "volume24h": 125000.00
      },

      // Stats
      "stats": {
        "followers": 15420,
        "marketCap": "1500000.50",
        "tokenHolders": 1250,
        "rank": 1
      }
    }
  ],
  "meta": {
    "total": 50,
    "limit": 10,
    "offset": 0,
    "timeframe": "24h",
    "lastUpdated": "2025-12-17T10:00:00Z"
  }
}
```

### Example Request
```bash
curl -X GET "https://api.yourapp.com/api/creators/trending?limit=10&timeframe=24h"
```

---

## 2️⃣ Creator Profile

### Endpoint (Flexible Identifier)
```http
GET /api/creators/:identifier/profile
```

**Identifier can be:**
- Wallet address: `0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb7`
- Twitter username: `elonmusk`

### Alternative Endpoints (Backward Compatible)
```http
GET /api/creators/:address/profile  # Previous design
GET /api/creators/:username          # New design
```

### Response
```json
{
  "success": true,
  "data": {
    // Identifiers
    "id": 1,
    "walletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb7",
    "username": "elonmusk",
    "twitterHandle": "elonmusk",
    "twitterId": "1234567890",

    // Profile Information
    "displayName": "Elon Musk",
    "profileImageUrl": "https://pbs.twimg.com/profile_images/...",
    "profileImage": "https://pbs.twimg.com/profile_images/...", // alias
    "coverImage": "https://cover-image-url.jpg",
    "bio": "Technoking of Tesla, Imperator of Mars",
    "verified": true,
    "badges": ["top_creator", "trending", "verified"],

    // Social Links
    "socialLinks": {
      "twitter": "https://twitter.com/elonmusk",
      "website": "https://tesla.com",
      "telegram": "https://t.me/elonmusk",
      "discord": null
    },

    // Comprehensive Stats
    "stats": {
      // Social Stats
      "followers": 15420,
      "followersCount": 15420, // alias
      "twitterFollowers": 150000000,
      "posts": 5234,

      // Token Stats
      "tokenHolders": 1250,
      "marketCap": "1500000.50",

      // Auction/Event Stats
      "auctions": 12,
      "activeAuctions": 3,
      "completedAuctions": 9,

      // Growth Metrics
      "followersGrowth": "+12.5%",
      "marketCapGrowth": "+15.3%"
    },

    // Token Information
    "token": {
      "address": "0x1234...",
      "symbol": "ELON",
      "name": "Elon Token",
      "price": "0.0543",
      "priceChange24h": "+8.2%",
      "volume24h": "125000.00",
      "marketCap": "1500000.50",
      "hasPool": true
    },

    // Timestamps
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-12-17T10:00:00Z"
  }
}
```

### Example Requests
```bash
# Using wallet address
curl -X GET "https://api.yourapp.com/api/creators/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb7/profile"

# Using username
curl -X GET "https://api.yourapp.com/api/creators/elonmusk/profile"
```

---

## 3️⃣ Token Information & Chart Data

### 3.1 Current Token Data

#### Endpoint
```http
GET /api/creators/:identifier/token
```

#### Alternative (Backward Compatible)
```http
GET /api/tokens/:address/info
```

#### Response
```json
{
  "success": true,
  "data": {
    // Token Details
    "address": "0x1234...",
    "symbol": "ELON",
    "name": "Elon Token",
    "decimals": 18,

    // Supply
    "totalSupply": "1000000000",
    "circulatingSupply": "750000000",
    "maxSupply": "1000000000",

    // Current Price & Stats
    "currentPrice": 0.0543,
    "price": 0.0543, // alias
    "priceChange24h": 0.0056,
    "priceChangePercent": "+4.76%",

    // Volume & Market
    "volume24h": 125000.00,
    "marketCap": 40725000.00,
    "totalLiquidity": "500000.00",

    // 24h High/Low
    "high24h": 0.0620,
    "low24h": 0.0489,

    // Holders
    "holders": 1250,

    // Pool Status
    "hasPool": true,
    "liquidityPool": "0x5678...",

    // Trading Stats
    "totalTransactions": 5420,
    "uniqueTraders": 856,
    "buyCount24h": 198,
    "sellCount24h": 144
  }
}
```

### 3.2 Price History (Chart Data)

#### Endpoint
```http
GET /api/creators/:identifier/token/price-history
```

#### Alternative (Backward Compatible)
```http
GET /api/tokens/:address/chart-data
```

#### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `interval` | string | '1h' | '1m', '5m', '15m', '1h', '4h', '1d', '7d' |
| `limit` | integer | 100 | Max data points (1-1000) |
| `from` | integer | null | Unix timestamp start |
| `to` | integer | null | Unix timestamp end |

#### Response
```json
{
  "success": true,
  "data": {
    // Current Summary (for convenience)
    "currentPrice": 0.0543,
    "priceChange24h": 0.0056,
    "priceChangePercent": "+4.76%",
    "volume24h": 125000.00,
    "high24h": 0.0620,
    "low24h": 0.0489,
    "holders": 1250,
    "marketCap": 40725000.00,

    // Historical Data (OHLCV format)
    "priceHistory": [
      {
        "timestamp": 1702828800,
        "timestampMs": 1702828800000,
        "open": 0.0540,
        "high": 0.0545,
        "low": 0.0538,
        "close": 0.0543,
        "price": 0.0543, // alias for close
        "volume": 5250.00,
        "priceChange": 0.0003,
        "priceChangePercent": 0.56
      }
      // ... more data points
    ]
  },
  "meta": {
    "interval": "1h",
    "timeframe": "24H",
    "dataPoints": 24,
    "from": 1702742400,
    "to": 1702828800
  }
}
```

### Example Request
```bash
curl -X GET "https://api.yourapp.com/api/creators/elonmusk/token/price-history?interval=1h&limit=24"
```

---

## 4️⃣ Token Holders

### Endpoint
```http
GET /api/creators/:identifier/token/holders
```

### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | 10 | Max holders (1-100) |
| `offset` | integer | 0 | Pagination offset |

### Response
```json
{
  "success": true,
  "data": [
    {
      "rank": 1,
      "address": "0xabcd...",
      "balance": "50000000",
      "balanceFormatted": "50.00M",
      "percentage": 5.00,
      "percentageFormatted": "5.00%",
      "firstAcquired": "2024-01-01T00:00:00Z",
      "lastTransaction": "2024-12-17T10:00:00Z",
      "totalTransactions": 25,
      "isWhale": true
    }
  ],
  "meta": {
    "totalHolders": 1250,
    "limit": 10,
    "offset": 0
  }
}
```

---

## 5️⃣ Recent Transactions

### Endpoint
```http
GET /api/creators/:identifier/token/transactions
```

### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `type` | string | 'all' | 'all', 'buy', 'sell', 'transfer' |
| `limit` | integer | 20 | Max transactions (1-100) |
| `offset` | integer | 0 | Pagination offset |

### Response
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "txHash": "0x1234...",
      "transactionHash": "0x1234...", // alias
      "type": "buy",
      "trader": "0xabcd...",
      "traderAddress": "0xabcd...", // alias
      "tokenAmount": "1000.00",
      "paymentAmount": "54.30",
      "paymentToken": "USDC",
      "pricePerToken": "0.0543",
      "usdValue": "54.30",
      "gasUsed": "125000",
      "gasPrice": "25.5",
      "timestamp": "2024-12-17T10:00:00Z",
      "timeAgo": "2h ago",
      "dex": "uniswap",
      "dexName": "Uniswap V3",
      "blockNumber": 12345678
    }
  ],
  "meta": {
    "total": 5420,
    "limit": 20,
    "offset": 0,
    "type": "all"
  }
}
```

---

## 6️⃣ Events / Upcoming Calls

### Endpoint
```http
GET /api/creators/:identifier/events
```

### Alternative (Backward Compatible)
```http
GET /api/creators/:address/upcomingcalls
```

### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | 'upcoming' | 'upcoming', 'past', 'live', 'all' |
| `limit` | integer | 10 | Max events (1-50) |
| `offset` | integer | 0 | Pagination offset |

### Response
```json
{
  "success": true,
  "data": [
    {
      // Event ID
      "id": 123,
      "auctionId": 123,

      // Event Details
      "title": "1-on-1 Strategy Session",
      "description": "Personalized consultation about crypto trading",
      "date": "2025-12-12",
      "eventDate": "2025-12-12T10:00:00Z",
      "startTime": "2025-12-12T10:00:00Z",
      "endTime": "2025-12-12T11:00:00Z",
      "duration": 60,

      // Status
      "status": "upcoming",
      "auctionEnded": false,
      "isLive": true,
      "canBid": true,

      // Pricing & Bids
      "reservePrice": "0.1",
      "highestBid": "0.5",
      "bidCount": 5,
      "winner": null,
      "winnerAddress": null,

      // P2P Option
      "p2pListingPrice": "1.0",
      "p2pAvailable": true,

      // Time Calculations
      "timeUntilStart": "1d 14h",
      "timeUntilStartSeconds": 138240,
      "timeRemaining": "2d 6h",
      "timeRemainingSeconds": 194400,
      "blocksRemaining": 120,

      // Meeting Details
      "meetingDuration": 60,
      "jitsiRoomId": "room_123",
      "nftTokenId": 456,

      // Metadata
      "createdAt": "2024-12-01T00:00:00Z",
      "updatedAt": "2024-12-17T10:00:00Z"
    }
  ],
  "meta": {
    "total": 15,
    "limit": 10,
    "offset": 0,
    "status": "upcoming"
  }
}
```

---

## 7️⃣ Telegram Access

### 7.1 Get Telegram Room Info

#### Endpoint
```http
GET /api/creators/:identifier/telegram
```

#### Response
```json
{
  "success": true,
  "data": {
    "id": 1,
    "roomId": "telegram_room_123",
    "roomName": "Elon's Inner Circle",
    "pricePerMinute": 1.00,
    "currency": "USDC",
    "activeMembers": 42,
    "totalMembers": 156,
    "totalMessages": 2450,
    "isActive": true,
    "recentActivity": [
      {
        "message": "Discussed upcoming product launch strategies...",
        "timestamp": "2m ago"
      },
      {
        "message": "Shared exclusive market insights...",
        "timestamp": "15m ago"
      }
    ]
  }
}
```

### 7.2 Purchase Telegram Access

#### Endpoint
```http
POST /api/creators/:identifier/telegram/purchase
```

#### Request Body
```json
{
  "durationMinutes": 30,
  "paymentToken": "USDC",
  "transactionHash": "0x1234..."
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "purchaseId": 1,
    "inviteLink": "https://t.me/+abc123...",
    "accessGrantedAt": "2024-12-17T10:00:00Z",
    "accessExpiresAt": "2024-12-17T10:30:00Z",
    "durationMinutes": 30,
    "pricePaid": "30.00",
    "currency": "USDC",
    "status": "active"
  }
}
```

---

## 8️⃣ Social Features

### 8.1 Follow/Unfollow Creator

#### Endpoint
```http
POST /api/creators/:identifier/follow
```

#### Request Body
```json
{
  "action": "follow",  // or "unfollow"
  "enableNotifications": true
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "following": true,
    "notificationsEnabled": true,
    "followerCount": 15421
  }
}
```

### 8.2 Get Creator Stats

#### Endpoint
```http
GET /api/creators/:identifier/stats
```

#### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `period` | string | '7d' | '24h', '7d', '30d', 'all' |

#### Response
```json
{
  "success": true,
  "data": {
    "period": "7d",
    "followers": {
      "current": 15420,
      "change": "+850",
      "changePercent": "+5.8%"
    },
    "tokenMetrics": {
      "price": "0.0543",
      "priceChange": "+12.5%",
      "volume": "125000.00",
      "volumeChange": "+23.4%",
      "holders": 1250,
      "holdersChange": "+82",
      "marketCap": "40725000.00",
      "marketCapChange": "+15.3%"
    },
    "trading": {
      "totalTransactions": 342,
      "uniqueTraders": 156,
      "buyCount": 198,
      "sellCount": 144,
      "buyVolume": "75000.00",
      "sellVolume": "50000.00"
    },
    "events": {
      "totalEvents": 5,
      "upcomingEvents": 3,
      "completedEvents": 2,
      "totalBids": 45
    }
  }
}
```

---

## 9️⃣ Swap Quote

### Endpoint
```http
GET /api/creators/:identifier/token/quote
```

### Query Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `amount` | number | Yes | Amount of input token |
| `type` | string | Yes | 'buy' or 'sell' |

### Response
```json
{
  "success": true,
  "data": {
    "inputAmount": "1.0",
    "outputAmount": "18.416",
    "inputToken": "AVAX",
    "outputToken": "ELON",
    "pricePerToken": "0.0543",
    "priceImpact": "0.25",
    "minimumReceived": "18.370",
    "slippage": "0.5",
    "fee": "0.003",
    "feeAmount": "0.003",
    "route": ["AVAX", "USDC", "ELON"],
    "dex": "uniswap"
  }
}
```

---

## 🔐 Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional context"
  }
}
```

### Common Error Codes
- `CREATOR_NOT_FOUND` - 404
- `INVALID_IDENTIFIER` - 400
- `UNAUTHORIZED` - 401
- `FORBIDDEN` - 403
- `RATE_LIMIT_EXCEEDED` - 429
- `INTERNAL_ERROR` - 500

---

## 📊 Summary of Endpoint Support

| Endpoint | Identifier Type | Backward Compatible | Notes |
|----------|----------------|---------------------|-------|
| `/api/creators/trending` | N/A | ✅ Yes | Enhanced response |
| `/api/creators/:id/profile` | Both | ✅ Yes | Supports wallet & username |
| `/api/creators/:id/token` | Both | ✅ Yes | NEW endpoint |
| `/api/tokens/:address/chart-data` | Wallet | ✅ Yes | Original endpoint |
| `/api/creators/:id/token/price-history` | Both | ➕ New | Enhanced version |
| `/api/creators/:id/events` | Both | ✅ Yes | Replaces `/upcomingcalls` |
| `/api/creators/:id/token/holders` | Both | ➕ New | - |
| `/api/creators/:id/token/transactions` | Both | ➕ New | - |
| `/api/creators/:id/telegram` | Both | ➕ New | - |
| `/api/creators/:id/follow` | Both | ➕ New | - |
| `/api/creators/:id/stats` | Both | ➕ New | - |

---

## ✅ Implementation Checklist

- [ ] Update database schema with merged design
- [ ] Implement flexible identifier resolution (wallet OR username)
- [ ] Add backward-compatible aliases for field names
- [ ] Implement new endpoints (holders, transactions, etc.)
- [ ] Add P2P listing price to events
- [ ] Add time calculation utilities
- [ ] Implement caching layer
- [ ] Add rate limiting
- [ ] Update frontend to use new endpoints
- [ ] Write comprehensive tests
- [ ] Document migration path
- [ ] Deploy to staging
- [ ] Monitor and optimize

---

This merged specification provides the **best of both worlds** - maintaining backward compatibility while adding powerful new features! 🚀
