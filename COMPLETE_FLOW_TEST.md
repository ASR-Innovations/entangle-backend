# 🎯 COMPLETE MEETING FLOW TEST GUIDE

## System Status ✅
- Server: Running on port 5009
- Database: Connected, auction #1 created (maps to blockchain auction #5)
- Blockchain: Auction #5 ended, NFT Token #1 minted to winner
- Winner: 0x0CB9D7191C9dD544a9994DCE38211bFb7097307E

---

## Authentication Flow 🔐

### 1. Para Auth (Basic Login - NO Wallet)
```bash
curl -X POST http://localhost:5009/api/auth/para-auth \
  -H "Content-Type: application/json" \
  -d '{"verificationToken": "1db0ccca-fcb4-42ed-8b15-1c4dbf9d95b8"}'
```
**What it does:**
- Verifies Para token with Para SDK
- Creates/updates user in `users` table (NO wallet_address)
- Returns JWT for basic operations
- User ID stored in token

### 2. Import Session (Full Login - WITH Wallet)
```bash
curl -X POST http://localhost:5009/api/auth/import-session \
  -H "Content-Type: application/json" \
  -d '{
    "session": {
      "userId": "email_xyz",
      "walletAddress": "0xYOUR_WALLET",
      "displayName": "Your Name",
      "email": "you@example.com"
    }
  }'
```
**What it does:**
- Imports full Para session from frontend
- Updates user with `wallet_address` in `users` table
- Returns JWT with wallet operations enabled
- Required for blockchain transactions

---

## Complete Meeting Flow 🎬

### Step 1: Host Creates Meeting (After Auction Ends)

**Option A: Via Cron (Automatic)**
- Cron runs every 2 minutes
- Detects ended auctions on blockchain
- Creates Jitsi meeting
- Saves to `meetings` table
- Updates auction with `jitsi_room_id`

**Option B: Via API (Manual)**
```bash
# Get JWT token
TOKEN=$(curl -s -X POST http://localhost:5009/api/auth/para-auth \
  -H "Content-Type: application/json" \
  -d '{"verificationToken": "1db0ccca-fcb4-42ed-8b15-1c4dbf9d95b8"}' | jq -r '.token')

# Create simple meeting (for testing)
curl -X POST http://localhost:5009/api/meetings/create-simple \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "guestUserId": "winner_para_id",
    "meetingName": "Auction #5 Meeting",
    "duration": 60
  }'
```

**What gets saved:**
```sql
INSERT INTO meetings (
  auction_id,           -- Links to auction
  jitsi_room_id,        -- Unique room identifier
  creator_access_token, -- Host's JWT token
  winner_access_token,  -- "pending" until NFT burned
  room_url,             -- Base meeting URL
  expires_at            -- Meeting expiry time
);
```

### Step 2: Host Gets Meeting Access

```bash
# List user's meetings
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5009/api/meetings
```

**Returns:**
```json
{
  "success": true,
  "meetings": [
    {
      "id": 1,
      "auctionId": 1,
      "roomId": "auction-5-1727784000",
      "url": "https://8x8.vc/vpaas-xxx/auction-5-1727784000",
      "auctionTitle": "Strategy Session - Auction #5",
      "creatorName": "Auction Host"
    }
  ]
}
```

**Host joins immediately:**
- Host clicks meeting URL
- No NFT required
- Full moderator access

---

### Step 3: Winner Burns NFT for Access

**3.1 Check NFT Ownership**
```bash
curl http://localhost:5009/api/contract/nfts/0x0CB9D7191C9dD544a9994DCE38211bFb7097307E
```

**Returns:**
```json
{
  "success": true,
  "nfts": [
    {
      "tokenId": "1",
      "auctionId": "5",
      "canBurnForMeeting": true
    }
  ]
}
```

**3.2 Check if Can Burn**
```bash
curl http://localhost:5009/api/contract/can-burn/1/0x0CB9D7191C9dD544a9994DCE38211bFb7097307E
```

**3.3 Burn NFT (Frontend calls contract)**
```javascript
// Frontend code
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
const tx = await contract.burnNFTForMeeting(1);
await tx.wait();

// Returns auctionId
```

