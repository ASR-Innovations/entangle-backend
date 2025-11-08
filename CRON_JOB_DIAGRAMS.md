# CRON JOB ARCHITECTURE DIAGRAMS

## 1. Component Interaction Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     SERVER STARTUP (server.js)                       │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 1: Database Connection (setupDatabase)                        │
│  ├─ Connect to PostgreSQL                                           │
│  └─ Create tables if needed (schema.sql)                           │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 2: Contract Service (getContractService)                     │
│  ├─ Connect to Blockchain RPC                                      │
│  ├─ Initialize ethers.js Contract instance                         │
│  └─ Set up wallet with PLATFORM_PRIVATE_KEY                        │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 3: AUCTION CRON SERVICE (getAuctionCronService)              │
│  ├─ Initialize AuctionCronService singleton                        │
│  ├─ Call start() method                                            │
│  │   ├─ Schedule cron job: '*/2 * * * *' (every 2 minutes)       │
│  │   ├─ Set scheduled: false (manual start)                        │
│  │   └─ Call job.start()                                           │
│  └─ Run initial check after 5 seconds                              │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 4: Jitsi Service & Routes                                     │
│  └─ Server ready to handle API requests                             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Cron Job Execution Timeline

```
Timeline of Cron Job Runs:

Server Start (t=0s)
│
├─ Initialize services (t=0-2s)
│
├─ First automatic cron check scheduled (t=5s)
│  └─ processEndedAuctions() executes
│
├─ Second cron execution (t=2:05)
│  └─ processEndedAuctions() executes
│
├─ Third cron execution (t=4:05)
│  └─ processEndedAuctions() executes
│
├─ Fourth cron execution (t=6:05)
│  └─ processEndedAuctions() executes
│
└─ ... repeats every 2 minutes indefinitely
```

**Key Points:**
- First run at +5s (Initial check)
- Subsequent runs every 2 minutes (120 seconds)
- Each run is independent and lock-protected (isRunning flag)

---

## 3. processEndedAuctions() Function Flow

```
CRON JOB TRIGGERED (every 2 minutes)
│
├─ Check if isRunning = true
│  └─ YES: Log warning and skip this cycle
│  └─ NO: Continue to next step
│
└─ Set isRunning = true
    │
    ├─ PHASE 1: SCAN CONTRACT
    │  │
    │  ├─ Get current block number
    │  │  └─ provider.getBlockNumber()
    │  │
    │  ├─ Get total auction count
    │  │  └─ contract.auctionCounter()
    │  │
    │  └─ Loop: i = 1 to totalAuctions
    │     │
    │     ├─ Get auction data
    │     │  └─ contract.getAuction(i)
    │     │
    │     ├─ Check if auction.ended = false
    │     │  └─ Add to activeAuctionIds
    │     │
    │     └─ Check if auction.ended = true but auto_ended = false
    │        └─ Add to activeAuctionIds (needs database update)
    │
    ├─ PHASE 2: CHECK READINESS
    │  │
    │  └─ For each activeAuctionId:
    │     │
    │     ├─ Get full auction data
    │     │
    │     ├─ Calculate: blocksRemaining = endBlock - currentBlock
    │     │
    │     ├─ IF blocksRemaining <= 0 (AUCTION ENDED):
    │     │  └─ Add to readyToEndAuctions
    │     │
    │     ├─ ELSE IF blocksRemaining <= 10 (ENDING SOON):
    │     │  └─ Log informational message (no action)
    │     │
    │     └─ ELSE (STILL ACTIVE):
    │        └─ Log active status (no action)
    │
    ├─ PHASE 3: PROCESS READY AUCTIONS
    │  │
    │  └─ For each readyToEndAuction:
    │     │
    │     ├─ Call processSingleAuction(auctionId, auction)
    │     │
    │     └─ (See next diagram for details)
    │
    └─ Set isRunning = false (Release lock)
        └─ Allow next cycle to run
```

---

## 4. processSingleAuction() Detailed Flow

