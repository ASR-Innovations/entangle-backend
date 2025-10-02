# REAL END-TO-END PLATFORM TESTING PLAN

## 🎯 Testing Objectives

We will test the complete auction → meeting flow using:
- **Real Para session cookie**: `capsule.sid=s%3A4fa4ff8e-f081-4664-a9a3-2198f31f18c6...`
- **Real contract**: `0xceBD87246e91C7D70C82D5aE5C196a0028543933`
- **Actual API calls** to backend running on localhost:5000
- **Live Jitsi integration** with JWT tokens
- **Lit Protocol verification** for NFT gating

## 📋 Test Sequence

### Phase 1: Authentication Flow
```
1. Para Session Cookie → Backend verification
2. Backend generates JWT token
3. Test authenticated API calls
```

### Phase 2: Contract Integration  
```
1. Connect to blockchain (Sepolia testnet)
2. Fetch existing auctions from contract
3. Test contract method calls (getAuction, etc.)
4. Verify auction data structure
```

### Phase 3: Auction Management
```
1. Test GET /api/auctions/active
2. Test POST /api/auctions/created (with mock tx)
3. Verify database storage
4. Test auction detail retrieval
```

### Phase 4: Lit Protocol NFT Gating
```
1. Generate Lit Gate Pass
2. Verify NFT ownership (mock)
3. Test NFT burn verification
4. Store access logs in database
```

### Phase 5: Jitsi Meeting System
```
1. Create Jitsi room
2. Generate JWT token (RS256)
3. Validate JWT structure
4. Test room URL generation
```

### Phase 6: Meeting Access API
```
1. Test GET /api/meetings/auction/:id
2. Test POST /api/meetings/access/:id
3. Verify NFT burn requirement
4. Return Jitsi JWT for meeting access
```

### Phase 7: Complete Integration
```
1. Simulate: User wins auction
2. NFT minted to winner
3. Winner requests meeting access
4. Lit Protocol verifies NFT ownership
5. Backend generates Jitsi JWT
6. Winner accesses video meeting
```

## 🔧 Technical Test Details

### Para Authentication Test
- Use actual session cookie from your Para wallet
- Test Para API endpoints with session verification
- Mock successful authentication for JWT generation
- Verify JWT structure and claims

### Contract Integration Test  
```javascript
// Test contract methods
const web3 = new Web3('https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY');
const contract = new web3.eth.Contract(ABI, '0xceBD87246e91C7D70C82D5aE5C196a0028543933');

// Fetch auction details
const auction = await contract.methods.getAuction(auctionId).call();
```

### Jitsi JWT Test
```javascript
// Generate proper JWT for Jitsi
const jwtPayload = {
  "aud": "jitsi",
  "context": {
    "user": {
      "id": "user-12345",
      "name": "Test User",
      "email": "test@example.com",
      "moderator": "false"
    },
    "features": {
      "livestreaming": "false",
      "recording": "false",
      "transcription": "true",
      "outbound-call": "false"
    }
  },
  "iss": "chat",
  "room": "test-room-name",
  "sub": "your-jitsi-app-id",
  "exp": Math.floor(Date.now() / 1000) + (3 * 60 * 60), // 3 hours
  "nbf": Math.floor(Date.now() / 1000) - 10
};

// Sign with RS256 algorithm
const token = jwt.sign(jwtPayload, privateKey, { 
  algorithm: 'RS256', 
  header: { kid: 'your-key-id' } 
});
```

### Lit Protocol Test
```javascript
// Test NFT verification flow
const litService = getLitService();

// Step 1: Generate gate pass
const gatePass = await litService.generateGatePass({
  userAddress: '0x...',
  auctionId: 123,
  nftTokenId: 456,
  signature: '0x...'
});

// Step 2: Verify meeting access
const verification = await litService.verifyMeetingAccess({
  userAddress: '0x...',
  auctionId: 123,
  nftTokenId: 456,
  burnTransactionHash: '0x...',
  userParaId: 'para_user_id'
});
```

## 🚀 Expected Test Results

### Success Criteria
- ✅ Para authentication works with session cookie
- ✅ Contract connection established
- ✅ Auction APIs respond correctly
- ✅ Lit Protocol initializes and processes NFT verification
- ✅ Jitsi JWT tokens generated with valid structure
- ✅ Meeting access API handles NFT burn verification
- ✅ Complete flow works end-to-end

### Failure Scenarios to Handle
- ❌ Para API rate limiting or authentication issues
- ❌ Contract methods not available (needs deployed contract)
- ❌ Missing Jitsi private key (demo mode acceptable)
- ❌ Lit Protocol configuration incomplete (expected)
- ❌ Database connection issues

## 📝 What Each Test Validates

### 1. Para Authentication
- **Tests**: Session cookie → JWT conversion
- **Validates**: User authentication flow works
- **Success**: JWT token generated with Para user data

### 2. Contract Integration  
- **Tests**: Blockchain connectivity and contract calls
- **Validates**: Smart contract integration functional
- **Success**: Can read auction data from contract

### 3. Auction APIs
- **Tests**: REST endpoints for auction management
- **Validates**: Frontend can interact with backend
- **Success**: Create/read auctions via API

### 4. Lit Protocol
- **Tests**: NFT verification and gate pass generation
- **Validates**: Meeting access control works
- **Success**: Can verify NFT ownership and burn

### 5. Jitsi Integration
- **Tests**: Room creation and JWT generation
- **Validates**: Video meeting functionality ready
- **Success**: Valid Jitsi JWT tokens generated

### 6. Meeting Access
- **Tests**: Complete NFT → meeting access flow
- **Validates**: Winner can access meeting after NFT burn
- **Success**: Returns Jitsi meeting URL with auth token

### 7. Complete Flow
- **Tests**: All components working together
- **Validates**: Platform ready for production
- **Success**: Auction winner can join video meeting

## 🎯 Production Readiness Checklist

After testing, we'll know:
- [ ] Core authentication working (Para → JWT)
- [ ] Blockchain integration functional  
- [ ] Auction management APIs ready
- [ ] NFT gating system operational
- [ ] Video meeting system configured
- [ ] Database schema working
- [ ] Real-time updates functional

## 🔑 Required API Keys for Full Testing

### Essential (For Core Functionality)
- ✅ `PARA_API_KEY` and `PARA_SECRET_API_KEY` (have)
- ✅ `JWT_SECRET` (configured)
- ✅ Database connection (working)
- ✅ Blockchain RPC endpoint (configured)

### Optional (For Production Features)
- ⏳ `JITSI_PRIVATE_KEY` and `JITSI_KID` (for JWT signing)
- ⏳ `LIT_ACTION_IPFS_CID` (for automated NFT verification)
- ⏳ `LIT_PKP_PUBLIC_KEY` (for Lit Protocol automation)

### Test Results Will Show
- Which components work in demo mode
- Which components need API keys for production
- Overall platform readiness percentage
- Specific configuration steps needed

This testing approach will give us complete visibility into platform functionality and production readiness.
