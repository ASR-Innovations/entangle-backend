# Cron Job Documentation Index

This directory contains comprehensive documentation of the auction cron job system.

## Documents Overview

### 1. **CRON_JOB_QUICK_REFERENCE.md** (START HERE)
Quick overview of what the cron job does and how to use it.

**Best for:**
- Getting a quick understanding
- Troubleshooting common issues
- Configuration checklist
- Common log messages
- Database queries

**Reading time:** 5-10 minutes

---

### 2. **CRON_JOB_ANALYSIS.md** (DETAILED GUIDE)
Comprehensive technical analysis of the cron job architecture.

**Sections:**
- Cron Job Architecture
- Complete Auction Processing Flow
- Database Tables Involved
- Services and Utilities Used
- Data Flow Diagram
- Key Data Updates
- Error Handling
- Complete Lifecycle Example
- File Locations and Line Numbers

**Best for:**
- Understanding the complete system
- Deep diving into the logic
- Architectural decisions
- Finding code by function name
- Database schema understanding

**Reading time:** 20-30 minutes

---

### 3. **CRON_JOB_DIAGRAMS.md** (VISUAL REFERENCE)
12 ASCII diagrams showing various aspects of the cron system.

**Diagrams include:**
1. Component Interaction Diagram
2. Cron Job Execution Timeline
3. processEndedAuctions() Function Flow
4. processSingleAuction() Detailed Flow
5. Database Update Operations
6. Blockchain Interaction Sequence
7. Auction State Changes
8. Error Handling Tree
9. Locking Mechanism
10. Complete Auction Lifecycle
11. Service Dependencies
12. Configuration Propagation

**Best for:**
- Visual learners
- Understanding flow/architecture
- Presentations
- Quick reference of processes

**Reading time:** 10-15 minutes

---

## What is the Cron Job?

The cron job is an automated system that:
1. Runs **every 2 minutes** (configurable)
2. Scans the blockchain for **auctions that have ended**
3. Calls the `endAuction()` contract function to finalize auctions
4. Stores the **NFT token ID** in the database
5. Marks auctions as **auto_ended = true**

## Core Files

| File | Lines | Purpose |
|------|-------|---------|
| `src/services/AuctionCronService.js` | 477 | Main cron service |
| `src/scripts/auctionCron.js` | 62 | Standalone cron runner |
| `src/server.js` | 118-123 | Cron initialization |
| `database/schema.sql` | 1-104 | Database schema |
| `src/utils/logger.js` | 50 | Logging utility |

## Quick Facts

```
Library:          node-cron v3.0.3
Default Schedule: */2 * * * * (every 2 minutes)
Primary Function: processEndedAuctions()
Database Writes:  auctions table only (3 columns)
Blockchain Reads: Yes (read-only calls)
Blockchain Writes: Yes (endAuction() transactions)
```

## Key Functions

| Function | Purpose | Called | Cost |
|----------|---------|--------|------|
| `processEndedAuctions()` | Main entry point | Every 2 min | Read-only |
| `processSingleAuction()` | Process one auction | Per auction | ~0 gas |
| `endAuctionOnChain()` | End auction on blockchain | Per auction | 50-150k gas |
| `updateAuctionInDatabase()` | Update auctions table | Per auction | ~0 gas |

## Database Operations

### Reads
- `auctions` table (all columns)
- `users` table (creator and winner lookup)

### Writes
- `auctions` table: Updates 3 columns only
  - `nft_token_id`
  - `jitsi_room_id`
  - `auto_ended`

### No Writes
- `meetings` table (created on-demand)
- `meeting_access_logs` table (created on-demand)
- `users` table (read-only)

## Environment Variables

```
RPC_URL                  Blockchain RPC endpoint
CONTRACT_ADDRESS         Smart contract address
PLATFORM_PRIVATE_KEY     Wallet for transactions
DATABASE_URL             PostgreSQL connection
AUCTION_CHECK_INTERVAL   Cron expression (optional)
LOG_LEVEL                Logger level (optional)
```

## How to Use This Documentation

### I want to understand the system
1. Read **CRON_JOB_QUICK_REFERENCE.md** (10 min)
2. Scan **CRON_JOB_DIAGRAMS.md** for visual understanding (10 min)
3. Read **CRON_JOB_ANALYSIS.md** for complete details (20 min)

### I need to troubleshoot an issue
1. Go to "Troubleshooting Guide" in **CRON_JOB_QUICK_REFERENCE.md**
2. Check "Error Handling" in **CRON_JOB_ANALYSIS.md**
3. Look at "Error Handling Tree" diagram in **CRON_JOB_DIAGRAMS.md**

### I need to find a specific function/file
Use "File Locations and Line Numbers" in **CRON_JOB_ANALYSIS.md**

### I need to understand the database schema
1. Check "Database Tables Involved" in **CRON_JOB_ANALYSIS.md**
2. Look at actual schema in `database/schema.sql`

### I want to see the complete flow
1. Look at "Complete Auction Lifecycle" diagram in **CRON_JOB_DIAGRAMS.md**
2. Read "How Data Flows" in **CRON_JOB_QUICK_REFERENCE.md**

## Key Takeaways

1. **Simple Purpose:** End auctions automatically and store NFT IDs
2. **Safe:** Uses locking to prevent concurrent execution
3. **Automated:** Runs on server startup and every 2 minutes after
4. **Idempotent:** Safe to run multiple times (auto_ended flag prevents re-processing)
5. **Known Issues:** Auctions 35 & 36 have a contract bug and are skipped
6. **Low Write Overhead:** Only updates 3 columns per auction

## Common Tasks

### Check if Cron is Running
```bash
tail -f logs/combined.log | grep "CRON"
```

### View Recent Cron Activity
```bash
tail -100 logs/combined.log | grep -E "processEndedAuctions|processSingleAuction"
```

### Find Unprocessed Auctions
```sql
SELECT id, auto_ended, nft_token_id FROM auctions WHERE auto_ended = false;
```

### Find Auctions with NFTs
```sql
SELECT id, nft_token_id FROM auctions WHERE nft_token_id IS NOT NULL;
```

## Related Files (Not in this folder)

- `src/services/ContractService.js` - Blockchain interaction
- `src/services/MeetingService.js` - Meeting creation (on-demand)
- `src/services/JitsiService.js` - Jitsi integration
- `src/routes/meetings.js` - Meeting endpoints
- `src/routes/auctions.js` - Auction endpoints

## Questions?

For detailed information, see the specific documentation file:
- **Quick answers:** CRON_JOB_QUICK_REFERENCE.md
- **Detailed information:** CRON_JOB_ANALYSIS.md
- **Visual understanding:** CRON_JOB_DIAGRAMS.md

---

Last Updated: November 8, 2025
Total Documentation: 3 files, 60+ pages of analysis
