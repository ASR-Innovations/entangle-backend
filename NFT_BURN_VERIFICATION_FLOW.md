# NFT Burn Verification Flow - Complete Documentation

## 🚨 CRITICAL SECURITY IMPLEMENTATION

This document explains how we verify that ONLY the actual NFT holder (auction winner) can access the meeting.

---

## Overview

**NO LIT PROTOCOL** - We use **on-chain verification** by checking the NFT burn transaction on the blockchain.

### Security Model:
1. Winner must **BURN the NFT** to access the meeting
2. Backend **verifies the burn transaction** on blockchain
3. Backend checks the **NFTBurnedForMeeting event** in transaction logs
4. Only after verification, meeting access token is generated
5. **Replay attacks prevented** - each burn can only be used once

---

## Complete Flow

### 1. Auction Ends → Meeting Created (Cron)

```javascript
// AuctionCronService runs every 2 minutes
async processSingleAuction(auctionId, auction) {
  // 1. End auction on-chain
  await endAuctionOnChain(auctionId);
  
  // 2. NFT is minted to winner (happens in endAuction() on contract)
  
  // 3. Get updated auction with NFT token ID
  const updatedAuction = await contract.getAuction(auctionId);
  const nftTokenId = updatedAuction.nftTokenId; // ✅ NFT minted!
  
  // 4. Create NFT-gated meeting
  const meeting = await meetingService.createGatedMeeting({
    hostUser: creatorData,
    nftContract: contractAddress,  // Auction contract (also mints NFTs)
    nftTokenId: nftTokenId,         // The minted NFT ID
    auctionId: auctionId,           // Link to auction
    duration: 60
  });
  
  // 5. Meeting stored with NFT info in database
  // jitsi_room_config = {
  //   nftContract: "0x...",
  //   nftTokenId: 123,
  //   gated: true
  // }
}
```

**Logs to watch for:**
```
🎬 ========== STEP 4: CREATING NFT-GATED MEETING ==========
📦 Auction ID: 1
👤 Creator: Alice (0x123...)
🏆 Winner: Bob (0x456...)
🎨 NFT Token ID: 123
⏱️  Duration: 60 minutes

✅ ========== MEETING CREATED SUCCESSFULLY ==========
🚪 Room ID: auction-1-1234567890
🔗 Room URL: https://8x8.vc/meeting-app/auction-1-1234567890
🎫 Host Token: GENERATED
🔐 Meeting is NFT-GATED: Only NFT holder can access
```

### 2. Winner Burns NFT (Frontend)

```javascript
// Frontend code
const burnNFT = async (tokenId) => {
  // Connect wallet
  const signer = await provider.getSigner();
  const contract = new ethers.Contract(contractAddress, ABI, signer);
  
  // Burn NFT for meeting access
  const tx = await contract.burnNFTForMeeting(tokenId, auctionId);
  const receipt = await tx.wait();
  
  console.log("NFT burned! TX:", receipt.hash);
  
  // Send burn TX hash to backend
  return receipt.hash;
};

// Then call API
const burnTxHash = await burnNFT(nftTokenId);

const response = await fetch('/api/meetings/join-gated/room-123', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${userToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    burnTransactionHash: burnTxHash  // ← Send TX hash
  })
});
```

### 3. Backend Verifies Burn Transaction (API)

**Endpoint:** `POST /api/meetings/join-gated/:roomId`

**Request Body:**
```json
{
  "burnTransactionHash": "0xabc123..."
}
```

**Verification Steps:**

#### Step 1: Validate Inputs
```javascript
✅ User has wallet address
✅ Burn transaction hash is valid format (0x + 64 hex chars)
```

#### Step 2: Get Meeting from Database
```javascript
const meeting = await pool.query(
  'SELECT * FROM meetings WHERE jitsi_room_id = $1',
  [roomId]
);

// Extract NFT info from room config
const roomConfig = JSON.parse(meeting.jitsi_room_config);
const nftContract = roomConfig.nftContract;  // Expected contract
const nftTokenId = roomConfig.nftTokenId;    // Expected token ID
const auctionId = meeting.auction_id;        // Expected auction
```

#### Step 3: Get Transaction Receipt from Blockchain
```javascript
const receipt = await provider.getTransactionReceipt(burnTransactionHash);

✅ Transaction exists
✅ Transaction succeeded (status === 1)
```

#### Step 4: Verify NFTBurnedForMeeting Event
```javascript
// Parse transaction logs for burn event
const iface = new ethers.Interface([
  'event NFTBurnedForMeeting(uint256 indexed tokenId, uint256 indexed auctionId, address indexed user)'
]);

for (const log of receipt.logs) {
  const parsed = iface.parseLog(log);
  
  if (parsed.name === 'NFTBurnedForMeeting') {
    // Check ALL fields match
    ✅ eventData.tokenId === nftTokenId
    ✅ eventData.auctionId === auctionId
    ✅ eventData.user === user.wallet_address
    
    // If ALL match → VERIFIED!
  }
}
```

