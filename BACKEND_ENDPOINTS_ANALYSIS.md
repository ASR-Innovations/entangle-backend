# Backend Endpoints Analysis

## 📊 **Total Endpoints: 25**

## 🔍 **Endpoint Breakdown by Route:**

### **1. Health & System Endpoints (2 endpoints)**
| Endpoint | Method | Database Connected | Data Collected | Purpose |
|----------|--------|-------------------|----------------|---------|
| `/health` | GET | ❌ No | System status, service configs | System health check |
| `/api/health` | GET | ❌ No | Uptime, environment | API health check |

### **2. Authentication Routes - `/api/auth` (3 endpoints)**
| Endpoint | Method | Database Connected | Data Collected | Purpose |
|----------|--------|-------------------|----------------|---------|
| `/api/auth/para-auth` | POST | ✅ Yes | `verificationToken`, `walletAddress` | Para verification & user storage |
| `/api/auth/import-session` | POST | ✅ Yes | `session` (full Para session) | Full session import with wallet |
| `/api/auth/verify` | GET | ❌ No | JWT token validation | Token verification |

### **3. Auction Routes - `/api/auctions` (7 endpoints)**
| Endpoint | Method | Database Connected | Data Collected | Purpose |
|----------|--------|-------------------|----------------|---------|
| `/api/auctions/created` | POST | ✅ Yes | `title`, `description`, `duration`, `reservePrice`, `meetingDuration`, `creatorWallet`, `transactionHash` | Record auction creation |
| `/api/auctions/active` | GET | ✅ Yes | Query params: `limit`, `offset` | Get active auctions with blockchain data |
| `/api/auctions/user/created` | GET | ✅ Yes | JWT user data | Get user's created auctions |
| `/api/auctions/:auctionId` | GET | ✅ Yes | `auctionId` param | Get specific auction details |
| `/api/auctions/:auctionId/bid` | POST | ❌ No | `amount`, `bidderWallet` | Place bid on auction |
| `/api/auctions/:auctionId/end` | POST | ❌ No | None | End auction |
| `/api/auctions/:auctionId/cancel` | POST | ❌ No | None | Cancel auction |

### **4. Meeting Routes - `/api/meetings` (7 endpoints)**
| Endpoint | Method | Database Connected | Data Collected | Purpose |
|----------|--------|-------------------|----------------|---------|
| `/api/meetings/create-simple` | POST | ✅ Yes | `guestUserId`, `meetingName`, `duration` | Create simple Para-authenticated meeting |
| `/api/meetings/create-gated` | POST | ✅ Yes | `nftContract`, `nftTokenId`, `meetingName`, `duration`, `windowStart`, `windowEnd` | Create NFT-gated meeting |
| `/api/meetings/join-gated/:roomId` | POST | ✅ Yes | `burnTransactionHash` | Join NFT-gated meeting with burn verification |
| `/api/meetings/:roomId` | GET | ✅ Yes | `roomId` param | Get meeting info |
| `/api/meetings/` | GET | ✅ Yes | JWT user data | List user's meetings |
| `/api/meetings/test-create` | POST | ✅ Yes | `hostEmail`, `guestEmail` | Test meeting creation |
| `/api/meetings/create-direct` | POST | ❌ No | `hostName`, `hostEmail`, `guestName`, `guestEmail`, `meetingName`, `duration` | Create direct meeting (no auth/DB) |

### **5. Contract Routes - `/api/contract` (7 endpoints)**
| Endpoint | Method | Database Connected | Data Collected | Purpose |
|----------|--------|-------------------|----------------|---------|
| `/api/contract/stats` | GET | ❌ No | None | Get contract statistics |
| `/api/contract/auctions` | GET | ❌ No | None | Get all auctions from contract |
| `/api/contract/nfts/:address` | GET | ❌ No | `address` param | Get NFTs owned by user |
| `/api/contract/nft/:tokenId` | GET | ❌ No | `tokenId` param | Get NFT metadata |
| `/api/contract/can-burn/:tokenId/:userAddress` | GET | ❌ No | `tokenId`, `userAddress` params | Check if user can burn NFT |
| `/api/contract/dashboard/user/:address` | GET | ❌ No | `address` param | Get user dashboard data |
| `/api/contract/dashboard/host/:address` | GET | ❌ No | `address` param | Get host dashboard data |

### **6. Admin Routes - `/api/admin` (2 endpoints)**
| Endpoint | Method | Database Connected | Data Collected | Purpose |
|----------|--------|-------------------|----------------|---------|
| `/api/admin/db-stats` | GET | ✅ Yes | None | Database status and statistics |
| `/api/admin/users` | GET | ✅ Yes | None | List all users |

## 📈 **Database Connection Summary:**

### **✅ Connected to Database (15 endpoints):**
- **Authentication**: 2/3 endpoints
- **Auctions**: 4/7 endpoints  
- **Meetings**: 6/7 endpoints
- **Admin**: 2/2 endpoints
- **Health**: 0/2 endpoints
- **Contract**: 0/7 endpoints

### **❌ NOT Connected to Database (10 endpoints):**
- **Health checks** (2 endpoints) - System monitoring only
- **Contract operations** (7 endpoints) - Blockchain-only operations
- **Auction blockchain operations** (3 endpoints) - Bid/end/cancel operations
- **Direct meeting creation** (1 endpoint) - No-auth meeting creation

## 🎯 **Data Collection Analysis:**

### **User Data Collection:**
- **Para User ID**: Collected in 8 endpoints
- **Wallet Address**: Collected in 6 endpoints  
- **Email**: Collected in 3 endpoints
- **Display Name**: Collected in 2 endpoints
- **Auth Type**: Collected in 2 endpoints

### **Auction Data Collection:**
- **Auction Details**: title, description, duration, reservePrice
- **Meeting Data**: meetingDuration, meetingName
- **Blockchain Data**: transactionHash, creatorWallet
- **NFT Data**: nftContract, nftTokenId, burnTransactionHash

### **Meeting Data Collection:**
- **Participant Info**: hostName, guestName, hostEmail, guestEmail
- **Meeting Config**: duration, meetingName, roomId
- **Access Control**: burnTransactionHash, nftContract, nftTokenId

## 🔧 **Endpoints NOT Connected to Database:**

1. **Health Monitoring** (2 endpoints)
   - Purpose: System status only
   - Reason: No data persistence needed

2. **Blockchain Operations** (7 endpoints)
   - Purpose: Direct blockchain interaction
   - Reason: Contract operations don't need database

3. **Auction Blockchain Actions** (3 endpoints)
   - Purpose: Bid/end/cancel on blockchain
   - Reason: Blockchain state is source of truth

4. **Direct Meeting Creation** (1 endpoint)
   - Purpose: Quick meeting without auth
   - Reason: Intentionally no database for simplicity

## 💡 **Recommendations:**

1. **Database Integration Opportunities:**
   - Consider logging blockchain operations for analytics
   - Store bid history for auction analytics
   - Track meeting attendance and duration

2. **Missing Database Connections:**
   - Auction bid/end/cancel could log to database for history
   - Contract operations could be cached in database
   - Health endpoints could store system metrics

3. **Data Analytics Potential:**
   - User engagement tracking
   - Auction performance metrics
   - Meeting success rates
   - System usage patterns

## 🎯 **Summary:**
- **Total Endpoints**: 25
- **Database Connected**: 15 (60%)
- **Database Disconnected**: 10 (40%)
- **Primary Data Sources**: User authentication, auction management, meeting creation
- **Blockchain-Only Operations**: Contract interactions, bidding, NFT operations
