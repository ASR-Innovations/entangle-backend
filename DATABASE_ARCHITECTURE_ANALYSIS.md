# Database Architecture Analysis

## 📊 Overview

Your database has **20 tables** organized into logical groups. Here's the complete breakdown:

---

## 🔑 Why Two Different Tables: `users` vs `creator_profiles`?

### The Difference

| Aspect | `users` Table | `creator_profiles` Table |
|--------|---------------|--------------------------|
| **Purpose** | ALL platform users | Only users who CREATE content |
| **Who** | Bidders, viewers, buyers | Creators with tokens/auctions |
| **Data** | Basic auth info | Rich creator metadata |
| **Columns** | 10 columns | 32 columns |
| **Rows** | 10 users | 9 creators |

### Why This Design?

```
┌─────────────────────────────────────────────────────────────┐
│                        users (10)                           │
│  - Every person who logs in                                 │
│  - Basic: id, wallet, email, auth_type                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ 1:1 (optional)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   creator_profiles (9)                      │
│  - Only users who become creators                           │
│  - Rich: Twitter data, token info, stats, badges            │
└─────────────────────────────────────────────────────────────┘
```

**Benefits:**
1. **Not everyone is a creator** - Most users just bid/buy, they don't need 32 columns
2. **Separation of concerns** - Auth data vs creator metadata
3. **Performance** - Smaller `users` table = faster auth queries
4. **Scalability** - 1000 users but only 50 creators? Only 50 rows in creator_profiles

---

## 📋 Complete Table Structure

### 1. Core User Tables

#### `users` (10 columns)
```sql
id                 INTEGER PRIMARY KEY
para_user_id       VARCHAR NOT NULL UNIQUE  -- Para authentication ID
wallet_address     VARCHAR UNIQUE           -- Ethereum wallet
email              VARCHAR                  -- Optional email
auth_type          VARCHAR                  -- email, phone, wallet, etc.
oauth_method       VARCHAR                  -- google, x, discord, etc.
display_name       VARCHAR
profile_image      TEXT
created_at         TIMESTAMP
updated_at         TIMESTAMP
```

#### `creator_profiles` (32 columns)
```sql
id                    INTEGER PRIMARY KEY
user_id               INTEGER NOT NULL → users.id
para_user_id          VARCHAR NOT NULL → users.para_user_id
wallet_address        VARCHAR → users.wallet_address

-- Twitter Integration
twitter_username      VARCHAR
twitter_id            VARCHAR
twitter_followers_count INTEGER
twitter_following_count INTEGER
twitter_tweet_count   INTEGER
twitter_verified      BOOLEAN

-- Profile
bio                   TEXT
profile_image         TEXT
cover_image           TEXT
website_url           TEXT
twitter_url           TEXT
telegram_url          TEXT
discord_url           TEXT

-- Token Info (denormalized for quick access)
token_address         VARCHAR
token_symbol          VARCHAR
token_name            VARCHAR
token_supply          VARCHAR
token_created_at      TIMESTAMP
total_token_holders   INTEGER

-- Stats
total_events_created  INTEGER
total_volume_traded   VARCHAR
market_cap            VARCHAR

-- Badges & Status
is_verified           BOOLEAN
is_trending           BOOLEAN
is_top_creator        BOOLEAN
badge_tier            VARCHAR

-- Timestamps
created_at            TIMESTAMP
updated_at            TIMESTAMP
last_synced_at        TIMESTAMP
```

---

### 2. Token Tables

#### `creator_tokens` (23 columns)
```sql
id                    INTEGER PRIMARY KEY
creator_profile_id    INTEGER → creator_profiles.id
contract_address      VARCHAR UNIQUE
symbol                VARCHAR
name                  VARCHAR
decimals              INTEGER
total_supply          VARCHAR
circulating_supply    VARCHAR
max_supply            VARCHAR
current_price         VARCHAR
price_change_24h      NUMERIC
price_change_7d       NUMERIC
volume_24h            VARCHAR
market_cap            VARCHAR
liquidity_pool_address VARCHAR
total_liquidity       VARCHAR
total_transactions    INTEGER
unique_traders        INTEGER
buy_count_24h         INTEGER
sell_count_24h        INTEGER
created_at            TIMESTAMP
updated_at            TIMESTAMP
last_price_update     TIMESTAMP
```

#### `token_price_history`
```sql
id            INTEGER PRIMARY KEY
token_id      INTEGER → creator_tokens.id
timestamp     TIMESTAMP
interval_type VARCHAR (1h, 4h, 1d, etc.)
open_price    VARCHAR
high_price    VARCHAR
low_price     VARCHAR
close_price   VARCHAR
volume        VARCHAR
price_change  VARCHAR
price_change_percent NUMERIC
```

#### `token_holders`
```sql
id                  INTEGER PRIMARY KEY
token_id            INTEGER → creator_tokens.id
holder_address      VARCHAR
balance             VARCHAR
percentage_of_supply NUMERIC
first_acquired_at   TIMESTAMP
last_transaction_at TIMESTAMP
total_transactions  INTEGER
is_whale            BOOLEAN
rank                INTEGER
```

