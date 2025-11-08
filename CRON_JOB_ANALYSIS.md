# COMPREHENSIVE CRON JOB ANALYSIS

## Overview

The Entangled Backend uses a **Node-Cron** based automated auction processing system that monitors the blockchain for ended auctions and updates the database accordingly. The cron job runs every **2 minutes** (configurable) to check for auctions that have reached their end blocks and need processing.

---

## CRON JOB ARCHITECTURE

### 1. Entry Points

#### A. Main Server Integration
**File:** `/Users/abhishekkr./Developer/entagledBackend/src/server.js` (Lines 118-123)

The cron service is started as part of the server initialization process:

```javascript
// Step 3: Starting auction cron service
const { getAuctionCronService } = require('./services/AuctionCronService');
const auctionCron = getAuctionCronService();
auctionCron.start();
```

**When it runs:** Automatically when the server starts.

#### B. Standalone Cron Script
**File:** `/Users/abhishekkr./Developer/entagledBackend/src/scripts/auctionCron.js` (Lines 1-62)

A standalone class that can be run independently:

```javascript
class AuctionCron {
  async initialize() {
    await setupDatabase();
    this.contractService = getContractService();
    await this.contractService.initialize();
    this.auctionCronService = getAuctionCronService();
  }
  
  async start() {
    const cronExpression = process.env.AUCTION_CHECK_INTERVAL || '*/1 * * * *';
    cron.schedule(cronExpression, async () => {
      if (this.isRunning) return;
      this.isRunning = true;
      try {
        await this.auctionCronService.processEndedAuctions();
      } finally {
        this.isRunning = false;
      }
    });
  }
}
```

**Configuration:** The cron expression is configurable via `AUCTION_CHECK_INTERVAL` environment variable (default: every minute).

---

## CORE CRON SERVICE

### Main Service Class
**File:** `/Users/abhishekkr./Developer/entagledBackend/src/services/AuctionCronService.js` (Lines 1-477)

This is the heart of the cron system. It's a **singleton** pattern service:

```javascript
// Singleton instance
let auctionCronService = null;

function getAuctionCronService() {
  if (!auctionCronService) {
    auctionCronService = new AuctionCronService();
  }
  return auctionCronService;
}
```

### 2. Schedule Configuration

#### Default Schedule
**Lines 71-87:**

```javascript
// Run every 2 minutes to check for ended auctions
this.job = cron.schedule('*/2 * * * *', async () => {
  // ... cron logic
}, {
  scheduled: false  // Don't start until explicitly called
});

this.job.start();
```

- **Frequency:** Every 2 minutes
- **Schedule Expression:** `*/2 * * * *` (cron format)
- **Initial Check:** Runs after 5 seconds (line 92-103)

#### Environment Control
**Lines 23-28:**

The RPC URL, contract address, and wallet can be configured via environment variables:

```javascript
this.contractAddress = process.env.CONTRACT_ADDRESS || '0x9171Cf8E1d3c7EBf7bf8866CcD2c8C58512A3Be8';
const rpcUrl = process.env.RPC_URL || process.env.AVALANCHE_RPC || 'https://api.avax-test.network/ext/bc/C/rpc';
const privateKey = process.env.PLATFORM_PRIVATE_KEY || process.env.WALLET_PRIVATE_KEY;
```

---

## COMPLETE AUCTION PROCESSING FLOW

### 3. Main Processing Function: `processEndedAuctions()`

**File:** `/Users/abhishekkr./Developer/entagledBackend/src/services/AuctionCronService.js` (Lines 123-215)

This is the primary function called every 2 minutes:

#### Phase 1: Contract Scanning
**Lines 128-160:**

```
Step 1: Get current block number
  - Query blockchain for current block

Step 2: Get auction counter
  - Get total number of auctions created

Step 3: Scan all auctions
  For each auction (1 to totalAuctions):
    - Check if auction.ended is false (active)
    - Check if ended but not yet processed in database (auto_ended = false)
    - Add to activeAuctionIds list if needs processing
```

**Data accessed:**
- Smart contract method: `contract.auctionCounter()`
- Smart contract method: `contract.getAuction(auctionId)`
- Database table: `auctions` (check `auto_ended` flag)

#### Phase 2: Ready-to-End Detection
**Lines 168-197:**