```
processSingleAuction(auctionId, auction)
│
├─ STEP 1: CHECK PROBLEMATIC AUCTIONS
│  │
│  ├─ IS auctionId IN [35, 36]?
│  │  ├─ YES: Log warning, return early (SKIP PROCESSING)
│  │  └─ NO: Continue
│  │
│  └─ Reason: Known "Token transfer failed" bug in contract
│
├─ STEP 2: END AUCTION ON-CHAIN
│  │
│  ├─ Is auction.ended = true already?
│  │  ├─ YES: Log and skip this step
│  │  └─ NO: Continue to next step
│  │
│  └─ Call endAuctionOnChain(auctionId)
│     │
│     ├─ Validate wallet exists
│     │
│     ├─ Send transaction: contract.endAuction(auctionId)
│     │
│     ├─ Wait for receipt
│     │
│     ├─ IF receipt.status = 1 (SUCCESS):
│     │  └─ Log success, return receipt
│     │
│     ├─ CATCH "Token transfer failed" error:
│     │  ├─ Log known bug message
│     │  └─ Return null (skip further processing)
│     │
│     └─ CATCH other errors:
│        └─ Throw error (will retry next cycle)
│
├─ STEP 3: GET UPDATED AUCTION DATA
│  │
│  ├─ Call contract.getAuction(auctionId) AGAIN
│  │
│  └─ Check: updatedAuction.nftTokenId > 0
│     └─ NFT successfully minted to winner
│
├─ STEP 4: GET USER DATA FROM DATABASE
│  │
│  ├─ Query users table:
│  │  │
│  │  ├─ SELECT * FROM users WHERE wallet_address = auction.host
│  │  │  └─ Get creator user data (para_user_id, email, display_name)
│  │  │
│  │  └─ IF auction.highestBidder != ZeroAddress:
│  │     └─ SELECT * FROM users WHERE wallet_address = highestBidder
│  │        └─ Get winner user data
│  │
│  └─ If user not found: Continue with null value
│
├─ STEP 5: UPDATE DATABASE
│  │
│  └─ Call updateAuctionInDatabase(auctionId, updatedAuction, null)
│     │
│     ├─ UPDATE auctions SET:
│     │  ├─ nft_token_id = updatedAuction.nftTokenId
│     │  ├─ jitsi_room_id = null
│     │  └─ auto_ended = TRUE
│     │  WHERE id = auctionId
│     │
│     └─ IF meeting != null:
│        └─ INSERT into meetings table (currently doesn't happen)
│
└─ PROCESSING COMPLETE
   └─ Ready for next auction in queue
```

---

## 5. Database Update Operations

```
DATABASE OPERATIONS IN CRON JOB

Read Operations:
├─ auctions table
│  ├─ SELECT * FROM auctions WHERE id = $1
│  │  └─ Check auto_ended flag
│  │
│  └─ Purpose: Identify which auctions have been processed
│
└─ users table
   ├─ SELECT * FROM users WHERE wallet_address = $1
   │  └─ Get creator and winner user data
   │
   └─ Purpose: Fetch user details for meeting creation (future)

Write Operations:
└─ auctions table
   └─ UPDATE auctions SET
      ├─ nft_token_id = $1
      ├─ jitsi_room_id = $2
      ├─ auto_ended = TRUE
      WHERE id = $3
      
      └─ Purpose: Mark auction as processed and store NFT ID

No Write Operations (Currently):
├─ meetings table (created on-demand when user burns NFT)
├─ meeting_access_logs (created when user accesses meeting)
└─ users table (read-only for cron)
```

---

## 6. Blockchain Interaction Sequence

```
CRON JOB ←→ BLOCKCHAIN (Avalanche Network)

1. Read Operations (View Calls - No Gas Cost):
   │
   ├─ provider.getBlockNumber()
   │  └─ Current block number on chain
   │
   ├─ contract.auctionCounter()
   │  └─ Total number of auctions ever created
   │
   └─ contract.getAuction(auctionId) [repeated for each auction]
      └─ Full auction struct: {id, host, endBlock, highestBidder, ...}

2. Write Operations (State Change - Costs Gas):
   │
   └─ contract.endAuction(auctionId)
      ├─ Only if: currentBlock >= endBlock AND !auction.ended
      ├─ Wallet: Uses PLATFORM_PRIVATE_KEY
      ├─ Actions:
      │  ├─ Sets auction.ended = true
      │  ├─ Transfers funds from escrow
      │  ├─ Mints NFT to auction.highestBidder
      │  └─ Returns nftTokenId (stored in auction struct)
      ├─ Waits for: Transaction confirmation
      └─ Cost: ~50-150k gas (depending on refunds)

3. Error Handling:
   └─ IF error = "Token transfer failed":
      ├─ Known smart contract bug (auctions 35, 36)
      ├─ No retry
      └─ Requires manual intervention
```

---

## 7. Data Structure: Auction State Changes