**3.4 Request Meeting Access (Backend API)**
```bash
# After burning NFT on blockchain
curl -X POST http://localhost:5009/api/meetings/join-gated/auction-5-1727784000 \
  -H "Authorization: Bearer $WINNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nftProof": {
      "tokenId": "1",
      "burnTxHash": "0xBURN_TX_HASH"
    }
  }'
```

**What backend does:**
1. Verifies NFT was burned (checks blockchain)
2. Verifies user was the burner
3. Gets auction ID from NFT metadata
4. Finds meeting for that auction
5. Generates attendee JWT token
6. Returns meeting access URL

**Returns:**
```json
{
  "success": true,
  "meeting": {
    "roomId": "auction-5-1727784000",
    "auctionTitle": "Strategy Session - Auction #5",
    "duration": 60,
    "expiresAt": "2025-10-01T20:00:00Z"
  },
  "access": {
    "url": "https://8x8.vc/vpaas-xxx/auction-5-1727784000?jwt=ATTENDEE_TOKEN",
    "role": "participant",
    "validUntil": "2025-10-01T20:00:00Z"
  },
  "message": "NFT burned successfully. You can now join the meeting."
}
```

**Logs saved:**
```sql
INSERT INTO meeting_access_logs (
  auction_id,
  user_para_id,
  wallet_address,
  nft_token_id,
  transaction_hash,
  access_method
);
```

---

## Testing with Postman 📮

1. Import collection: `Entangle_Backend_APIs.postman_collection.json`
2. Set variables:
   - `BASE_URL`: http://localhost:5009
   - `AUTH_TOKEN`: (auto-filled after para-auth)

3. Run in order:
   - 1.1 Para Auth → Copy token
   - 3.1 Create Simple Meeting
   - 3.5 List User's Meetings
   - 4.1 Get User NFTs (use winner's address)
   - 4.3 Check Can Burn NFT
   - 3.3 Join Gated Meeting (after burning NFT)

---

## Current Test Data 📊

**Database Auction #1:**
- Title: "Strategy Session - Auction #5"
- Creator: 0x6daa02F03f05D7330ec10F12E66Ac3db0Cd7718d
- NFT Token ID: 1
- Jitsi Room: (will be created)

**Blockchain Auction #5:**
- Ended: true
- Winner: 0x0CB9D7191C9dD544a9994DCE38211bFb7097307E
- NFT Minted: Token #1
- Meeting Scheduled: false

**NFT Token #1:**
- Owner: 0x0CB9D7191C9dD544a9994DCE38211bFb7097307E
- Can be burned: true
- Not yet used: true

---

## Quick Test Commands 🚀

```bash
# Save these for quick testing
export BASE_URL="http://localhost:5009"

# 1. Get auth token
export TOKEN=$(curl -s -X POST $BASE_URL/api/auth/para-auth \
  -H "Content-Type: application/json" \
  -d '{"verificationToken": "1db0ccca-fcb4-42ed-8b15-1c4dbf9d95b8"}' | jq -r '.token')

# 2. Create meeting
curl -X POST $BASE_URL/api/meetings/create-simple \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"guestUserId": "winner", "meetingName": "Test Meeting", "duration": 60}' | jq '.'

# 3. List meetings
curl -H "Authorization: Bearer $TOKEN" $BASE_URL/api/meetings | jq '.'

# 4. Check NFTs
curl $BASE_URL/api/contract/nfts/0x0CB9D7191C9dD544a9994DCE38211bFb7097307E | jq '.'

# 5. Check can burn
curl $BASE_URL/api/contract/can-burn/1/0x0CB9D7191C9dD544a9994DCE38211bFb7097307E | jq '.'
```

---

## What's Working ✅

- ✅ Para authentication
- ✅ Database connections
- ✅ Auction creation & storage
- ✅ Cron auction processing
- ✅ NFT minting & transfer
- ✅ NFT ownership verification
- ✅ Jitsi meeting creation
- ✅ Meeting URL generation

## What Needs Testing 🧪

- ⏳ Meeting saved to database
- ⏳ Host meeting access API
- ⏳ NFT burning verification
- ⏳ Attendee meeting access after burn
- ⏳ Both host and attendee can join meeting

---

## Next Steps 📝

1. **Create meeting for auction #1** (manually or via API)
2. **Save meeting to database**
3. **Test host can access meeting**
4. **Test NFT burn verification**
5. **Test attendee gets access after burn**
6. **Test both can join Jitsi meeting**

**All APIs ready for frontend integration!**