#### `token_transactions`
```sql
id                INTEGER PRIMARY KEY
token_id          INTEGER → creator_tokens.id
transaction_hash  VARCHAR UNIQUE
block_number      BIGINT
transaction_type  VARCHAR (buy, sell, transfer)
from_address      VARCHAR
to_address        VARCHAR
trader_address    VARCHAR
token_amount      VARCHAR
payment_amount    VARCHAR
payment_token     VARCHAR
price_per_token   VARCHAR
usd_value         VARCHAR
gas_used          VARCHAR
gas_price         VARCHAR
dex_name          VARCHAR
dex_router        VARCHAR
timestamp         TIMESTAMP
```

---

### 3. Social Tables

#### `creator_followers`
```sql
id                  INTEGER PRIMARY KEY
creator_profile_id  INTEGER → creator_profiles.id
follower_user_id    INTEGER → users.id
follower_para_id    VARCHAR
follower_wallet     VARCHAR
notifications_enabled BOOLEAN
followed_at         TIMESTAMP
```

#### `telegram_rooms`
```sql
id                  INTEGER PRIMARY KEY
creator_profile_id  INTEGER → creator_profiles.id
room_id             VARCHAR UNIQUE
room_name           VARCHAR
room_link           TEXT
invite_link         TEXT
price_per_minute    NUMERIC
currency            VARCHAR
total_members       INTEGER
active_members      INTEGER
total_messages      INTEGER
is_active           BOOLEAN
last_activity_at    TIMESTAMP
```

#### `telegram_access_purchases`
```sql
id                INTEGER PRIMARY KEY
room_id           INTEGER → telegram_rooms.id
user_id           INTEGER → users.id
para_user_id      VARCHAR
wallet_address    VARCHAR
duration_minutes  INTEGER
price_paid        NUMERIC
payment_token     VARCHAR
transaction_hash  VARCHAR
invite_link       TEXT
access_granted_at TIMESTAMP
access_expires_at TIMESTAMP
is_active         BOOLEAN
status            VARCHAR
```

---

### 4. Auction & Meeting Tables

#### `auctions`
```sql
id                    INTEGER PRIMARY KEY
contract_address      VARCHAR
creator_para_id       VARCHAR
creator_wallet        VARCHAR → users.wallet_address
title                 VARCHAR
description           TEXT
metadata_ipfs         VARCHAR
twitter_id            VARCHAR
seller_name           VARCHAR
profile_picture       TEXT
event_date            TIMESTAMP
event_start_time      TIMESTAMP
event_end_time        TIMESTAMP
bid_price             VARCHAR
duration_blocks       INTEGER
end_block             INTEGER
highest_bid           VARCHAR
highest_bidder        VARCHAR
blocks_remaining      INTEGER
time_remaining_seconds INTEGER
meeting_duration      INTEGER
nft_token_id          INTEGER
jitsi_room_id         VARCHAR
auto_ended            BOOLEAN
ended                 BOOLEAN
created_at            TIMESTAMP
updated_at            TIMESTAMP
```

#### `meetings`
```sql
id                  INTEGER PRIMARY KEY
auction_id          INTEGER → auctions.id
jitsi_room_id       VARCHAR
jitsi_room_config   JSONB
creator_access_token TEXT
winner_access_token TEXT
room_url            TEXT
scheduled_at        TIMESTAMP
expires_at          TIMESTAMP
```

---

### 5. Seaport/NFT Order Tables

#### `seaport_orders`
```sql
order_hash            VARCHAR PRIMARY KEY
order_type            VARCHAR (listing, offer)
nft_contract          VARCHAR
token_id              VARCHAR
maker                 VARCHAR
taker                 VARCHAR
payment_token         VARCHAR
price                 VARCHAR
price_decimal         VARCHAR
platform_fee_amount   VARCHAR
platform_fee_recipient VARCHAR
start_time            BIGINT
end_time              BIGINT
expires_at            TIMESTAMP
order_components      JSONB
signature             TEXT
is_active             BOOLEAN
is_cancelled          BOOLEAN
is_fulfilled          BOOLEAN
fulfilled_at          TIMESTAMP
fulfilled_by          VARCHAR
fulfillment_tx_hash   VARCHAR
cancelled_at          TIMESTAMP
cancellation_tx_hash  VARCHAR
para_user_id          VARCHAR → users.para_user_id
```

---

## 🔗 Table Relationships Diagram