#### Step 5: Prevent Replay Attacks
```javascript
// Check if this burn TX was already used
const existingAccess = await pool.query(
  'SELECT * FROM meeting_access_logs WHERE transaction_hash = $1',
  [burnTransactionHash]
);

if (existingAccess.rows.length > 0) {
  ❌ REJECT - This burn was already used!
}
```

#### Step 6: Log Verified Access
```javascript
await pool.query(`
  INSERT INTO meeting_access_logs (
    auction_id, user_para_id, wallet_address, nft_token_id,
    transaction_hash, access_method, accessed_at
  ) VALUES ($1, $2, $3, $4, $5, 'nft_burn_verified', NOW())
`, [...]);

// This prevents replay attacks
```

#### Step 7: Generate Meeting Access Token (JWT)
```javascript
// ONLY after all verification passes!
const attendeeToken = jitsi.generateToken({
  roomName: roomId,
  userId: user.para_user_id,
  userName: user.display_name,
  email: user.email,
  role: 'participant',
  expiresIn: 2  // 2 hours
});

// Return token + meeting URL
return {
  success: true,
  token: attendeeToken,
  url: meetingUrl,
  meeting: { ... }
};
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGc...",
  "url": "https://8x8.vc/meeting-app/room-123?jwt=eyJhbGc...",
  "meeting": {
    "roomId": "room-123",
    "expiresAt": "2025-10-01T12:00:00Z",
    "verified": true,
    "burnTxHash": "0xabc123...",
    "nftTokenId": 123,
    "auctionId": 1
  },
  "note": "NFT burn verified on blockchain. You can now join the meeting."
}
```

---

## Verification Logs

### Successful Verification:
```
🔐 ========== NFT BURN VERIFICATION STARTED ==========
👤 User ID: 5
👛 Wallet: 0x456...
🚪 Room ID: auction-1-1234567890
🔥 Burn TX Hash: 0xabc123...

📋 Step 1: Fetching meeting from database...
✅ Meeting found!
   📦 Auction ID: 1
   🎨 NFT Contract: 0x9171Cf8E...
   🎫 NFT Token ID: 123

🔍 Step 2: Verifying burn transaction on blockchain...
✅ Transaction receipt found and successful
   📍 Block: 12345
   ⛽ Gas Used: 85000

🔍 Step 3: Checking for NFTBurnedForMeeting event...
   📝 Scanning 3 logs in transaction...
🔥 NFTBurnedForMeeting Event Found!
   🎫 Token ID: 123
   📦 Auction ID: 1
   👛 User: 0x456...

🔍 Verification Check:
   Token ID Match: true (expected: 123, got: 123)
   Auction ID Match: true (expected: 1, got: 1)
   User Match: true (expected: 0x456..., got: 0x456...)
✅ ALL CHECKS PASSED! Burn event is valid!

🔍 Step 4: Checking for replay attacks...
✅ No replay attack detected - burn transaction is fresh

📝 Step 5: Logging verified access to database...
✅ Access logged successfully

🎟️  Step 6: Generating meeting access token...
✅ Meeting access token generated

🎉 ========== VERIFICATION SUCCESSFUL ==========
✅ User 5 (0x456...) verified and granted access to meeting auction-1-1234567890
🔥 Burned NFT Token ID 123 from Auction 1
📍 Burn TX: 0xabc123...
====================================================
```

### Failed Verification Examples:

#### Wrong Token ID:
```
❌ VERIFICATION FAILED: Valid NFT burn event not found in transaction
   Expected event with:
   - Token ID: 123
   - Auction ID: 1
   - User: 0x456...
```

#### Replay Attack:
```
❌ VERIFICATION FAILED: Burn transaction already used for access
   Previously used at: 2025-10-01 10:30:00
```

#### Invalid Transaction:
```
❌ VERIFICATION FAILED: Transaction failed on blockchain
```

---

## Security Features

### ✅ What We Verify:

1. **Transaction exists on blockchain** - Not fake
2. **Transaction succeeded** - Not failed/reverted
3. **NFTBurnedForMeeting event present** - Correct event
4. **Token ID matches** - Burned the correct NFT
5. **Auction ID matches** - For the correct auction/meeting
6. **User address matches** - Caller actually burned it
7. **Not used before** - Prevents replay attacks

### ✅ Attack Prevention:

1. **Fake Transaction** → Rejected (transaction not found on blockchain)
2. **Other User's Burn** → Rejected (user address mismatch)
3. **Wrong NFT Burned** → Rejected (token ID mismatch)
4. **Wrong Auction** → Rejected (auction ID mismatch)
5. **Replay Attack** → Rejected (transaction already used)
6. **Failed Transaction** → Rejected (status !== 1)

---

## Database Tables

### meetings
```sql
CREATE TABLE meetings (
  id SERIAL PRIMARY KEY,
  auction_id INTEGER,              -- Links to auction
  jitsi_room_id VARCHAR(255),      -- Room ID
  jitsi_room_config JSONB,         -- Contains NFT info:
                                    -- {
                                    --   nftContract: "0x...",
                                    --   nftTokenId: 123,
                                    --   policy: {...},
                                    --   gated: true
                                    -- }
  creator_access_token TEXT,       -- Host JWT token
  winner_access_token TEXT,        -- Winner JWT token (if generated)
  room_url TEXT,                   -- Meeting URL
  expires_at TIMESTAMP,            -- Meeting expiry
  created_at TIMESTAMP
);
```

