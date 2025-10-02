# 🚀 COMPLETE API TESTING COMMANDS

## 📋 **ALL BACKEND API ENDPOINTS**

### **🔐 AUTHENTICATION APIS**

#### 1. **Basic Para Authentication** (Step 1)
```bash
curl -X POST http://localhost:5009/api/auth/para-auth \
  -H "Content-Type: application/json" \
  -d '{
    "verificationToken": "mock-verification-token-12345"
  }'
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "paraUserId": "user-123",
    "email": "test@example.com",
    "hasWallet": false
  },
  "note": "Basic authentication complete. Use /import-session for wallet operations."
}
```

#### 2. **Full Session Import** (Step 2 - Required for wallet operations)
```bash
curl -X POST http://localhost:5009/api/auth/import-session \
  -H "Content-Type: application/json" \
  -d '{
    "session": {
      "user": {
        "id": "test-user-id-12345",
        "email": "test@example.com",
        "name": "Test User"
      },
      "wallets": [{
        "id": "wallet-id-12345",
        "type": "EVM",
        "address": "0x161d026cd7855bc783506183546c968cd96b4896",
        "publicKey": "0x04872f..."
      }]
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "walletAddress": "0x161d026cd7855bc783506183546c968cd96b4896",
    "hasWallet": true
  },
  "wallet": {
    "address": "0x161d026cd7855bc783506183546c968cd96b4896",
    "type": "EVM"
  }
}
```

#### 3. **Verify Token**
```bash
curl -X GET http://localhost:5009/api/auth/verify \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### **🏷️ AUCTION APIS**

#### 4. **Record Auction Creation** (After frontend creates on blockchain)
```bash
curl -X POST http://localhost:5009/api/auctions/created \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "title": "Test Auction",
    "description": "Testing auction creation",
    "duration": 60,
    "reservePrice": 0.1,
    "meetingDuration": 30,
    "creatorWallet": "0x161d026cd7855bc783506183546c968cd96b4896",
    "transactionHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
  }'
```

#### 5. **Get Active Auctions** (Public)
```bash
curl -X GET http://localhost:5009/api/auctions/active
```

#### 6. **Get User's Auctions**
```bash
curl -X GET http://localhost:5009/api/auctions/user \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### **🎬 MEETING ACCESS APIS**

#### 7. **Get My Meetings** (Auction Creator Access)
```bash
curl -X GET http://localhost:5009/api/meetings/my-meetings \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "meetings": [
    {
      "auctionId": "123",
      "title": "Test Auction",
      "meetingUrl": "https://8x8.vc/auction-123-meeting?jwt=creator_token_here",
      "scheduledAt": "2025-08-31T12:00:00.000Z",
      "status": "active"
    }
  ]
}
```

#### 8. **Get My Auction NFTs** (Winner Check)
```bash
curl -X GET http://localhost:5009/api/meetings/my-auction-nfts \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "nfts": [
    {
      "tokenId": "1",
      "auctionId": "123",
      "title": "Test Auction",
      "canBurnForMeeting": true
    }
  ]
}
```

#### 9. **Verify Winner Meeting Access** (Step 1 for winners)
```bash
curl -X POST http://localhost:5009/api/meetings/access-winner-meeting \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "auctionId": "123",
    "nftTokenId": "1"
  }'
```

**Response:**
```json
{
  "success": true,
  "meeting": {
    "auctionId": "123",
    "nftTokenId": "1",
    "title": "Test Auction",
    "meetingUrl": "https://8x8.vc/auction-123-meeting?jwt=winner_token_here",
    "requiresBurn": true,
    "message": "You can access this meeting. Note: Your NFT will be burned when you join."
  }
}
```

#### 10. **Burn NFT and Get Final Access** (Step 2 for winners)
```bash
curl -X POST http://localhost:5009/api/meetings/burn-nft-access \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "auctionId": "123",
    "nftTokenId": "1",
    "transactionHash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "NFT burned successfully! You can now access the meeting.",
  "meeting": {
    "auctionId": "123",
    "title": "Test Auction",
    "meetingUrl": "https://8x8.vc/auction-123-meeting?jwt=final_winner_token_here"
  }
}
```

---

### **🏥 SYSTEM APIS**

#### 11. **Health Check**
```bash
curl -X GET http://localhost:5009/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-08-31T12:00:00.000Z",
  "services": {
    "database": "configured",
    "blockchain": "configured",
    "para": "configured",
    "jitsi": "configured"
  }
}
```

---

## 🎯 **HOW CREATOR & WINNER ACCESS SAME MEETING**

### **Database Relationships:**

1. **Auctions Table:**
   ```sql
   id | creator_wallet | title | description
   123| 0xCreator...   | Test  | Description
   ```

2. **Meetings Table:**
   ```sql
   auction_id | jitsi_room_id        | creator_access_token | winner_access_token
   123        | auction-123-meeting  | jwt_for_creator      | jwt_for_winner
   ```

3. **Smart Contract:**
   ```solidity
   nftTokenId → auctionId mapping
   Token ID 1 → Auction 123
   ```

### **Access Flow:**

#### **Creator Access:**
- Frontend calls: `GET /api/meetings/my-meetings`
- Backend queries: `SELECT * FROM meetings WHERE auction_id IN (SELECT id FROM auctions WHERE creator_wallet = ?)`
- Returns: Meeting URL with `creator_access_token` (moderator role)

#### **Winner Access:**
- Frontend calls: `GET /api/meetings/my-auction-nfts` 
- Backend queries smart contract: `getNFTsOwnedByUser(userWallet)`
- Returns: NFTs that can be burned for meeting access
- Frontend calls: `POST /api/meetings/access-winner-meeting`
- Backend verifies NFT ownership via contract
- Returns: Meeting details with `winner_access_token` (participant role)
- Frontend burns NFT on blockchain
- Frontend calls: `POST /api/meetings/burn-nft-access`
- Backend verifies burn transaction
- Returns: Final meeting URL with verified access

### **Same Meeting, Different Roles:**
- **Same Jitsi Room**: `auction-123-meeting`
- **Creator**: Moderator role (can control meeting)
- **Winner**: Participant role (join meeting)
- **Different JWT tokens** but **same physical meeting room**

---

## 🧪 **COMPLETE TESTING SCRIPT**

Run the complete API test suite:

```bash
# 1. Start the server
npm start

# 2. Run complete API test (in another terminal)
node test-complete-api-flow.js
```

This will test:
- ✅ All authentication flows
- ✅ Auction creation and retrieval
- ✅ Meeting creation simulation
- ✅ Meeting access for both creator and winner
- ✅ System health checks

The script provides real request/response examples and shows exactly how frontend should call each API.