```
For each active auction:
  Get auction data from contract
  Calculate: blocksRemaining = endBlock - currentBlock
  
  Decision logic:
  IF currentBlock >= endBlock AND !auction.ended:
    → Add to readyToEndAuctions (needs on-chain ending)
  ELSE IF auction.ended:
    → Add to readyToEndAuctions (needs database update)
  ELSE IF blocksRemaining <= 10:
    → Log as "ending soon" (informational)
  ELSE:
    → Log as still active
```

#### Phase 3: Process Ready Auctions
**Lines 207-210:**

```
For each auction ready to end:
  Call processSingleAuction(auctionId, auction)
```

---

### 4. Single Auction Processing: `processSingleAuction()`

**File:** `/Users/abhishekkr./Developer/entagledBackend/src/services/AuctionCronService.js` (Lines 220-278)

#### Step 1: Check for Known Problematic Auctions
**Lines 223-229:**

```javascript
const PROBLEMATIC_AUCTIONS = [35, 36];
if (PROBLEMATIC_AUCTIONS.includes(auctionId)) {
  logger.warn(`Auction ${auctionId}: Known problematic with "Token transfer failed"`);
  return; // Skip processing
}
```

**Purpose:** Avoid repeated failures on auctions with contract bugs.

#### Step 2: End Auction On-Chain
**Lines 236-248:**

```
IF auction.ended is false:
  Call endAuctionOnChain(auctionId)
    ├─ Validate wallet exists
    ├─ Call contract.endAuction(auctionId) transaction
    ├─ Wait for transaction receipt
    ├─ Check receipt.status === 1 (success)
    └─ Return receipt (or null if "Token transfer failed" error)

ELSE:
  Log that auction already ended on-chain, skip this step
```

#### Step 3: Get Updated Auction Data
**Lines 251-256:**

```
Retrieve updated auction data from contract
Check if NFT was minted:
  IF updatedAuction.nftTokenId > 0:
    Log "NFT minted successfully"
```

**Data retrieved:**
- NFT token ID (only available after endAuction() is called)

#### Step 4: Get User Data
**Lines 258-262:**

```
Query database for creator user:
  SELECT * FROM users WHERE wallet_address = auction.host

Query database for winner user (if exists):
  IF auction.highestBidder != ZeroAddress:
    SELECT * FROM users WHERE wallet_address = auction.highestBidder
```

**Tables accessed:**
- `users` table (para_user_id, display_name, email, wallet_address)

#### Step 5: Update Database
**Lines 265-267:**

```
Call updateAuctionInDatabase(auctionId, updatedAuction, null)
```

**Note:** Meeting is created ON-DEMAND when winner burns NFT (not during cron).

---

### 5. On-Chain Ending: `endAuctionOnChain()`

**File:** `/Users/abhishekkr./Developer/entagledBackend/src/services/AuctionCronService.js` (Lines 283-321)

#### Transaction Execution
**Lines 288-306:**

```javascript
// Send transaction to contract
const tx = await this.contract.endAuction(auctionId);
logger.info(`Transaction submitted: ${tx.hash}`);

// Wait for confirmation
const receipt = await tx.wait();

// Verify success
if (receipt.status === 1) {
  logger.info(`Auction ${auctionId} ended successfully!`);
  return receipt;
}
```

#### Error Handling
**Lines 307-320:**

```
IF error.message includes "Token transfer failed":
  → This is a known smart contract bug
  → Log warning
  → Return null (skip further processing)
ELSE:
  → Throw error for other types of failures
```

---

### 6. Database Update: `updateAuctionInDatabase()`

**File:** `/Users/abhishekkr./Developer/entagledBackend/src/services/AuctionCronService.js` (Lines 392-428)

#### Auction Table Update
**Lines 395-405:**

```sql
UPDATE auctions 
SET 
  nft_token_id = $1,           -- NFT token ID from contract
  jitsi_room_id = $2,          -- Meeting room ID (currently null)
  auto_ended = TRUE            -- Mark as auto-processed
WHERE id = $3
```

**Data updated:**
- `nft_token_id`: Integer ID of minted NFT
- `jitsi_room_id`: Placeholder for meeting room (set to NULL)
- `auto_ended`: Set to TRUE to mark processed

**Tables modified:**
- `auctions` table

