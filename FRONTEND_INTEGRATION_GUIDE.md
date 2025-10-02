# 🎯 FRONTEND INTEGRATION GUIDE

## Critical Finding: Auction #14 ⚠️

**Blockchain Status:**
- ✅ Auction #14 exists and ended
- ✅ Winner: 0x0CB9D7191C9dD544a9994DCE38211bFb7097307E
- ✅ NFT Token #6 minted
- ✅ Meeting scheduled on-chain: true

**Backend Status:**
- ❌ NOT in database
- ❌ NO meeting link created
- ❌ Backend can't process it

**Root Cause:** Frontend never called `POST /api/auctions/created` after creating auction on blockchain.

---

## ✅ Complete End-to-End Flow

### 1. USER AUTHENTICATION

```javascript
// Step 1: Para verification (no wallet)
const response1 = await fetch('/api/auth/para-auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ verificationToken: PARA_TOKEN })
});
const { token } = await response1.json();

// Step 2: Import session (with wallet) - REQUIRED for blockchain ops
const session = await para.exportSession();
const response2 = await fetch('/api/auth/import-session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ session })
});
const { token: fullToken } = await response2.json();

// Use fullToken for all subsequent requests
```

---

### 2. HOST CREATES AUCTION

```javascript
// Step 1: Create auction on blockchain
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
const tx = await contract.createAuction(
  hostAddress,
  twitterId,
  duration,
  reservePrice,
  metadataIPFS,
  meetingDuration,
  sellerName,
  eventName,
  eventDate,
  eventStartTime,
  eventEndTime,
  profilePicture
);
const receipt = await tx.wait();

// Step 2: IMMEDIATELY record in backend database
// THIS IS CRITICAL - WITHOUT THIS, BACKEND CAN'T CREATE MEETING!
const response = await fetch('/api/auctions/created', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    transactionHash: receipt.transactionHash,
    title: 'Meeting Title',
    description: 'Description',
    duration: duration,
    reservePrice: reservePrice,
    meetingDuration: 60,
    creatorWallet: hostAddress
  })
});

// Now backend knows about auction and cron can process it
```

**Why this is critical:**
- Cron checks database for auctions to process
- If auction not in DB → cron ignores it
- No meeting created → winner can't access

---

### 3. USER BIDS (Frontend handles this via blockchain)

```javascript
const tx = await contract.placeBid(auctionId, { value: bidAmount });
await tx.wait();

// No backend API needed - all on blockchain
```

---

### 4. AUCTION ENDS (Automatic via Cron)

**Cron runs every 2 minutes:**
1. Checks all auctions in database
2. Compares with blockchain current block
3. If `endBlock < currentBlock` → processes auction
4. Calls `contract.endAuction(auctionId)`
5. NFT minted to winner automatically
6. Creates Jitsi meeting
7. Saves meeting to database

**No frontend action needed here!**

---

### 5. HOST GETS MEETING LINK

```javascript
// Get all meetings for auctions you created
const response = await fetch('/api/meetings', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { meetings } = await response.json();

// meetings = [
//   {
//     id: 1,
//     auctionId: 5,
//     roomId: 'auction-5-1727784000',
//     url: 'https://8x8.vc/vpaas-xxx/auction-5-1727784000',
//     auctionTitle: 'Strategy Session',
//     expiresAt: '2025-10-01T20:00:00Z'
//   }
// ]

// Host can join immediately - no NFT required
window.open(meetings[0].url);
```

---

### 6. WINNER BURNS NFT & GETS ACCESS

```javascript
// Step 1: Check what NFTs winner owns
const response1 = await fetch(`/api/contract/nfts/${winnerWallet}`);
const { nfts } = await response1.json();
// nfts = { tokenIds: [1, 2, 6], auctionIds: [5, 6, 14] }

// Step 2: Check if can burn NFT (before actually burning)
const response2 = await fetch(`/api/contract/can-burn/${tokenId}/${winnerWallet}`);
const { canBurn } = await response2.json();

if (!canBurn.canBurn) {
  alert(canBurn.reason); // "Not the owner" or "Already used" etc
  return;
}

// Step 3: Burn NFT on blockchain
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
const tx = await contract.burnNFTForMeeting(tokenId);
const receipt = await tx.wait();

// Step 4: Request meeting access from backend
const response3 = await fetch(`/api/meetings/join-gated/${roomId}`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${winnerToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    nftProof: {
      tokenId: tokenId,
      burnTxHash: receipt.transactionHash
    }
  })
});

const { access } = await response3.json();
// access = {
//   url: 'https://8x8.vc/vpaas-xxx/auction-5-1727784000?jwt=TOKEN',
//   role: 'participant',
//   validUntil: '2025-10-01T20:00:00Z'
// }

// Winner can now join meeting
window.open(access.url);
```

