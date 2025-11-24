# Database Sync Guide

## Overview

This guide explains how to sync all auction data from the blockchain to the database to populate the new columns.

---

## Why Sync is Needed

We added new columns to the `auctions` table:
- `bid_price` (reserve/floor price)
- `highest_bid` (current highest bid)
- `highest_bidder` (current highest bidder address)
- `end_block` (when auction ends)
- `blocks_remaining` (blocks until end)
- `time_remaining_seconds` (seconds until end)
- `seller_name` (seller's display name)
- `profile_picture` (seller's profile image)
- `event_date`, `event_start_time`, `event_end_time` (event details)

These columns need to be populated with data from the blockchain.

---

## Sync Script

### File: `sync-all-auctions.js`

This script will:
1. ✅ Fetch all auction IDs from the database
2. ✅ Get current data from blockchain for each auction
3. ✅ Update database with latest blockchain data
4. ✅ Show progress and summary

---

## How to Run

### Step 1: Make sure your server environment is set up

```bash
# Check .env file has correct values
cat .env | grep -E "DATABASE_URL|CONTRACT_ADDRESS|RPC_URL"
```

### Step 2: Run the sync script

```bash
node sync-all-auctions.js
```

### Expected Output:

```
╔════════════════════════════════════════════════════════════════════╗
║         BLOCKCHAIN TO DATABASE SYNC SCRIPT                         ║
║         Syncing all auction data from blockchain                   ║
╚════════════════════════════════════════════════════════════════════╝

🔄 STARTING FULL AUCTION SYNC FROM BLOCKCHAIN TO DATABASE
======================================================================

📡 Initializing blockchain connection...
✅ Connected to blockchain
📝 Contract: 0x6fD65aE833C9679cBC571581CE0f5Cd73D565796

📦 Current Block: 47545000

💾 Fetching all auctions from database...
📊 Found 83 auctions in database
📋 Auction IDs: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10...

🔄 Starting sync process...
----------------------------------------------------------------------

[1/83] 🔍 Syncing Auction #1...
[1/83] 🏁 Auction #1: ENDED
       Seller: Test User
       Floor Price: 0.01 AVAX
       Status: Ended
[1/83] ✅ Synced successfully

[2/83] 🔍 Syncing Auction #2...
[2/83] 🏁 Auction #2: ENDED
       Seller: Test User
       Floor Price: 0.01 AVAX
       Status: Ended
[2/83] ✅ Synced successfully

...

[77/83] 🔍 Syncing Auction #77...
[77/83] 🔥 Auction #77: HOT
       Seller: Abhi Kumar
       Floor Price: 0.01 AVAX
       Highest Bid: 0.05 AVAX
       Bidder: 0x61Ce0aFC9F...
       Blocks Remaining: 24000
       Time Remaining: 800 minutes
[77/83] ✅ Synced successfully

...

======================================================================
📊 SYNC SUMMARY
======================================================================
✅ Successfully synced: 83 auctions
❌ Errors: 0 auctions
⚠️  Skipped: 0 auctions
📦 Total processed: 83 auctions
======================================================================

🎉 Sync completed successfully!
💡 All auction data has been updated from the blockchain.

Next steps:
1. ✅ Database is now in sync with blockchain
2. ✅ Cron job will keep it updated every 10 seconds
3. ✅ Frontend can now use the database endpoints

✅ Script completed successfully
```

---

## What Gets Updated

For each auction, the script updates:

### Price Information:
- `bid_price` - Reserve/floor price from blockchain
- `highest_bid` - Current highest bid (or 0 if no bids)
- `highest_bidder` - Address of highest bidder (or zero address)

### Timing Information:
- `end_block` - Block number when auction ends
- `blocks_remaining` - Blocks until auction ends
- `time_remaining_seconds` - Seconds until auction ends

### Status:
- `ended` - Whether auction has ended (true/false)
- `nft_token_id` - NFT token ID if minted

### Display Information:
- `seller_name` - Seller's display name
- `profile_picture` - Seller's profile picture URL
- `event_date` - Event date
- `event_start_time` - Event start time
- `event_end_time` - Event end time

### Metadata:
- `updated_at` - Timestamp of last update

---

## Verification

After running the sync, verify the data:

### Check a specific auction:
```bash
# Check auction #77 in database
PGPASSWORD=entangle_secure_2024 psql -h 209.38.123.139 -U entangle_user -d entangle_meetings -c "SELECT id, seller_name, bid_price, highest_bid, highest_bidder, ended, blocks_remaining FROM auctions WHERE id = 77;"
```

### Check via API:
```bash
# Get auction #77 from API
curl 'http://localhost:5009/api/auctions/db/77' | jq '.'
```

### Compare with blockchain:
```bash
# Get auction #77 from blockchain
node test-fetch-auction-77.js
```

---

## Troubleshooting

### Error: "Connection timeout"
**Solution:** Check your RPC_URL in .env file and ensure you have internet connection.

### Error: "Auction not found on blockchain"
**Solution:** This is normal for auctions that were deleted or never created on-chain. They will be skipped.

### Error: "Database connection failed"
**Solution:** Check your DATABASE_URL in .env file and ensure the database is accessible.

### Script is slow
**Solution:** This is normal. The script processes each auction sequentially to avoid rate limiting. For 83 auctions, expect ~1-2 minutes.

---

## Frequency

### One-Time Sync:
Run this script **once** to populate the new columns with blockchain data.

### Ongoing Updates:
After the initial sync, the **cron job** will automatically keep the data updated every 10 seconds. You don't need to run this script again unless:
- You add new columns to the database
- You want to force a full re-sync
- Data becomes out of sync for some reason

---

## Safety

The script is **safe to run multiple times**:
- ✅ It only updates existing auctions (no deletions)
- ✅ It uses UPDATE queries (no data loss)
- ✅ It has error handling (won't crash on errors)
- ✅ It shows progress (you can monitor it)
- ✅ It has a summary (you know what happened)

---

## Performance

- **Speed:** ~100ms per auction
- **Total Time:** ~1-2 minutes for 83 auctions
- **RPC Calls:** 1 per auction
- **Database Queries:** 1 per auction

---

## After Sync

Once the sync is complete:

1. ✅ **Database is populated** with all blockchain data
2. ✅ **Cron job keeps it updated** every 10 seconds
3. ✅ **API endpoints work** with full data
4. ✅ **Frontend can display** all auction information

---

## Quick Commands

```bash
# Run the sync
node sync-all-auctions.js

# Check sync results in database
PGPASSWORD=entangle_secure_2024 psql -h 209.38.123.139 -U entangle_user -d entangle_meetings -c "SELECT COUNT(*) as total, COUNT(CASE WHEN bid_price IS NOT NULL THEN 1 END) as with_price FROM auctions;"

# Test API endpoints
curl 'http://localhost:5009/api/auctions/active/db?limit=5' | jq '.auctions[0]'
curl 'http://localhost:5009/api/auctions/ended/db?limit=5' | jq '.auctions[0]'
```

---

## Summary

✅ **Script created:** `sync-all-auctions.js`  
✅ **Purpose:** Populate database with blockchain data  
✅ **Safe to run:** Multiple times without issues  
✅ **One-time:** Only needed once (cron job handles updates)  
✅ **Fast:** ~1-2 minutes for all auctions  
✅ **Verified:** Shows progress and summary  

Run the script now to sync all your auction data! 🚀