#### Meeting Creation (Currently Skipped)
**Lines 407-422:**

Currently, the code passes `meeting = null`, so no meeting is created during the cron job:

```javascript
// Insert meeting record if meeting was created
if (meeting && meeting.success) {
  // This code doesn't execute in current flow
  await pool.query(`
    INSERT INTO meetings (...)
  `);
}
```

**Note:** Meetings are now created on-demand when the winner burns the NFT (see MeetingService.joinGatedMeeting).

---

## DATABASE TABLES INVOLVED

### 1. Auctions Table
**File:** `/Users/abhishekkr./Developer/entagledBackend/database/schema.sql` (Lines 15-30)

```sql
CREATE TABLE auctions (
  id INTEGER PRIMARY KEY,
  contract_address VARCHAR(42) NOT NULL,
  creator_para_id VARCHAR(255) NOT NULL,
  creator_wallet VARCHAR(42) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  metadata_ipfs VARCHAR(255),
  meeting_duration INTEGER DEFAULT 60,
  nft_token_id INTEGER,                    -- ← CRON UPDATES THIS
  jitsi_room_id VARCHAR(255),              -- ← CRON UPDATES THIS
  auto_ended BOOLEAN DEFAULT FALSE,        -- ← CRON SETS TO TRUE
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (creator_wallet) REFERENCES users(wallet_address)
);
```

**Columns modified by cron:**
- `nft_token_id`: Updated with NFT token ID after contract.endAuction()
- `jitsi_room_id`: Updated with meeting room ID (currently NULL)
- `auto_ended`: Set to TRUE to indicate processed by cron

### 2. Users Table
**File:** `/Users/abhishekkr./Developer/entagledBackend/database/schema.sql` (Lines 2-13)

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  para_user_id VARCHAR(255) UNIQUE NOT NULL,  -- ← CRON READS THIS
  wallet_address VARCHAR(42) UNIQUE,          -- ← CRON READS THIS
  email VARCHAR(255),                         -- ← CRON READS THIS
  auth_type VARCHAR(50),
  oauth_method VARCHAR(50),
  display_name VARCHAR(255),                  -- ← CRON READS THIS
  profile_image TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Columns read by cron:**
- `para_user_id`: User ID for creator and winner
- `wallet_address`: To match auction host and highest bidder
- `display_name`: For meeting creation
- `email`: For meeting creation

**Operations:**
- SELECT to get creator and winner data

### 3. Meetings Table
**File:** `/Users/abhishekkr./Developer/entagledBackend/database/schema.sql` (Lines 32-45)

```sql
CREATE TABLE meetings (
  id SERIAL PRIMARY KEY,
  auction_id INTEGER NOT NULL,             -- ← WOULD BE SET BY CRON
  jitsi_room_id VARCHAR(255) NOT NULL,
  jitsi_room_config JSONB,                 -- Stores NFT gating info
  creator_access_token TEXT NOT NULL,
  winner_access_token TEXT NOT NULL,
  room_url TEXT NOT NULL,
  scheduled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (auction_id) REFERENCES auctions(id)
);
```

**Status:** Currently NOT written to by cron (meetings created on-demand during NFT burn).

### 4. Meeting Access Logs Table
**File:** `/Users/abhishekkr./Developer/entagledBackend/database/schema.sql` (Lines 47-59)

```sql
CREATE TABLE meeting_access_logs (
  id SERIAL PRIMARY KEY,
  auction_id INTEGER NOT NULL,
  user_para_id VARCHAR(255) NOT NULL,
  wallet_address VARCHAR(42) NOT NULL,
  nft_token_id INTEGER,
  transaction_hash VARCHAR(66),           -- Burn transaction hash
  lit_gate_pass_hash VARCHAR(66),
  access_method VARCHAR(50) DEFAULT 'nft_burn_lit',
  accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (auction_id) REFERENCES auctions(id)
);
```

**Status:** Updated when user burns NFT to access meeting (not by cron).

---

## SERVICES AND UTILITIES USED

### 1. Contract Service
**File:** `/Users/abhishekkr./Developer/entagledBackend/src/services/ContractService.js`

Used to interact with the smart contract:

```javascript
// Methods used by cron:
- contract.auctionCounter()        // Get total auctions
- contract.getAuction(auctionId)   // Get auction details
- contract.endAuction(auctionId)   // End auction on-chain
- provider.getBlockNumber()        // Get current block
```