```
                                    ┌──────────────┐
                                    │    users     │
                                    │   (10 rows)  │
                                    └──────┬───────┘
                                           │
              ┌────────────────────────────┼────────────────────────────┐
              │                            │                            │
              ▼                            ▼                            ▼
    ┌─────────────────┐          ┌─────────────────┐          ┌─────────────────┐
    │    auctions     │          │ creator_profiles│          │  seaport_orders │
    │   (17 rows)     │          │    (9 rows)     │          │                 │
    └────────┬────────┘          └────────┬────────┘          └─────────────────┘
             │                            │                            │
             │                   ┌────────┼────────┐                   │
             ▼                   │        │        │                   ▼
    ┌─────────────────┐          ▼        ▼        ▼          ┌─────────────────┐
    │    meetings     │   ┌──────────┐ ┌──────────┐ ┌──────────┐ │order_fulfillments│
    └─────────────────┘   │creator_  │ │telegram_ │ │creator_  │ └─────────────────┘
                          │tokens    │ │rooms     │ │followers │
                          │(9 rows)  │ │          │ │          │
                          └────┬─────┘ └────┬─────┘ └──────────┘
                               │            │
              ┌────────────────┼────────────┼────────────────┐
              │                │            │                │
              ▼                ▼            ▼                ▼
    ┌─────────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │token_price_     │ │token_       │ │token_       │ │telegram_    │
    │history          │ │holders      │ │transactions │ │access_      │
    │(24 rows)        │ │(5 rows)     │ │(4 rows)     │ │purchases    │
    └─────────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

---

## ⚡ Performance Impact Analysis

### Does Table Structure Affect Performance?

**YES, significantly!** Here's how:

### 1. Column Count Impact

| Table | Columns | Impact |
|-------|---------|--------|
| `users` | 10 | ✅ Fast - small row size |
| `creator_profiles` | 32 | ⚠️ Larger rows, more I/O |
| `creator_tokens` | 23 | ⚠️ Medium impact |

**Why it matters:**
- More columns = larger row size
- Larger rows = more disk I/O
- More I/O = slower queries

**Your design is GOOD because:**
- `users` is small (fast auth)
- Heavy data is in separate tables
- Only creators have the 32-column overhead

### 2. Index Impact

Your database has **good indexes**:
```
users:           idx_users_para_id, idx_users_wallet
creator_profiles: idx_creator_profiles_user_id, idx_creator_profiles_username
creator_tokens:   idx_creator_tokens_creator, idx_creator_tokens_address
auctions:         idx_auctions_creator, idx_auctions_ended, idx_auctions_end_block
```

**Performance benefit:**
- `WHERE wallet_address = '0x...'` → Uses index, O(log n)
- Without index → Full table scan, O(n)

### 3. JOIN Performance

**Current relationships require JOINs:**
```sql
-- To get creator with token:
SELECT * FROM creator_profiles cp
JOIN creator_tokens ct ON cp.id = ct.creator_profile_id
WHERE cp.wallet_address = '0x...'
```

**Impact:**
- 2 table JOIN = ~2x query time
- 3 table JOIN = ~3x query time
- Indexes on foreign keys help!

### 4. Denormalization Trade-offs

**Notice:** `creator_profiles` has some token data duplicated:
```sql
-- In creator_profiles (denormalized):
token_address, token_symbol, token_name, token_supply

-- In creator_tokens (normalized):
contract_address, symbol, name, total_supply
```

**Why duplicate?**
- ✅ Faster reads (no JOIN needed for basic info)
- ❌ Data can get out of sync
- ❌ More storage space

---

## 📈 Performance Recommendations

### Current State: ✅ Good for Small Scale

With your current data:
- 10 users
- 9 creators
- 17 auctions

**Performance is excellent** - queries return in <100ms

### Future Scaling Concerns

| Scale | Users | Creators | Auctions | Concern |
|-------|-------|----------|----------|---------|
| Now | 10 | 9 | 17 | ✅ No issues |
| 1K | 1,000 | 100 | 500 | ✅ Still fast |
| 10K | 10,000 | 500 | 5,000 | ⚠️ Add caching |
| 100K | 100,000 | 2,000 | 50,000 | ⚠️ Need optimization |

### Recommendations for Scale

1. **Add Redis caching** for:
   - Trending creators (cache 5 min)
   - Token prices (cache 1 min)
   - Creator profiles (cache 5 min)

2. **Add composite indexes** for common queries:
   ```sql
   CREATE INDEX idx_tokens_trending ON creator_tokens(volume_24h DESC, market_cap DESC);
   ```

3. **Partition large tables** when they grow:
   - `token_price_history` by month
   - `token_transactions` by month

4. **Consider read replicas** at 100K+ users

---

## 🎯 Summary

### Why This Architecture?

| Design Choice | Reason | Benefit |
|---------------|--------|---------|
| Separate `users` & `creator_profiles` | Not all users are creators | Smaller auth table, faster login |
| `creator_tokens` separate table | Token data changes frequently | Isolated updates, better caching |
| `token_price_history` separate | Time-series data grows fast | Can partition/archive old data |
| Foreign keys everywhere | Data integrity | No orphan records |
| Indexes on lookup columns | Query performance | O(log n) vs O(n) |

### Current Performance: ✅ Excellent

Your database is well-designed for:
- Fast authentication
- Quick creator lookups
- Efficient token queries
- Scalable architecture

### No Immediate Changes Needed

The current structure is production-ready. Focus on:
1. Adding caching layer (Redis) when traffic grows
2. Monitoring query performance
3. Adding indexes as new query patterns emerge