```
AUCTION PROGRESSION DURING CRON JOB

On Smart Contract:
┌─────────────────────────────────────────┐
│ BEFORE endAuction() Transaction         │
├─────────────────────────────────────────┤
│ auction {                               │
│   id: 1,                                │
│   host: 0xCreatorAddress,              │
│   endBlock: 1000000,                   │
│   highestBid: 1.5 AVAX,                │
│   highestBidder: 0xWinnerAddress,      │
│   ended: false,          ←── Will change
│   nftTokenId: 0,         ←── Will change
│ }                                       │
└─────────────────────────────────────────┘
              │
              │ contract.endAuction(1)
              ▼
┌─────────────────────────────────────────┐
│ AFTER endAuction() Transaction          │
├─────────────────────────────────────────┤
│ auction {                               │
│   id: 1,                                │
│   host: 0xCreatorAddress,              │
│   endBlock: 1000000,                   │
│   highestBid: 1.5 AVAX,                │
│   highestBidder: 0xWinnerAddress,      │
│   ended: true,           ←── Changed!
│   nftTokenId: 12345,     ←── Changed!
│ }                                       │
│ ↓ Winner now owns NFT #12345            │
└─────────────────────────────────────────┘

In PostgreSQL Database:
┌─────────────────────────────────────────┐
│ BEFORE UPDATE                            │
├─────────────────────────────────────────┤
│ auctions {                              │
│   id: 1,                                │
│   nft_token_id: null,   ←── Will change
│   jitsi_room_id: null,                  │
│   auto_ended: false,    ←── Will change
│ }                                       │
└─────────────────────────────────────────┘
              │
              │ UPDATE auctions SET ...
              ▼
┌─────────────────────────────────────────┐
│ AFTER UPDATE                             │
├─────────────────────────────────────────┤
│ auctions {                              │
│   id: 1,                                │
│   nft_token_id: 12345,  ←── Changed!
│   jitsi_room_id: null,                  │
│   auto_ended: true,     ←── Changed!
│ }                                       │
│                                         │
│ Now auction is marked as processed      │
│ and NFT ID is stored for later use      │
└─────────────────────────────────────────┘
```

---

## 8. Error Handling Tree

```
Error Handling in Cron Job

processSingleAuction(auctionId)
│
├─ Error: Problematic Auction (35, 36)
│  ├─ Detection: Hardcoded check
│  ├─ Action: Skip processing immediately
│  ├─ Log: Warning message
│  └─ Resolution: Requires manual intervention
│
├─ Error in endAuctionOnChain()
│  │
│  ├─ "Token transfer failed"
│  │  ├─ Cause: Smart contract bug
│  │  ├─ Action: Return null
│  │  ├─ Skip: Remaining steps (no database update)
│  │  └─ Log: Detailed error message
│  │
│  └─ Other transaction error
│     ├─ Action: Throw error
│     ├─ Caught by: Outer try-catch
│     ├─ Log: Error details
│     ├─ Retry: Next cycle (automatic)
│     └─ Status: Auction remains unprocessed
│
├─ Error in updateAuctionInDatabase()
│  ├─ Detection: Database query fails
│  ├─ Action: Log error
│  ├─ Status: Auction not marked auto_ended
│  └─ Retry: Next cycle will attempt again
│
├─ Error: User not found in database
│  ├─ Action: Continue with null value
│  ├─ Impact: No creator/winner data available
│  └─ Status: Auction still marked auto_ended
│
└─ General Exception
   ├─ Caught by: processEndedAuctions() catch
   ├─ Action: Log error
   ├─ Impact: This batch of auctions may not process
   └─ Status: isRunning flag reset to false
```

---

## 9. Locking Mechanism

```
Cron Job Concurrency Control

Timeline Example (hypothetical slow run):

t=0s:   CRON JOB 1 starts
        isRunning = true
        ├─ Process auction 1 (5s)
        ├─ Process auction 2 (8s)
        └─ Process auction 3 (10s)

t=2m:   CRON JOB 2 triggered
        isRunning = true (still)
        ├─ Check: isRunning = true
        ├─ Log: "Previous check still running"
        └─ SKIP THIS CYCLE (exit immediately)

t=4m:   CRON JOB 3 triggered
        isRunning = true (still)
        ├─ Check: isRunning = true
        ├─ Log: "Previous check still running"
        └─ SKIP THIS CYCLE (exit immediately)

t=6m:   CRON JOB 1 completes
        ├─ Finished processing all auctions
        ├─ isRunning = false
        └─ Ready for next run

t=6m:   CRON JOB 4 triggered
        isRunning = false
        ├─ Check: isRunning = false
        ├─ Set: isRunning = true
        └─ Continue processing...

Purpose of Locking:
├─ Prevent concurrent execution
├─ Avoid double-processing auctions
├─ Reduce resource contention
└─ Prevent database conflicts
```