### 2. Meeting Service
**File:** `/Users/abhishekkr./Developer/entagledBackend/src/services/MeetingService.js`

Handles NFT-gated meeting creation:

```javascript
// Methods called indirectly:
- createGatedMeeting()  // Would be called with NFT contract/token ID
- joinGatedMeeting()    // Verifies NFT burn and grants access
```

**Note:** Currently NOT called by cron. Meetings created on-demand when user burns NFT.

### 3. Logger
**File:** `/Users/abhishekkr./Developer/entagledBackend/src/utils/logger.js`

Winston-based logging to:
- Console (development)
- `logs/error.log` (errors only)
- `logs/combined.log` (all logs)

---

## DATA FLOW DIAGRAM

```
EVERY 2 MINUTES:
│
├─→ Get current block number
│
├─→ Get auction counter from contract
│
├─→ FOR EACH AUCTION (1 to counter):
│   ├─→ Check if auction.ended
│   ├─→ Check database auto_ended flag
│   └─→ Add to activeAuctionIds if needs processing
│
├─→ FOR EACH ACTIVE AUCTION:
│   ├─→ Get auction data
│   ├─→ Check if currentBlock >= endBlock
│   └─→ Add to readyToEndAuctions if ready
│
└─→ FOR EACH READY AUCTION:
    ├─→ Check if problematic (skip if yes)
    │
    ├─→ IF not ended on-chain:
    │   ├─→ Send endAuction() transaction
    │   ├─→ Wait for receipt
    │   └─→ Handle "Token transfer failed" error
    │
    ├─→ Get updated auction data (including nftTokenId)
    │
    ├─→ Query database for creator and winner users
    │
    └─→ Update auctions table:
        ├─→ nft_token_id = contract_nftTokenId
        ├─→ jitsi_room_id = null (set later on-demand)
        └─→ auto_ended = true
```

---

## KEY DATA UPDATES

### What Gets Updated

1. **Auctions Table:**
   - `nft_token_id`: The NFT minted for auction winner
   - `jitsi_room_id`: Meeting room ID (currently null)
   - `auto_ended`: Marked as TRUE

2. **No direct inserts** to:
   - `meetings` table (created on-demand)
   - `meeting_access_logs` (created when user accesses meeting)
   - `users` table (no updates)

### Why Each Update Matters

| Column | Purpose | When Set |
|--------|---------|----------|
| `nft_token_id` | Links NFT to auction for verification | After endAuction() succeeds |
| `jitsi_room_id` | Reference to meeting (currently unused) | Would be set during meeting creation |
| `auto_ended` | Marks auction as processed by cron | When all processing completes |

---

## ERROR HANDLING

### Known Issues

1. **Problematic Auctions [35, 36]:**
   - Error: "Token transfer failed"
   - Cause: Smart contract bug
   - Action: Hardcoded to skip these auctions
   - Resolution: Requires contract redeployment

2. **Timeout Handling:**
   - If cron job takes too long, next iteration is skipped
   - Prevents overlapping executions

```javascript
if (this.isRunning) {
  logger.warn('Previous auction check still running, skipping this cycle');
  return;
}
```

### Error Scenarios

| Scenario | Action | Result |
|----------|--------|--------|
| Transaction fails (not token transfer) | Throw error | Logged, next cycle retries |
| Token transfer fails | Log warning, return null | Skip rest of processing |
| Database error | Log error | Auction not marked as auto_ended |
| User not found | Return null | Continue without user data |

---

## CRON INTERVAL CONFIGURATION

### Environment Variables

```bash
# In .env or .env.production:
AUCTION_CHECK_INTERVAL=*/2 * * * *    # Every 2 minutes (default)
CONTRACT_ADDRESS=0x...                # Smart contract address
RPC_URL=https://...                   # Blockchain RPC endpoint
PLATFORM_PRIVATE_KEY=0x...            # Wallet for signing transactions
```

### Cron Expression Format

`*/2 * * * *` = `*/[minute] [hour] [day] [month] [day-of-week]`

- `*/2` = Every 2 minutes
- `*` = Every hour
- `*` = Every day
- `*` = Every month
- `*` = Every day of week

---

## LIFECYCLE EXAMPLE

