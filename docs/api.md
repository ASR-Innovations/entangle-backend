# API Documentation

## Base URL
- Development: `http://localhost:5009`
- Production: `http://209.38.123.139`

## Authentication

All API endpoints require JWT authentication via the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

### Get JWT Token

```bash
POST /api/auth/para-auth
Content-Type: application/json

{
  "verificationToken": "para_verification_token"
}
```

## API Endpoints

### Authentication

#### Para Authentication
```bash
POST /api/auth/para-auth
```
Verify Para token and get JWT.

**Request:**
```json
{
  "verificationToken": "string"
}
```

**Response:**
```json
{
  "success": true,
  "token": "jwt_token",
  "user": {
    "paraUserId": "string",
    "walletAddress": "string",
    "displayName": "string"
  }
}
```

#### Para Session Import
```bash
POST /api/auth/para-session
```
Import Para session for wallet operations.

#### Verify JWT Token
```bash
GET /api/auth/verify
```
Verify JWT token validity.

### Auctions

#### Record Auction Creation
```bash
POST /api/auctions/created
```
Record auction creation from blockchain.

**Request:**
```json
{
  "auctionId": 1,
  "title": "Meeting with CEO",
  "description": "One-on-one meeting opportunity",
  "meetingDuration": 60,
  "transactionHash": "0x..."
}
```

#### Get Active Auctions
```bash
GET /api/auctions/active?limit=50&offset=0
```
Get active auctions with cached data.

**Response:**
```json
{
  "success": true,
  "auctions": [
    {
      "id": 1,
      "title": "Meeting with CEO",
      "description": "One-on-one meeting opportunity",
      "creatorParaId": "user_123",
      "creatorWallet": "0x1234567890abcdef...",
      "creatorName": "John Doe",
      "meetingDuration": 60,
      "highestBid": 5.5,
      "highestBidder": "0xabcdef...",
      "timeRemainingSeconds": 250,
      "lastUpdated": "2024-01-15T10:00:00Z"
    }
  ],
  "total": 50,
  "performance": {
    "queryTimeMs": 45,
    "cacheStatus": "active"
  }
}
```

#### Get User's Created Auctions
```bash
GET /api/auctions/user/created
```
Get auctions created by authenticated user.

#### Get Auction Details
```bash
GET /api/auctions/:id
```
Get specific auction details.

### Meetings

#### Get Meeting by Auction
```bash
GET /api/meetings/auction/:id
```
Get meeting details for specific auction.

#### Access Meeting with NFT
```bash
POST /api/meetings/access/:id
```
Access meeting by burning NFT.

**Request:**
```json
{
  "nftTokenId": 123,
  "transactionHash": "0x..."
}
```

**Response:**
```json
{
  "success": true,
  "meeting": {
    "roomUrl": "https://meet.jit.si/room-id",
    "accessToken": "jwt_token",
    "expiresAt": "2024-01-15T11:00:00Z"
  }
}
```

#### Get User's Meetings
```bash
GET /api/meetings/user
```
Get meetings for authenticated user.

#### Extend Meeting Duration
```bash
POST /api/meetings/:id/extend
```
Extend meeting duration.

#### Close Meeting
```bash
POST /api/meetings/:id/close
```
Close meeting room.

### Meeting Access (Winner Flow)

#### Get User's NFTs
```bash
GET /api/meetings/my-auction-nfts
```
Get NFTs that can be burned for meeting access.

**Response:**
```json
{
  "success": true,
  "nfts": [
    {
      "tokenId": 123,
      "auctionId": 1,
      "auctionTitle": "Meeting with CEO",
      "canBurn": true,
      "meetingScheduled": true
    }
  ]
}
```

#### Verify Meeting Access
```bash
POST /api/meetings/access-winner-meeting
```
Verify NFT ownership for meeting access.

**Request:**
```json
{
  "auctionId": 1,
  "nftTokenId": 123
}
```

#### Burn NFT for Access
```bash
POST /api/meetings/burn-nft-access
```
Final step to access meeting after NFT burn.

**Request:**
```json
{
  "auctionId": 1,
  "nftTokenId": 123,
  "transactionHash": "0x..."
}
```

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Error message",
  "message": "Detailed error description (development only)"
}
```

### Common HTTP Status Codes

- `200` - Success
- `400` - Bad Request
- `401` - Unauthorized (invalid/missing JWT)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

## Rate Limiting

- **General endpoints**: 100 requests per minute
- **Authentication endpoints**: 10 requests per minute
- **Meeting access endpoints**: 5 requests per minute

## Environment Variables Required

```env
# Core Configuration
NODE_ENV=production
PORT=5009
FRONTEND_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://localhost:5432/meeting_auction

# JWT
JWT_SECRET=your-super-secret-jwt-key-min-32-chars

# Para Wallet
PARA_API_KEY=your-para-api-key
PARA_SECRET_API_KEY=your-para-secret-api-key
PARA_ENVIRONMENT=beta

# Blockchain
ETH_WSS_ENDPOINT=wss://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
ETH_HTTP_ENDPOINT=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
AUCTION_CONTRACT_ADDRESS=0x...
PLATFORM_PRIVATE_KEY=0x...

# Jitsi Configuration
JITSI_DOMAIN=meet.jit.si
JITSI_APP_ID=meeting-auction-app
JITSI_SECRET=your-jitsi-jwt-secret
```

## Testing

```bash
# Health check
curl http://localhost:5009/health

# Test authentication
curl -X POST http://localhost:5009/api/auth/para-auth \
  -H "Content-Type: application/json" \
  -d '{"verificationToken": "test_token"}'

# Test active auctions
curl http://localhost:5009/api/auctions/active?limit=10
```