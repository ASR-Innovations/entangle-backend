# 🚀 COMPLETE END-TO-END AUCTION-TO-MEETING SYSTEM FLOW

## 📋 SYSTEM OVERVIEW
**Entangled V2** is a blockchain-based auction system where auction winners get NFTs that grant access to exclusive video meetings with auction creators.

## 🏗️ ARCHITECTURE COMPONENTS

### **Backend Services:**
- **Para Authentication** - Wallet-based user auth
- **Smart Contract Integration** - Avalanche testnet interaction  
- **Auction Cron Service** - Automatically ends auctions
- **Jitsi Meeting Service** - Creates secure video meetings
- **Lit Protocol** - NFT gating (optional)
- **PostgreSQL Database** - User and meeting data

### **Smart Contract:**
- **Address**: `0xceBD87246e91C7D70C82D5aE5C196a0028543933`
- **Network**: Avalanche Testnet (Chain ID: 43113)
- **Functions**: Auction creation, bidding, ending, NFT minting

---

## 🔄 COMPLETE FLOW BREAKDOWN

### **PHASE 1: AUCTION CREATION**
```
Frontend → Para Auth → Backend → Smart Contract
```

**1.1 User Authentication:**
- User connects wallet via Para
- Frontend calls: `POST /api/auth/para-auth` with verification token
- Backend verifies with Para API and stores user data

**1.2 Auction Creation:**
- User fills auction form (title, duration, reserve price)
- Frontend calls: `POST /api/auctions/create`
- Backend calls smart contract `createAuction()` function
- Auction stored on-chain with unique ID

### **PHASE 2: BIDDING PERIOD**
```
Bidders → Smart Contract → Event Logs
```

**2.1 Bidding Process:**
- Users place bids directly on smart contract
- Anti-sniping protection extends auction time
- Highest bidder tracked on-chain

### **PHASE 3: AUCTION ENDING (AUTOMATED)**
```
Cron Service → Smart Contract → NFT Mint → Meeting Creation
```

**3.1 Cron Detection (Every 2 minutes):**
```javascript
// AuctionCronService checks:
- Current block vs auction end block
- Only processes auctions with bids
- Skips no-bid auctions
```

**3.2 Blockchain Transaction:**
```javascript
// Calls contract.endAuction(auctionId)
- Distributes funds (platform fee + host payment)
- Mints NFT to auction winner
- Marks auction as ended
```

**3.3 Meeting Creation:**
```javascript
// JitsiService.createAuctionMeeting()
- Creates Jitsi room with unique ID
- Generates JWT tokens for host and winner
- Stores meeting data in database
```

### **PHASE 4: MEETING ACCESS**

#### **4A: AUCTION CREATOR ACCESS (Immediate)**
```
Frontend → API → Database → Meeting URL
```

**Creator Flow:**
- Frontend calls: `GET /api/meetings/my-meetings`
- Returns all meetings for auctions they created
- Direct access - no additional verification needed
- Gets meeting URL with moderator JWT token

#### **4B: AUCTION WINNER ACCESS (Verified)**
```
Frontend → NFT Verification → Burn Transaction → Meeting Access
```

**Winner Flow:**

**Step 1: Check NFTs**
- Frontend calls: `GET /api/meetings/my-auction-nfts`
- Returns NFTs that can be burned for meeting access

**Step 2: Verify Access**
- Frontend calls: `POST /api/meetings/access-winner-meeting`
- Body: `{ auctionId, nftTokenId }`
- Backend verifies NFT ownership via smart contract
- Returns meeting details if valid

**Step 3: Burn NFT (Frontend)**
- User confirms NFT burn on blockchain
- Frontend calls smart contract `burnNFTForMeeting(tokenId)`
- Gets transaction hash

**Step 4: Final Access**
- Frontend calls: `POST /api/meetings/burn-nft-access`
- Body: `{ auctionId, nftTokenId, transactionHash }`
- Backend verifies burn transaction
- Returns final meeting URL with participant JWT

---

## 🔐 SECURITY FEATURES

### **Authentication:**
- Para wallet-based authentication
- JWT tokens for API access
- Smart contract ownership verification

### **Meeting Security:**
- JWT-secured Jitsi rooms
- Role-based access (moderator vs participant)
- One-time NFT burn for access
- Transaction hash verification

### **Anti-Replay Protection:**
- Database tracks used transaction hashes
- NFT can only be burned once
- Time-limited meeting access

---

## 🗄️ DATABASE SCHEMA

### **Users Table:**
```sql
- para_user_id (unique identifier)
- wallet_address (blockchain address)
- email, display_name, auth_type
```

### **Auctions Table:**
```sql
- id (matches contract auction ID)
- creator_para_id, creator_wallet
- title, description, metadata_ipfs
- nft_token_id (after auction ends)
```

### **Meetings Table:**
```sql
- auction_id (foreign key)
- jitsi_room_id, room_url
- creator_access_token, winner_access_token
- scheduled_at, expires_at
```