### Complete Auction → Meeting Flow

```
HOUR 0: Auction Created
├─ Smart contract: auctionCounter incremented
├─ Database: Auction inserted
└─ Schedule: endBlock set to block N

HOUR 1: Auction Active
├─ Cron runs every 2 minutes
├─ Checks: currentBlock < endBlock
└─ Result: No action

HOUR 2: Auction Ends (Block N reached)
├─ Cron detects: currentBlock >= endBlock
├─ Cron runs endAuction() on-chain
├─ Smart contract:
│  ├─ Transfers funds
│  ├─ Mints NFT to winner
│  ├─ Sets auction.ended = true
│  └─ Returns nftTokenId
├─ Database UPDATE auctions SET:
│  ├─ nft_token_id = minted_nft_id
│  ├─ auto_ended = true
│  └─ jitsi_room_id = null
└─ Time: ~2-4 minutes after block N

HOUR 3: Winner Burns NFT
├─ User calls: POST /api/meetings/burn-nft
├─ MeetingService.joinGatedMeeting():
│  ├─ Verifies NFT burn transaction
│  ├─ Checks meeting exists (from auctions table)
│  ├─ Logs access in meeting_access_logs
│  └─ Generates meeting token
└─ Result: User can join Jitsi meeting
```

---

## SUMMARY TABLE

| Aspect | Details |
|--------|---------|
| **Cron Library** | node-cron v3.0.3 |
| **Default Frequency** | Every 2 minutes |
| **Schedule Expression** | `*/2 * * * *` |
| **Trigger** | Server startup + configurable interval |
| **Primary Function** | `processEndedAuctions()` |
| **Secondary Functions** | `processSingleAuction()`, `endAuctionOnChain()`, `updateAuctionInDatabase()` |
| **Tables Read** | auctions, users |
| **Tables Written** | auctions |
| **Tables Not Written** | meetings (created on-demand), meeting_access_logs (created when accessing) |
| **Blockchain Interaction** | Reads auction data, calls endAuction() transaction |
| **Error Handling** | Skips known problematic auctions, logs errors, prevents overlapping runs |
| **Initial Delay** | 5 seconds after startup |
| **Lock Mechanism** | `isRunning` flag prevents concurrent execution |

---

## FILE LOCATIONS AND LINE NUMBERS

### Main Cron Implementation
- **AuctionCronService.js**: `/Users/abhishekkr./Developer/entagledBackend/src/services/AuctionCronService.js` (1-477)
  - Constructor: Lines 8-18
  - Initialize: Lines 20-52
  - Start: Lines 57-107
  - processEndedAuctions: Lines 123-215
  - processSingleAuction: Lines 220-278
  - endAuctionOnChain: Lines 283-321
  - updateAuctionInDatabase: Lines 392-428

### Cron Script
- **auctionCron.js**: `/Users/abhishekkr./Developer/entagledBackend/src/scripts/auctionCron.js` (1-62)
  - AuctionCron class: Lines 7-48
  - Start method: Lines 27-47

### Server Integration
- **server.js**: `/Users/abhishekkr./Developer/entagledBackend/src/server.js` (118-123)
  - Cron initialization code

### Database Schema
- **schema.sql**: `/Users/abhishekkr./Developer/entagledBackend/database/schema.sql` (1-104)
  - Users table: Lines 2-13
  - Auctions table: Lines 15-30
  - Meetings table: Lines 32-45
  - Meeting access logs: Lines 47-59

### Configuration
- **database.js**: `/Users/abhishekkr./Developer/entagledBackend/src/config/database.js` (1-107)
- **package.json**: `/Users/abhishekkr./Developer/entagledBackend/package.json` (31)
  - node-cron dependency
- **ecosystem.production.config.js**: Lines 48-49
  - PM2 cron restart (daily at 3 AM)

### Related Services
- **MeetingService.js**: `/Users/abhishekkr./Developer/entagledBackend/src/services/MeetingService.js` (1-300+)
  - createGatedMeeting: Lines 24-127
  - joinGatedMeeting: Lines 236-449
- **ContractService.js**: `/Users/abhishekkr./Developer/entagledBackend/src/services/ContractService.js` (1-100+)

### Utilities
- **logger.js**: `/Users/abhishekkr./Developer/entagledBackend/src/utils/logger.js` (1-50)

