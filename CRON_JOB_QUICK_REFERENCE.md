# CRON JOB QUICK REFERENCE GUIDE

## Quick Facts

- **What:** Automated auction ending system using node-cron
- **When:** Runs every 2 minutes (*/2 * * * *)
- **Where:** AuctionCronService in `/src/services/AuctionCronService.js`
- **Why:** Automatically end auctions on blockchain and update database with NFT data
- **How:** Monitors blockchain block height vs auction endBlock

---

## Files to Know

| File | Purpose | Key Functions |
|------|---------|----------------|
| `src/services/AuctionCronService.js` | Main cron logic | `processEndedAuctions()`, `processSingleAuction()`, `endAuctionOnChain()`, `updateAuctionInDatabase()` |
| `src/scripts/auctionCron.js` | Standalone cron runner | `AuctionCron` class for running outside server |
| `src/server.js` | Server startup | Initializes cron on line 121 |
| `database/schema.sql` | Database tables | Defines auctions, users, meetings tables |
| `src/utils/logger.js` | Logging | Winston logger for cron events |

---

## What Happens Every 2 Minutes

```
CRON CYCLE (120 seconds)
├─ Check if last run still executing (isRunning flag)
│  ├─ If YES: skip this cycle
│  └─ If NO: continue
├─ Get current block number from blockchain
├─ Get total auction count from contract
├─ For each auction:
│  ├─ Check if ended on-chain
│  ├─ Check if processed in database (auto_ended flag)
│  └─ Add to processing list if needs action
├─ For each auction ready to end:
│  ├─ End on-chain (if not already ended)
│  ├─ Get updated NFT token ID
│  ├─ Query creator and winner user data
│  └─ Update auctions table
└─ Next cycle in 2 minutes
```

---

## Database Changes Made

### auctions table - Only 3 Columns Updated

```sql
UPDATE auctions SET
  nft_token_id = <token_id>,    -- NFT minted by contract
  jitsi_room_id = null,         -- Currently not used
  auto_ended = true             -- Marks as processed
WHERE id = <auction_id>
```

**No inserts or deletes - only updates 3 columns per auction**

### Users table - READ ONLY

```sql
SELECT * FROM users WHERE wallet_address = <address>
```

Gets creator and winner data. Never written to by cron.

### meetings table - NOT TOUCHED by cron

Meetings are created on-demand when winner burns NFT (separate flow).

---

## Key Functions Explained

### 1. processEndedAuctions() [Main Entry Point]
**Line 123-215 in AuctionCronService.js**

```
┌─ Get current block & auction count from blockchain
├─ Scan ALL auctions (1 to counter)
│  └─ Identify which ones need processing
├─ For each ready auction
│  └─ Call processSingleAuction()
└─ Return to cron scheduler
```

**Runs:** Every 2 minutes automatically

---

### 2. processSingleAuction() [Process One Auction]
**Line 220-278 in AuctionCronService.js**

```
┌─ Check if problematic auction (35, 36) → skip if yes
├─ Call endAuctionOnChain() if not already ended
├─ Get updated auction data with NFT ID
├─ Query database for creator and winner users
└─ Call updateAuctionInDatabase() to save changes
```

**Runs:** For each auction that's ready to end

---

### 3. endAuctionOnChain() [Blockchain Transaction]
**Line 283-321 in AuctionCronService.js**

```
┌─ Call contract.endAuction(auctionId)
├─ Wait for transaction confirmation
├─ IF success: return receipt
├─ IF "Token transfer failed" error: return null (skip rest)
└─ IF other error: throw for retry
```

**Cost:** ~50-150k gas per auction

---

### 4. updateAuctionInDatabase() [Database Update]
**Line 392-428 in AuctionCronService.js**

```
┌─ UPDATE auctions table:
│  ├─ Set nft_token_id
│  ├─ Set jitsi_room_id
│  └─ Set auto_ended = true
└─ IF meeting provided: insert to meetings (currently never called)
```

**Changes:** 3 columns per auction

---

## Environment Variables Needed

```bash
# Blockchain connection
RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
CONTRACT_ADDRESS=0x9171Cf8E1d3c7EBf7bf8866CcD2c8C58512A3Be8
PLATFORM_PRIVATE_KEY=0x...  # For signing endAuction() transactions

# Database connection
DATABASE_URL=postgresql://user:password@host/database

# Optional
AUCTION_CHECK_INTERVAL=*/2 * * * *  # Cron expression (default shown)
LOG_LEVEL=info
```

---

## Known Issues & Limitations

### 1. Problematic Auctions (35, 36)
- **Error:** "Token transfer failed"
- **Cause:** Smart contract bug (likely with token transfer logic)
- **Solution:** Hardcoded to skip these auctions
- **Fix Needed:** Contract redeployment

### 2. Meeting Creation Not Automated
- **Current:** Meetings created on-demand when user burns NFT
- **Why:** Designed for flexibility and user control
- **Code:** See MeetingService.joinGatedMeeting() for flow

### 3. No Automatic Retry Strategy
- **Current:** Failed auctions wait for next cycle (2 minutes later)
- **Why:** Prevents resource exhaustion and gas waste
- **Better:** Add exponential backoff if needed

---

## How Data Flows