### **Meeting Access Logs:**
```sql
- auction_id, user_para_id, wallet_address
- nft_token_id, transaction_hash
- access_method, accessed_at
```

---

## 🔌 API ENDPOINTS

### **Authentication:**
- `POST /api/auth/para-auth` - Verify Para token
- `POST /api/auth/para-session` - Import Para session

### **Meetings:**
- `GET /api/meetings/my-meetings` - Creator meeting links
- `GET /api/meetings/my-auction-nfts` - Winner's NFTs
- `POST /api/meetings/access-winner-meeting` - Verify NFT access
- `POST /api/meetings/burn-nft-access` - Confirm burn & access

### **Testing:**
- `GET /health` - Server health check

---

## 🚀 FRONTEND INTEGRATION GUIDE

### **Required Environment Variables:**
```bash
REACT_APP_API_URL=http://localhost:5009
REACT_APP_CONTRACT_ADDRESS=0xceBD87246e91C7D70C82D5aE5C196a0028543933
REACT_APP_CHAIN_ID=43113
```

### **Para Integration:**
```javascript
// Initialize Para
const para = new Para(PARA_API_KEY);

// Get verification token
const token = await para.getVerificationToken();

// Send to backend
await fetch('/api/auth/para-auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ verificationToken: token })
});
```

### **Smart Contract Integration:**
```javascript
// Connect to contract
const contract = new ethers.Contract(
  CONTRACT_ADDRESS, 
  ABI, 
  signer
);

// Place bid
await contract.placeBid(auctionId, { value: bidAmount });

// Burn NFT for meeting access
await contract.burnNFTForMeeting(nftTokenId);
```

### **Meeting Access Flow:**
```javascript
// For auction creators
const meetings = await fetch('/api/meetings/my-meetings', {
  headers: { Authorization: `Bearer ${jwtToken}` }
});

// For auction winners
const nfts = await fetch('/api/meetings/my-auction-nfts', {
  headers: { Authorization: `Bearer ${jwtToken}` }
});

// Verify and burn NFT
const burnTx = await contract.burnNFTForMeeting(tokenId);
const access = await fetch('/api/meetings/burn-nft-access', {
  method: 'POST',
  headers: { Authorization: `Bearer ${jwtToken}` },
  body: JSON.stringify({
    auctionId,
    nftTokenId,
    transactionHash: burnTx.hash
  })
});
```

---

## ⚙️ DEPLOYMENT CONFIGURATION

### **Required Environment Variables:**
```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost/entangled
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=entangled
POSTGRES_USER=user
POSTGRES_PASSWORD=password

# Para Authentication
PARA_API_KEY=your_para_api_key
PARA_SECRET_KEY=your_para_secret_key

# Blockchain
PLATFORM_PRIVATE_KEY=0x...
CONTRACT_ADDRESS=0xceBD87246e91C7D70C82D5aE5C196a0028543933
RPC_URL=https://api.avax-test.network/ext/bc/C/rpc

# Jitsi/JaaS
JITSI_APP_ID=vpaas-magic-cookie-...
JITSI_KID=vpaas-magic-cookie-.../a521af
JITSI_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----...
```

### **Server Startup:**
```bash
cd backend
npm install
npm start
```

---

## 🧪 TESTING

### **Test Script:**
```bash
node test-live-auctions.js
```

**What it tests:**
- Blockchain connectivity
- Contract function calls
- Auction analysis and processing
- Real transaction execution
- Meeting creation
- API endpoint availability
- Cron service functionality

### **Expected Output:**
- ✅ 9 total auctions found
- ✅ Real blockchain transactions
- ✅ NFT minting for winners
- ✅ Meeting creation with JWT tokens
- ✅ Database storage
- ✅ Cron service operational

---

## 🎯 KEY SUCCESS METRICS

### **System Health:**
- ✅ Blockchain connectivity (Chain ID: 43113)
- ✅ Smart contract interaction
- ✅ Automated auction ending
- ✅ Meeting creation pipeline
- ✅ Database operations
- ✅ JWT token generation

### **Security Verification:**
- ✅ NFT ownership verification
- ✅ Transaction hash validation
- ✅ One-time access control
- ✅ Role-based meeting access

### **Integration Readiness:**
- ✅ RESTful API endpoints
- ✅ Para authentication flow
- ✅ Smart contract ABI compatibility
- ✅ Error handling and logging

---

## 🚀 PRODUCTION READINESS CHECKLIST

- [x] Smart contract deployed and verified
- [x] Backend services operational
- [x] Database schema created
- [x] Authentication system working
- [x] Meeting creation pipeline functional
- [x] Security measures implemented
- [x] API documentation complete
- [x] Testing suite operational
- [x] Error handling robust
- [x] Logging comprehensive

**🎉 SYSTEM STATUS: FULLY OPERATIONAL AND READY FOR FRONTEND INTEGRATION!**