### meeting_access_logs
```sql
CREATE TABLE meeting_access_logs (
  id SERIAL PRIMARY KEY,
  auction_id INTEGER,              -- Which auction
  user_para_id VARCHAR(255),       -- Which user
  wallet_address VARCHAR(42),      -- User's wallet
  nft_token_id INTEGER,            -- Which NFT burned
  transaction_hash VARCHAR(66),    -- Burn TX hash (prevents replay)
  access_method VARCHAR(50),       -- 'nft_burn_verified'
  accessed_at TIMESTAMP            -- When verified
);
```

---

## Frontend Integration

### Complete Flow Example:

```javascript
// 1. User clicks "Join Meeting" button
async function joinMeeting(roomId, nftTokenId, auctionId) {
  try {
    // Step 1: Burn NFT
    console.log("Burning NFT...");
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(contractAddress, ABI, signer);
    
    const tx = await contract.burnNFTForMeeting(nftTokenId, auctionId);
    console.log("Burn TX submitted:", tx.hash);
    
    const receipt = await tx.wait();
    console.log("NFT burned! Receipt:", receipt);
    
    // Step 2: Verify burn and get meeting access
    console.log("Verifying burn with backend...");
    const response = await fetch(`/api/meetings/join-gated/${roomId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        burnTransactionHash: receipt.hash
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log("✅ Verified! Meeting URL:", data.url);
      
      // Step 3: Redirect to Jitsi meeting with JWT token
      window.location.href = data.url;
    } else {
      console.error("❌ Verification failed:", data.error);
      alert(`Failed to verify: ${data.error}`);
    }
    
  } catch (error) {
    console.error("Error:", error);
    alert(`Error: ${error.message}`);
  }
}
```

---

## Testing Checklist

### Test Meeting Creation (Cron):
- [ ] Start server with `npm start`
- [ ] Create auction with winner
- [ ] Wait for cron (runs every 2 minutes)
- [ ] Check logs for "CREATING NFT-GATED MEETING"
- [ ] Verify meeting created with NFT info in database
- [ ] Confirm NFT token ID is stored

### Test NFT Burn Verification:
- [ ] Frontend burns NFT (gets TX hash)
- [ ] Send TX hash to `/api/meetings/join-gated/:roomId`
- [ ] Check logs for "NFT BURN VERIFICATION STARTED"
- [ ] Verify all 6 verification steps pass
- [ ] Confirm access token returned
- [ ] Check `meeting_access_logs` table has entry

### Test Security:
- [ ] Try joining without burning → Should fail
- [ ] Try wrong TX hash → Should fail
- [ ] Try another user's burn TX → Should fail (user mismatch)
- [ ] Try same burn TX twice → Should fail (replay attack)
- [ ] Try burn for wrong NFT → Should fail (token ID mismatch)

---

## How JWT Tokens Work

### What is the JWT Token?

The JWT (JSON Web Token) is generated by our backend and contains:

```javascript
{
  aud: 'jitsi',
  iss: 'chat',
  sub: 'meeting-app',
  room: '*',
  exp: 1696176000,  // Expires in 2 hours
  context: {
    user: {
      id: 'user-123',
      name: 'Bob',
      email: 'bob@example.com',
      moderator: 'false'  // Participant role
    }
  }
}
```

### How It's Used:

1. **Backend generates JWT** after verifying NFT burn
2. **JWT is signed** with our private key (only we can create valid tokens)
3. **Frontend receives JWT** in API response
4. **Jitsi meeting URL** includes JWT: `https://8x8.vc/room?jwt=eyJhbGc...`
5. **Jitsi validates JWT** when user joins (checks signature, expiry, etc.)
6. **User enters meeting** if JWT is valid

### Security:
- Only backend can generate valid JWTs (has private key)
- JWT expires after 2 hours
- Jitsi verifies JWT signature
- Invalid/expired JWT → Access denied by Jitsi

---

## Summary

### The Complete Security Chain:

1. ✅ **Auction ends** → NFT minted to winner
2. ✅ **Cron creates meeting** → Stores NFT requirements
3. ✅ **Winner burns NFT** → Gets TX hash
4. ✅ **Frontend sends TX hash** → To join API
5. ✅ **Backend verifies on blockchain:**
   - Transaction exists
   - Transaction succeeded
   - Correct event emitted
   - Token ID matches
   - Auction ID matches
   - User address matches
   - Not used before (replay check)
6. ✅ **Backend generates JWT** → Only after verification
7. ✅ **User joins meeting** → With verified JWT token

### Without Verification:
❌ Anyone could call the API and get access
❌ No proof of NFT ownership
❌ Security hole!

### With Verification:
✅ Only actual NFT holder can burn it
✅ Blockchain proves burn happened
✅ Event proves correct NFT/auction/user
✅ Database prevents replay attacks
✅ JWT token only after full verification
✅ **SECURE!** 🔒