---

## 📋 Essential APIs (13 Total)

### Authentication (2)
1. `POST /api/auth/para-auth` - Login with verification token
2. `POST /api/auth/import-session` - Add wallet access

### Auctions (4)
3. `POST /api/auctions/created` - **CRITICAL:** Record after blockchain creation
4. `GET /api/auctions/active` - List active auctions
5. `GET /api/auctions/:id` - Get auction details
6. `GET /api/auctions/user/created` - Get my auctions

### NFT & Access (3)
7. `GET /api/contract/nfts/:wallet` - Get user's NFTs
8. `GET /api/contract/can-burn/:tokenId/:wallet` - Check before burning
9. `POST /api/meetings/join-gated/:roomId` - Get access after burn

### Meetings (2)
10. `GET /api/meetings` - Host gets meeting links
11. `GET /api/meetings/:roomId` - Get meeting details

### Dashboard (2)
12. `GET /api/contract/dashboard/host/:wallet` - Host dashboard
13. `GET /api/contract/dashboard/user/:wallet` - User dashboard

---

## 🎬 What Happens Behind the Scenes

### When Auction Ends:

**Blockchain (automatic):**
- `endAuction()` called
- Winner charged, host paid (minus 2.5% fee)
- NFT minted to winner
- Auction marked as ended

**Backend Cron (every 2 minutes):**
1. Queries database for ended auctions
2. For each ended auction:
   - Calls `contract.endAuction(id)` if not done
   - Gets auction data from blockchain
   - Creates Jitsi meeting room
   - Generates host access token
   - Saves meeting to `meetings` table
   - Updates auction with `jitsi_room_id`
   - Logs creation

**Database Records:**
```sql
-- meetings table
INSERT INTO meetings (
  auction_id,           -- Links to auction
  jitsi_room_id,        -- e.g., 'auction-5-1727784000'
  creator_access_token, -- Host's JWT
  winner_access_token,  -- 'pending_nft_burn'
  room_url,             -- Full Jitsi URL
  expires_at            -- Meeting expiry
);
```

---

## 🧪 Testing Checklist

- [ ] Para auth works and returns token
- [ ] Import session adds wallet address
- [ ] Create auction on blockchain
- [ ] **Call `POST /api/auctions/created` immediately**
- [ ] Verify auction in database: `SELECT * FROM auctions;`
- [ ] Wait for cron to process (max 2 minutes)
- [ ] Check meeting created: `SELECT * FROM meetings;`
- [ ] Host calls `GET /api/meetings` and gets link
- [ ] Winner checks NFTs: `GET /api/contract/nfts/:wallet`
- [ ] Winner checks can burn: `GET /api/contract/can-burn/:tokenId/:wallet`
- [ ] Winner burns NFT on blockchain
- [ ] Winner calls `POST /api/meetings/join-gated/:roomId`
- [ ] Both host and winner join Jitsi meeting

---

## 🚨 Common Issues

### Issue: Meeting not created
**Cause:** Auction not in database  
**Fix:** Always call `POST /api/auctions/created` after blockchain creation

### Issue: Winner can't access meeting
**Cause:** NFT not burned or meeting not found  
**Fix:** 
1. Verify NFT ownership: `GET /api/contract/nfts/:wallet`
2. Check can burn: `GET /api/contract/can-burn/:tokenId/:wallet`
3. Burn NFT on blockchain first
4. Then call join-gated API

### Issue: "Auction not found" error
**Cause:** Backend database missing auction record  
**Fix:** Record auction via API immediately after blockchain creation

---

## 📦 Postman Collection

Import: `Entangle_Frontend_APIs.postman_collection.json`

**Pre-filled variables:**
- `BASE_URL`: http://localhost:5009
- `PARA_VERIFICATION_TOKEN`: Your token
- `USER_WALLET`, `USER_EMAIL`, etc.

**Auto-saves AUTH_TOKEN** after login!

---

## ✅ Backend Status

**Working:**
- ✅ Para authentication
- ✅ Database & schema
- ✅ Cron service (processes auctions every 2 minutes)
- ✅ NFT minting & transfer
- ✅ Jitsi meeting creation
- ✅ NFT ownership verification
- ✅ Meeting link generation

**Ready for Production:**
All 13 essential APIs tested and working!

---

## 🎯 Next Steps for Frontend

1. **Import Postman collection** and test all APIs
2. **Implement auction creation** flow with `POST /api/auctions/created`
3. **Add meeting dashboard** for hosts (`GET /api/meetings`)
4. **Implement NFT burn flow** for winners
5. **Test complete end-to-end** with real auction

**Server is ready! Start integrating! 🚀**

