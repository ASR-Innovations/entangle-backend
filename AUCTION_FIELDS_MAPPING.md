# Auction Fields Mapping - Image Data to Database

## Quick Reference

This document maps the 12 auction parameters from your image to the database columns.

---

## 📸 Image Data → Database Columns

| # | Image Field | Image Value | Database Column | Status |
|---|-------------|-------------|-----------------|--------|
| 1 | Host | 0x0cb9d7191c9dd544a9994dce38211bfb7097307e | `creator_wallet` | ✅ Already existed |
| 2 | Twitter ID | AbhiKum9635317 | `twitter_id` | ✅ **ADDED** |
| 3 | Duration | 30161 blocks | `duration_blocks` | ✅ **ADDED** |
| 4 | Reserve Price | 0.01 AVAX | `bid_price` | ✅ **ADDED** (renamed) |
| 5 | Metadata IPFS | Qmtest20251109 | `metadata_ipfs` | ✅ Already existed |
| 6 | Meeting Duration | 60 minutes | `meeting_duration` | ✅ Already existed |
| 7 | Seller Name | Abhi Kumar | `seller_name` | ✅ **ADDED** |
| 8 | Event Name | test | `title` | ✅ Already existed (NOT duplicated) |
| 9 | Event Date | 2025-11-09T00:00:00.000Z | `event_date` | ✅ **ADDED** |
| 10 | Event Start Time | 2025-11-09T04:30:00.000Z | `event_start_time` | ✅ **ADDED** |
| 11 | Event End Time | 2025-11-09T05:30:00.000Z | `event_end_time` | ✅ **ADDED** |
| 12 | Profile Picture | https://pbs.twimg.com/... | `profile_picture` | ✅ **ADDED** |

---

## 🆕 Additional Columns Added (Not in Image)

These columns track real-time auction state from blockchain:

| Column | Type | Purpose | Updated By |
|--------|------|---------|------------|
| `end_block` | INTEGER | Block when auction ends | Auction creation |
| `highest_bid` | VARCHAR(50) | Current highest bid amount | Cron job every 2 min |
| `highest_bidder` | VARCHAR(42) | Current highest bidder address | Cron job every 2 min |
| `blocks_remaining` | INTEGER | Blocks until auction ends | Cron job every 2 min |
| `time_remaining_seconds` | INTEGER | Seconds until auction ends | Cron job every 2 min |
| `ended` | BOOLEAN | Whether auction has ended | Cron job |
| `updated_at` | TIMESTAMP | Last update time | Auto-updated on any change |

---

## 📊 Complete Auctions Table Schema

### Existing Columns (Before Update)
```sql
id                    INTEGER         -- Auction ID
contract_address      VARCHAR(42)     -- Smart contract address
creator_para_id       VARCHAR(255)    -- Para user ID
creator_wallet        VARCHAR(42)     -- Creator wallet address
title                 VARCHAR(255)    -- Auction title (= event name)
description           TEXT            -- Auction description
metadata_ipfs         VARCHAR(255)    -- IPFS metadata hash
meeting_duration      INTEGER         -- Meeting duration (minutes)
nft_token_id          INTEGER         -- NFT token ID (after auction ends)
jitsi_room_id         VARCHAR(255)    -- Meeting room ID
auto_ended            BOOLEAN         -- Auto-ended by cron flag
created_at            TIMESTAMP       -- Creation timestamp
```

### New Columns (Added)
```sql
-- From image data
twitter_id            VARCHAR(255)    -- Twitter/X ID
seller_name           VARCHAR(255)    -- Creator display name
profile_picture       TEXT            -- Creator avatar URL
event_date            TIMESTAMP       -- Event date
event_start_time      TIMESTAMP       -- Event start time
event_end_time        TIMESTAMP       -- Event end time
bid_price             VARCHAR(50)     -- Reserve/starting price

-- Real-time tracking
duration_blocks       INTEGER         -- Auction duration in blocks
end_block             INTEGER         -- Block when auction ends
highest_bid           VARCHAR(50)     -- Current highest bid
highest_bidder        VARCHAR(42)     -- Current highest bidder
blocks_remaining      INTEGER         -- Blocks until end
time_remaining_seconds INTEGER        -- Seconds until end
ended                 BOOLEAN         -- Auction ended flag
updated_at            TIMESTAMP       -- Last update time
```

---

## 🔄 Data Flow

