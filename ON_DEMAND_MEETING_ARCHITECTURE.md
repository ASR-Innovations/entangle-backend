# On-Demand Meeting Creation Architecture

## Overview
This document describes the new on-demand meeting creation system where meetings are created ONLY after the winner burns their NFT, preventing NFT resale before meeting access.

## Architecture Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AUCTION ENDS                                 │
│  (Cron Job processes auction every 2 minutes)                       │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 1: End Auction On-Chain                                       │
│  - Contract.endAuction(auctionId)                                   │
│  - NFT minted to winner                                             │
│  - NFT Token ID generated                                           │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 2: Update Database                                            │
│  - Set nft_token_id in auctions table                               │
│  - Set auto_ended = TRUE                                            │
│  - NO MEETING CREATED YET!                                          │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │   WINNER HAS NFT       │
                    │  Meeting NOT Created   │
                    └────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
                    ▼                         ▼
        ┌─────────────────────┐   ┌──────────────────────┐
        │  WINNER CHECKS      │   │  CREATOR CHECKS      │
        │  Access             │   │  Access              │
        │                     │   │                      │
        │ POST /meetings/     │   │ POST /meetings/      │
        │   access-winner     │   │   access-creator     │
        └──────────┬──────────┘   └──────────┬───────────┘
                   │                         │
                   ▼                         ▼
        ┌─────────────────────┐   ┌──────────────────────┐
        │ Response:           │   │ Response:            │
        │ requiresBurn: true  │   │ meetingExists: false │
        │ nftTokenId: 123     │   │ message: "Wait for   │
        │                     │   │  winner to burn"     │
        └──────────┬──────────┘   └──────────────────────┘
                   │
                   ▼
        ┌─────────────────────┐
        │  WINNER BURNS NFT   │
        │  (Frontend calls    │
        │   contract.burn())  │
        └──────────┬──────────┘
                   │
                   ▼
        ┌─────────────────────────────────────────┐
        │  POST /meetings/burn-nft-access         │
        │                                         │
        │  1. Verify burn transaction             │
        │  2. Check NFTBurnedForMeeting event     │
        │  3. Prevent replay attacks              │
        │  4. CREATE MEETING (JitsiService)       │
        │  5. Save to database                    │
        │  6. Return meeting URL & token          │
        └──────────┬──────────────────────────────┘
                   │
                   ▼
        ┌─────────────────────────────────────────┐
        │  MEETING CREATED!                       │
        │  - Jitsi room created                   │
        │  - Creator token generated              │
        │  - Winner token generated               │
        │  - Saved in meetings table              │
        │  - Access logged                        │
        └─────────────────────────────────────────┘
                   │
                   ▼
        ┌─────────────────────────────────────────┐
        │  BOTH USERS CAN ACCESS                  │
        │  - Winner: Has meeting URL & token      │
        │  - Creator: Can call access-creator     │
        │            to get meeting URL & token   │
        └─────────────────────────────────────────┘