---

## 10. Complete Auction Lifecycle

```
AUCTION LIFECYCLE WITH CRON JOB

                    User Creates Auction
                           │
                           ▼
                  ┌──────────────────┐
                  │ CREATED State    │
                  ├──────────────────┤
                  │ auction.ended: F │
                  │ endBlock: N      │
                  │ nftTokenId: null │
                  │ auto_ended: F    │
                  └──────────────────┘
                           │
                     ┌─────┴─────┐
                     │ Users bid │
                     └─────┬─────┘
                           │
                     (Time passes)
                           │
                           ▼
                  ┌──────────────────┐
                  │ ACTIVE State     │
                  ├──────────────────┤
                  │ auction.ended: F │
                  │ endBlock: N      │
                  │ currentBlock < N │
                  └──────────────────┘
                           │
    [CRON CHECKS EVERY 2 MINUTES]
    ├─ currentBlock < endBlock?
    └─ Continue monitoring...
                           │
                    (Block N reached)
                           │
                           ▼
                  ┌──────────────────┐
                  │ ENDED State      │  ← CRON DETECTS THIS
                  ├──────────────────┤
                  │ auction.ended: T │
                  │ currentBlock>=N  │
                  │ auto_ended: F    │
                  └──────────────────┘
                           │
              [CRON CALLS endAuction()]
              ├─ Send transaction
              ├─ NFT minted to winner
              └─ Funds transferred
                           │
                           ▼
                  ┌──────────────────┐
                  │ PROCESSED State  │  ← DATABASE UPDATED
                  ├──────────────────┤
                  │ nftTokenId: XXXXX │  ← Updated by cron
                  │ auto_ended: T    │  ← Updated by cron
                  │ jitsi_room_id: null
                  └──────────────────┘
                           │
                      Winner has NFT
                           │
         [WINNER BURNS NFT to access meeting]
         ├─ POST /api/meetings/burn-nft
         ├─ Verify NFT ownership
         └─ Create meeting on-demand
                           │
                           ▼
                  ┌──────────────────┐
                  │ MEETING STARTED  │
                  ├──────────────────┤
                  │ Meeting created  │
                  │ Jitsi room live  │
                  │ NFT holder added │
                  │ Creator (host)   │
                  │ Winner (guest)   │
                  └──────────────────┘
```

---

## 11. Service Dependencies

```
AuctionCronService Dependencies

AuctionCronService
│
├─ node-cron
│  └─ Provides: cron scheduling capability
│     └─ Used for: schedule('*/2 * * * *', ...)
│
├─ ethers.js
│  ├─ Provides: JsonRpcProvider, Contract, Wallet
│  └─ Used for: Blockchain interaction
│
├─ PostgreSQL (via pg library)
│  ├─ Provides: Database connection pool
│  └─ Used for: auctions, users table queries
│
├─ ContractService
│  ├─ Provides: Contract instance and provider
│  └─ Used for: getAuction(), endAuction()
│
├─ Logger (Winston)
│  ├─ Provides: Logging functionality
│  └─ Used for: Info, warn, error logging
│
└─ MeetingService (called on-demand, not by cron)
   ├─ Provides: createGatedMeeting(), joinGatedMeeting()
   └─ Used for: NFT-gated meeting creation (future enhancement)
```

---

## 12. Configuration Propagation

```
Configuration Sources → AuctionCronService

Environment Variables (.env or system)
│
├─ CONTRACT_ADDRESS
│  └─ Smart contract address
│     └─ Used in: this.contractAddress = process.env.CONTRACT_ADDRESS
│
├─ RPC_URL (or AVALANCHE_RPC)
│  └─ Blockchain RPC endpoint
│     └─ Used in: const rpcUrl = process.env.RPC_URL || ...
│
├─ PLATFORM_PRIVATE_KEY (or WALLET_PRIVATE_KEY)
│  └─ Wallet private key for signing transactions
│     └─ Used in: this.wallet = new ethers.Wallet(privateKey, ...)
│
├─ AUCTION_CHECK_INTERVAL (optional)
│  └─ Cron expression (default: */2 * * * *)
│     └─ Used in: cron.schedule(cronExpression, ...)
│
├─ DATABASE_URL
│  └─ PostgreSQL connection string
│     └─ Used in: pool.query()
│
└─ LOG_LEVEL (optional)
   └─ Logger level (default: 'info')
      └─ Used in: logger.level = process.env.LOG_LEVEL
```