### On Auction Creation
```
Frontend sends 12 parameters from image
         ↓
Backend validates (src/routes/auctions.js)
         ↓
Backend verifies transaction on blockchain
         ↓
Backend fetches blockchain data (getAuction)
         ↓
Backend stores ALL data in database:
  - User-provided: twitter_id, seller_name, etc.
  - Blockchain: bid_price, end_block, etc.
  - Calculated: blocks_remaining, time_remaining
```

### Every 2 Minutes (Cron Job)
```
Cron job runs
         ↓
Fetches active auctions from database
         ↓
For each active auction:
  - Get current state from blockchain
  - Calculate blocks_remaining
  - Calculate time_remaining_seconds
  - Update highest_bid
  - Update highest_bidder
         ↓
Updates database with current values
         ↓
Frontend queries database (no blockchain calls!)
```

---

## 📝 API Request Example

### Frontend sends this to POST /auctions/created:

```json
{
  "title": "test",
  "description": "Meet with Abhi Kumar about blockchain development",
  "duration": 30161,
  "reservePrice": 0.01,
  "meetingDuration": 60,
  "creatorWallet": "0x0cb9d7191c9dd544a9994dce38211bfb7097307e",
  "transactionHash": "0xabc123...",

  "twitterId": "AbhiKum9635317",
  "sellerName": "Abhi Kumar",
  "profilePicture": "https://pbs.twimg.com/profile_images/1969780437468789760/...",
  "eventDate": "2025-11-09T00:00:00.000Z",
  "eventStartTime": "2025-11-09T04:30:00.000Z",
  "eventEndTime": "2025-11-09T05:30:00.000Z"
}
```

### Backend stores this in database:

```sql
INSERT INTO auctions (
  -- Required fields
  id, contract_address, creator_para_id, creator_wallet,

  -- From image (user input)
  title, description, meeting_duration,
  twitter_id, seller_name, profile_picture,
  event_date, event_start_time, event_end_time,

  -- From blockchain
  bid_price, duration_blocks, end_block,
  highest_bid, highest_bidder,

  -- Calculated
  blocks_remaining, time_remaining_seconds, ended,

  -- Metadata
  metadata_ipfs, created_at
) VALUES (
  42, '0x9171Cf8E1d3c7EBf7bf8866CcD2c8C58512A3Be8', 'para_123', '0x0cb...',

  'test', 'Meet with Abhi Kumar...', 60,
  'AbhiKum9635317', 'Abhi Kumar', 'https://pbs.twimg.com/...',
  '2025-11-09 00:00:00', '2025-11-09 04:30:00', '2025-11-09 05:30:00',

  '10000000000000000', 30161, 45678,
  '0', '0x0000000000000000000000000000000000000000',

  30161, 60322, false,

  'Qmtest20251109', CURRENT_TIMESTAMP
);
```

---

## ✅ Verification

After deployment, verify all fields are stored:

```sql
-- Get a recent auction
SELECT
  id,
  title,
  twitter_id,        -- Should have value
  seller_name,       -- Should have value
  profile_picture,   -- Should have URL
  event_date,        -- Should have timestamp
  event_start_time,  -- Should have timestamp
  event_end_time,    -- Should have timestamp
  bid_price,         -- Should have amount in wei
  highest_bid,       -- Should update when bids placed
  blocks_remaining,  -- Should decrease over time
  time_remaining_seconds, -- Should decrease over time
  ended              -- Should be false for active
FROM auctions
ORDER BY created_at DESC
LIMIT 1;
```

**Expected result:** All fields should have values (not NULL).

---

## 🎯 Summary

### What matches the image exactly:
1. ✅ Host → creator_wallet
2. ✅ Twitter ID → twitter_id
3. ✅ Duration → duration_blocks
4. ✅ Reserve Price → bid_price (renamed)
5. ✅ Metadata IPFS → metadata_ipfs
6. ✅ Meeting Duration → meeting_duration
7. ✅ Seller Name → seller_name
8. ✅ Event Name → title (already existed, NOT duplicated)
9. ✅ Event Date → event_date
10. ✅ Event Start Time → event_start_time
11. ✅ Event End Time → event_end_time
12. ✅ Profile Picture → profile_picture

### What was added beyond the image:
- Real-time bid tracking (highest_bid, highest_bidder)
- Time tracking (blocks_remaining, time_remaining_seconds)
- Status tracking (ended, updated_at)

### What was NOT added:
- ❌ event_name column (because title = event_name)

---

**All 12 parameters from your image are now stored in the database!**