```

## Key Changes

### 1. AuctionCronService.js (Line 264-267)
**Before:**
```javascript
// Create meeting automatically
const meeting = await this.createMeetingForAuction({
  auctionId, auction, creatorData, winnerData
});
await this.updateAuctionInDatabase(auctionId, updatedAuction, meeting);
```

**After:**
```javascript
// DO NOT create meeting - will be created on-demand
logger.info(`📝 Step 4: Updating auction in database...`);
logger.info(`⚠️  Meeting will be created ON-DEMAND when winner burns NFT`);
await this.updateAuctionInDatabase(auctionId, updatedAuction, null);
```

### 2. New Endpoints in meetings.js

#### POST /api/meetings/access-winner (Lines 427-537)
**Purpose**: Check if winner can access meeting or needs to burn NFT

**Request:**
```json
{
  "auctionId": 123
}
```

**Response:**
```json
{
  "requiresBurn": true,
  "nftTokenId": 123,
  "meetingExists": false,
  "message": "You must burn your NFT to access the meeting"
}
```

**Logic:**
1. Verify user is the winner (wallet_address matches highestBidder)
2. Check if meeting already exists in database
3. Verify NFT ownership via `contract.ownerOf(nftTokenId)`
4. Return burn requirement status

#### POST /api/meetings/burn-nft-access (Lines 543-724)
**Purpose**: Verify NFT burn and create meeting on-demand

**Request:**
```json
{
  "auctionId": 123,
  "burnTransactionHash": "0x..."
}
```

**Response:**
```json
{
  "success": true,
  "meeting": {
    "url": "https://8x8.vc/...",
    "token": "eyJhbGciOiJ...",
    "roomId": "auction-123-1234567890",
    "expiresAt": "2025-10-15T10:00:00.000Z"
  },
  "message": "Meeting created successfully"
}
```

**Logic:**
1. Get transaction receipt from blockchain
2. Verify transaction succeeded (status === 1)
3. Parse logs for `NFTBurnedForMeeting` event
4. Check event parameters match (auctionId, burner, nftTokenId)
5. **Prevent replay attacks**: Check transaction_hash not already used
6. **CREATE MEETING** via `JitsiService.createAuctionMeeting()`
7. Insert into `meetings` table
8. Log access in `meeting_access_logs`
9. Return meeting URL and token

#### POST /api/meetings/access-creator (Lines 730-810)
**Purpose**: Allow creator to access meeting (no burn required)

**Request:**
```json
{
  "auctionId": 123
}
```

**Response (if meeting exists):**
```json
{
  "success": true,
  "meeting": {
    "url": "https://8x8.vc/...",
    "token": "eyJhbGciOiJ...",
    "roomId": "auction-123-1234567890"
  }
}
```

**Response (if meeting not yet created):**
```json
{
  "success": false,
  "message": "Meeting will be created when winner burns NFT to access"
}
```

**Logic:**
1. Verify user is the auction creator
2. Check if meeting exists
3. If exists, return creator_access_token
4. If not, return waiting message

## Security Features

### 1. NFT Burn Verification
- Verifies actual blockchain transaction
- Checks for specific `NFTBurnedForMeeting` event
- Validates event parameters (auctionId, burner, nftTokenId)

### 2. Anti-Replay Attack Protection
- Stores transaction_hash in `meeting_access_logs`
- Prevents reusing same burn transaction multiple times
- Returns error if transaction already used

### 3. Authentication
- All endpoints require JWT token via `authenticateToken` middleware
- Verifies user identity matches auction participant

### 4. Authorization
- Winner check: Validates wallet_address matches blockchain highestBidder
- Creator check: Validates wallet_address matches auction creator
- NFT ownership: Verifies via `contract.ownerOf(nftTokenId)`

## Database Schema

### auctions table
```sql
id INTEGER PRIMARY KEY,
nft_token_id INTEGER,        -- Set when auction ends
jitsi_room_id VARCHAR(255),  -- NULL until meeting created
auto_ended BOOLEAN,          -- TRUE when cron processes auction
```

### meetings table (unchanged)
```sql
auction_id INTEGER NOT NULL,
jitsi_room_id VARCHAR(255) NOT NULL,
creator_access_token TEXT NOT NULL,
winner_access_token TEXT NOT NULL,  -- Still NOT NULL (created together)
room_url TEXT NOT NULL,
```

**Note:** `winner_access_token` remains NOT NULL because meeting is only created AFTER burn, at which point both tokens are generated simultaneously.

### meeting_access_logs table
```sql
id SERIAL PRIMARY KEY,
auction_id INTEGER NOT NULL,
user_para_id VARCHAR(255) NOT NULL,
wallet_address VARCHAR(42) NOT NULL,
nft_token_id INTEGER,
transaction_hash VARCHAR(66),  -- Used for anti-replay protection
access_method VARCHAR(50) DEFAULT 'nft_burn_lit',
accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

## Benefits

### 1. Prevents NFT Resale Before Meeting
- Winner MUST burn NFT to access meeting
- NFT becomes worthless after burn (can't be resold)
- Ensures only actual winner gets meeting access

### 2. Resource Efficiency
- Meetings only created when actually needed
- No wasted Jitsi rooms for auctions where winner never shows up
- Reduces JaaS API calls

### 3. Security
- Blockchain verification of burn event
- Anti-replay attack protection
- No pre-generated tokens that could leak

### 4. Flexibility
- Creator can check access anytime
- Winner controls when meeting is created
- Clear error messages guide users through process

## Frontend Integration

### Winner Flow
```javascript
// 1. Check access status
const checkResponse = await fetch('/api/meetings/access-winner', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ auctionId: 123 })
});

const { requiresBurn, nftTokenId } = await checkResponse.json();

if (requiresBurn) {
  // 2. Burn NFT via smart contract
  const tx = await contract.burnNFTForAccess(nftTokenId);
  await tx.wait();

  // 3. Create meeting by verifying burn
  const accessResponse = await fetch('/api/meetings/burn-nft-access', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      auctionId: 123,
      burnTransactionHash: tx.hash
    })
  });

  const { meeting } = await accessResponse.json();

  // 4. Redirect to meeting
  window.location.href = meeting.url;
}
```

### Creator Flow
```javascript
// Check if meeting exists
const response = await fetch('/api/meetings/access-creator', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ auctionId: 123 })
});

const data = await response.json();

if (data.success) {
  // Meeting exists, redirect to meeting
  window.location.href = data.meeting.url;
} else {
  // Show waiting message
  console.log(data.message); // "Meeting will be created when winner burns NFT"
}
```

## Testing Checklist

- [ ] Cron job ends auction without creating meeting
- [ ] Database updated with nft_token_id and auto_ended = TRUE
- [ ] Winner can check access and receives requiresBurn: true
- [ ] Winner burns NFT successfully
- [ ] Burn transaction verified on blockchain
- [ ] Meeting created dynamically after burn
- [ ] Creator can access meeting after it's created
- [ ] Replay attack prevention works (same transaction_hash rejected)
- [ ] Error messages are clear and helpful
- [ ] JWT authentication works on all endpoints
- [ ] Wallet address validation works correctly

## Known Issues

### Problematic Auctions (35, 36)
These auctions have smart contract bugs and are skipped by the cron service. See `AUCTION_35_36_RESOLUTION.md` for details.

---

**Last Updated**: 2025-10-15
**Status**: Implementation Complete
**Next Step**: End-to-end testing