```
COMPLETE AUCTION ENDING FLOW:

1. User Creates Auction
   └─ Contract stores auction data

2. Time Passes (Bidding happens)
   └─ Current block advances

3. Auction Reaches End Block
   ├─ Status on-chain: auction.ended still false
   └─ Status in DB: auto_ended still false

4. CRON JOB DETECTS THIS
   ├─ Sees: currentBlock >= endBlock
   ├─ Action: Call contract.endAuction()
   └─ Result: NFT minted to winner

5. CRON UPDATES DATABASE
   ├─ Stores: nft_token_id in auctions
   ├─ Sets: auto_ended = true
   └─ Ready: For next phase

6. WINNER BURNS NFT (Later)
   ├─ User initiates: POST /api/meetings/burn-nft
   ├─ System verifies: NFT ownership
   ├─ System creates: Meeting on-demand
   └─ Result: User can join meeting
```

---

## Testing the Cron Job

### Check if Running
```bash
# Look for cron log messages
tail -f logs/combined.log | grep "CRON"

# Or specific patterns
tail -f logs/combined.log | grep -E "processEndedAuctions|processSingleAuction"
```

### Trigger Manually (for testing)
```javascript
const { getAuctionCronService } = require('./src/services/AuctionCronService');
const cron = getAuctionCronService();
await cron.triggerManually();  // Line 457
```

### Common Log Messages

| Message | Meaning |
|---------|---------|
| `CRON JOB TRIGGERED` | Cron job starting |
| `Found X active auctions` | Scanning results |
| `ENDED with winner` | Auction ready to process |
| `Auction ended successfully` | On-chain tx succeeded |
| `Token transfer failed` | Known bug, auction skipped |
| `Updated database for auction` | Database update complete |
| `CRON JOB COMPLETED in XXXms` | Cycle finished successfully |

---

## Database Query Examples

### Find Auctions Not Yet Processed
```sql
SELECT id, auto_ended, nft_token_id FROM auctions WHERE auto_ended = false;
```

### Find Auctions with NFT IDs Stored
```sql
SELECT id, nft_token_id FROM auctions WHERE nft_token_id IS NOT NULL;
```

### Find Problematic Auctions
```sql
SELECT id FROM auctions WHERE id IN (35, 36);
```

### Check Auction Status
```sql
SELECT id, auto_ended, nft_token_id, jitsi_room_id FROM auctions WHERE id = $1;
```

---

## Performance Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| Cron frequency | Every 2 minutes | Configurable via env var |
| Max auctions per scan | Unlimited | Loops through all |
| Gas per endAuction | 50-150k | Variable based on refunds |
| Database queries per cycle | 1 + (N*2) | N = number of auctions to process |
| Typical runtime | < 10s | For most cycles |
| Max runtime tolerance | Unlimited | Next cycle is skipped if running |

---

## Architecture Overview

```
Server Startup
    ↓
Initialize Database
    ↓
Initialize Contract Service
    ↓
Initialize AuctionCronService ← CRON SERVICE
    ├─ Schedule: '*/2 * * * *'
    ├─ Initial run: +5s delay
    └─ Subsequent: Every 2 minutes
    ↓
Request Handler Loop
```

---

## Troubleshooting Guide

### Cron Not Running
1. Check logs: `tail -f logs/combined.log`
2. Verify database connection working
3. Verify contract address and RPC URL in env vars
4. Restart server to reinitialize cron

### Auctions Not Processing
1. Check if isRunning flag is stuck (should reset after each cycle)
2. Verify RPC endpoint is responding
3. Check gas/wallet balance for transactions
4. Look for error logs in combined.log

### NFT IDs Not Stored
1. Verify endAuction() transaction succeeded (check receipt.status)
2. Check if auction is in problematic list [35, 36]
3. Verify database update query ran without errors
4. Check database for null nft_token_id values

### Database Lock/Timeout
1. Check for long-running queries
2. Verify database connection pool size
3. Check if previous cron cycle still running (isRunning flag)
4. Review database logs for locks

---

## Configuration Checklist

- [ ] RPC_URL points to correct network
- [ ] CONTRACT_ADDRESS matches deployed contract
- [ ] PLATFORM_PRIVATE_KEY has sufficient balance for gas
- [ ] DATABASE_URL can connect to PostgreSQL
- [ ] Log level appropriate for environment
- [ ] AUCTION_CHECK_INTERVAL set if non-default
- [ ] Server can reach both blockchain and database

---

## Next Steps for Development

1. **Add Monitoring:** Send cron metrics to monitoring service
2. **Better Retry:** Implement exponential backoff for failed auctions
3. **Fix Problematic Auctions:** Deploy new contract or migrate state
4. **Automate Meetings:** Consider creating meetings during cron (not on-demand)
5. **Database Pagination:** Add pagination to auction scanning for scalability
6. **Event Sourcing:** Track all state changes in audit log

---

## Quick Code Locations

- **Start cron:** `src/server.js:121`
- **Main logic:** `src/services/AuctionCronService.js:123-215`
- **Process single:** `src/services/AuctionCronService.js:220-278`
- **Blockchain tx:** `src/services/AuctionCronService.js:283-321`
- **Database update:** `src/services/AuctionCronService.js:392-428`
- **Schema:** `database/schema.sql`
- **Config:** `.env` or `.env.production`

---

## Important Notes

1. **No Concurrent Execution:** isRunning flag prevents overlapping cron cycles
2. **No Automatic Meeting Creation:** Meetings created on-demand when winner burns NFT
3. **Idempotent:** Safe to run cron multiple times (auto_ended flag prevents re-processing)
4. **Read-Heavy:** Mostly reads from blockchain/database, few writes
5. **On-Demand Scaling:** Can handle any number of auctions (no pagination issues yet)

