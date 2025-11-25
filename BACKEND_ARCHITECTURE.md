# Backend Architecture Documentation

## Table of Contents
1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [System Architecture](#system-architecture)
4. [Database Schema](#database-schema)
5. [API Endpoints](#api-endpoints)
6. [Authentication Flow](#authentication-flow)
7. [Auction Lifecycle](#auction-lifecycle)
8. [Meeting System](#meeting-system)
9. [Blockchain Integration](#blockchain-integration)
10. [Cron Jobs & Background Services](#cron-jobs--background-services)
11. [Environment Configuration](#environment-configuration)
12. [Error Handling](#error-handling)

---

## Overview

The Entangle backend is a Node.js/Express application that powers a blockchain-based auction platform for meeting access. It integrates:
- **Para SDK** for user authentication and wallet management
- **Avalanche blockchain** for auction smart contracts and NFT minting
- **Jitsi (JaaS)** for video meeting infrastructure
- **PostgreSQL** for data persistence
- **WebSocket (Socket.IO)** for real-time updates

### Core Features
- User authentication via Para (email, phone, social OAuth, external wallets)
- Blockchain auction creation and bidding
- NFT-gated meeting access
- Automated auction ending and meeting scheduling
- Real-time auction updates

---

## Tech Stack

### Backend Framework
- **Node.js** v18+
- **Express.js** v4.18.2 - Web framework
- **Socket.IO** v4.7.2 - Real-time bidirectional communication

### Blockchain & Web3
- **ethers.js** v6.15.0 - Ethereum/Avalanche interaction
- **web3.js** v4.1.1 - Alternative Web3 library
- **Avalanche C-Chain** - Smart contract deployment (Fuji testnet / Mainnet)

### Authentication & User Management
- **@getpara/server-sdk** v2.0.0-alpha.51 - Para authentication
- **jsonwebtoken** v9.0.2 - JWT token generation

### Database
- **PostgreSQL** v8.11.3 - Primary database
- **pg** (node-postgres) - PostgreSQL client

### Video Conferencing
- **Jitsi as a Service (JaaS)** - Video meeting platform
- **JWT-based authentication** for meeting access

### Background Jobs
- **node-cron** v3.0.3 - Scheduled task execution
- Custom cron service for auction monitoring

### Utilities
- **axios** v1.5.0 - HTTP client
- **winston** v3.10.0 - Logging
- **joi** v18.0.1 - Request validation
- **helmet** v7.0.0 - Security headers
- **cors** v2.8.5 - Cross-origin resource sharing
- **dotenv** v16.3.1 - Environment variable management

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│                    (React/Next.js App)                          │
└────────────┬────────────────────────────────────────────────────┘
             │
             │ HTTP/REST + WebSocket
             │
┌────────────▼────────────────────────────────────────────────────┐
│                      EXPRESS SERVER                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Routes     │  │  Middleware  │  │   Services   │         │
│  │              │  │              │  │              │         │
│  │ • Auth       │  │ • JWT Auth   │  │ • Para       │         │
│  │ • Auctions   │  │ • CORS       │  │ • Contract   │         │
│  │ • Meetings   │  │ • Helmet     │  │ • Jitsi      │         │
│  │ • Contract   │  │ • Validation │  │ • Meeting    │         │
│  │ • Admin      │  │              │  │              │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└────────┬────────────────────────────────────────────────────────┘
         │
         │
    ┌────┴────┬──────────────┬──────────────┬──────────────┐
    │         │              │              │              │
    │         │              │              │              │
    ▼         ▼              ▼              ▼              ▼
┌────────┐ ┌──────┐  ┌──────────────┐ ┌──────────┐ ┌──────────┐
│  Para  │ │ Jitsi│  │  PostgreSQL  │ │ Avalanche│ │  Cron    │
│  API   │ │ JaaS │  │   Database   │ │Blockchain│ │ Service  │
└────────┘ └──────┘  └──────────────┘ └──────────┘ └──────────┘
```

### Request Flow

1. **User Authentication**
   ```
   Frontend → Para SDK → Backend /api/auth/para-auth → JWT Token
   ```

2. **Auction Creation**
   ```
   Frontend → Smart Contract (createAuction) → Transaction Hash
   Frontend → Backend /api/auctions/created → Database Record
   ```

3. **Bidding**
   ```
   Frontend → Smart Contract (placeBid) → Blockchain Event
   Cron Service → Monitors Blockchain → Updates Database
   ```

4. **Meeting Access**
   ```
   Winner → Burns NFT → Backend Verifies → Creates Jitsi Meeting
   ```

---

## Database Schema

### Entity Relationship Diagram

```
┌─────────────────┐
│     users       │
├─────────────────┤
│ id (PK)         │
│ para_user_id    │◄──────┐
│ wallet_address  │       │
│ email           │       │
│ auth_type       │       │
│ oauth_method    │       │
│ display_name    │       │
│ profile_image   │       │
└─────────────────┘       │
                          │
                          │
┌─────────────────────────┴───────┐
│         auctions                │
├─────────────────────────────────┤
│ id (PK)                         │
│ contract_address                │
│ creator_para_id (FK)            │
│ creator_wallet                  │
│ title                           │
│ description                     │
│ twitter_id                      │
│ seller_name                     │
│ profile_picture                 │
│ event_date                      │
│ event_start_time                │
│ event_end_time                  │
│ bid_price                       │
│ duration_blocks                 │
│ end_block                       │
│ highest_bid                     │
│ highest_bidder                  │
│ blocks_remaining                │
│ time_remaining_seconds          │
│ meeting_duration                │
│ nft_token_id                    │
│ jitsi_room_id                   │
│ auto_ended                      │
│ ended                           │
└─────────────────┬───────────────┘
                  │
                  │
                  │
┌─────────────────▼───────────────┐
│         meetings                │
├─────────────────────────────────┤
│ id (PK)                         │
│ auction_id (FK)                 │
│ jitsi_room_id                   │
│ jitsi_room_config               │
│ creator_access_token            │
│ winner_access_token             │
│ room_url                        │
│ scheduled_at                    │
│ expires_at                      │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│    meeting_access_logs          │
├─────────────────────────────────┤
│ id (PK)                         │
│ auction_id (FK)                 │
│ user_para_id                    │
│ wallet_address                  │
│ nft_token_id                    │
│ transaction_hash                │
│ access_method                   │
│ accessed_at                     │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│       notifications             │
├─────────────────────────────────┤
│ id (PK)                         │
│ user_para_id                    │
│ wallet_address                  │
│ type                            │
│ title                           │
│ message                         │
│ data (JSONB)                    │
│ read                            │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│      lit_gate_passes            │
├─────────────────────────────────┤
│ id (PK)                         │
│ nonce                           │
│ user_para_id                    │
│ wallet_address                  │
│ auction_id                      │
│ payload_hash                    │
│ signature                       │
│ used                            │
│ expires_at                      │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│      seaport_orders             │
├─────────────────────────────────┤
│ order_hash (PK)                 │
│ order_type                      │
│ nft_contract                    │
│ token_id                        │
│ maker                           │
│ taker                           │
│ payment_token                   │
│ price                           │
│ price_decimal                   │
│ platform_fee_amount             │
│ platform_fee_recipient          │
│ start_time                      │
│ end_time                        │
│ expires_at                      │
│ order_components (JSONB)        │
│ signature                       │
│ is_active                       │
│ is_cancelled                    │
│ is_fulfilled                    │
│ fulfilled_at                    │
│ fulfilled_by                    │
│ fulfillment_tx_hash             │
│ cancelled_at                    │
│ cancellation_tx_hash            │
│ para_user_id (FK)               │
└─────────────────┬───────────────┘
                  │
                  │
        ┌─────────┴─────────┬─────────────────┐
        │                   │                 │
        ▼                   ▼                 ▼
┌───────────────────┐ ┌──────────────────┐ ┌──────────────┐
│order_fulfillments │ │order_cancellations│ │order_events  │
├───────────────────┤ ├──────────────────┤ ├──────────────┤
│ id (PK)           │ │ id (PK)          │ │ id (PK)      │
│ order_hash (FK)   │ │ order_hash (FK)  │ │ order_hash   │
│ fulfiller         │ │ cancelled_by     │ │ event_type   │
│ transaction_hash  │ │ transaction_hash │ │ actor        │
│ block_number      │ │ cancellation_    │ │ event_data   │
│ amount_paid       │ │   reason         │ │ created_at   │
│ platform_fee_paid │ │ cancelled_at     │ └──────────────┘
│ fulfilled_at      │ └──────────────────┘
└───────────────────┘
```

### Key Tables

#### **users**
Stores user authentication and profile data from Para.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| para_user_id | VARCHAR(255) | Unique Para user identifier |
| wallet_address | VARCHAR(42) | User's blockchain wallet |
| email | VARCHAR(255) | User email (if auth via email) |
| auth_type | VARCHAR(50) | email, phone, farcaster, telegram, externalWallet |
| oauth_method | VARCHAR(50) | google, x, discord, facebook, apple |
| display_name | VARCHAR(255) | User's display name |
| profile_image | TEXT | Profile picture URL |

#### **auctions**

Caches blockchain auction data for fast queries.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Auction ID from smart contract |
| contract_address | VARCHAR(42) | Smart contract address |
| creator_para_id | VARCHAR(255) | Creator's Para user ID |
| creator_wallet | VARCHAR(42) | Creator's wallet address |
| title | VARCHAR(255) | Auction title |
| description | TEXT | Auction description |
| twitter_id | VARCHAR(255) | Creator's Twitter handle |
| seller_name | VARCHAR(255) | Display name for seller |
| profile_picture | TEXT | Creator's profile image |
| event_date | TIMESTAMP | Scheduled event date |
| event_start_time | TIMESTAMP | Event start time |
| event_end_time | TIMESTAMP | Event end time |
| bid_price | VARCHAR(50) | Reserve/starting price (wei) |
| duration_blocks | INTEGER | Auction duration in blocks |
| end_block | INTEGER | Block number when auction ends |
| highest_bid | VARCHAR(50) | Current highest bid (wei) |
| highest_bidder | VARCHAR(42) | Current highest bidder wallet |
| blocks_remaining | INTEGER | Blocks until auction ends |
| time_remaining_seconds | INTEGER | Estimated seconds remaining |
| meeting_duration | INTEGER | Meeting duration in minutes |
| nft_token_id | INTEGER | Minted NFT token ID |
| jitsi_room_id | VARCHAR(255) | Associated Jitsi room |
| auto_ended | BOOLEAN | Whether cron auto-ended |
| ended | BOOLEAN | Whether auction has ended |

#### **meetings**
Stores Jitsi meeting access tokens and configuration.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| auction_id | INTEGER | Associated auction |
| jitsi_room_id | VARCHAR(255) | Jitsi room identifier |
| jitsi_room_config | JSONB | Room configuration |
| creator_access_token | TEXT | Host's JWT token |
| winner_access_token | TEXT | Winner's JWT token |
| room_url | TEXT | Full meeting URL |
| expires_at | TIMESTAMP | Token expiration |

#### **seaport_orders**
Stores Seaport protocol orders for NFT marketplace functionality.

| Column | Type | Description |
|--------|------|-------------|
| order_hash | VARCHAR(66) | Primary key - Unique order identifier |
| order_type | VARCHAR(20) | Order type: 'listing' or 'offer' |
| nft_contract | VARCHAR(42) | NFT contract address |
| token_id | VARCHAR(78) | NFT token ID |
| maker | VARCHAR(42) | Order creator's wallet address |
| taker | VARCHAR(42) | Optional specific taker address |
| payment_token | VARCHAR(42) | Payment token address (0x0 for native) |
| price | VARCHAR(78) | Price in wei |
| price_decimal | VARCHAR(50) | Human-readable price |
| platform_fee_amount | VARCHAR(78) | Platform fee in wei |
| platform_fee_recipient | VARCHAR(42) | Platform fee recipient address |
| start_time | BIGINT | Order start timestamp |
| end_time | BIGINT | Order end timestamp |
| expires_at | TIMESTAMP | Order expiration date |
| order_components | JSONB | Full Seaport order parameters |
| signature | TEXT | EIP-712 signature |
| is_active | BOOLEAN | Whether order is active |
| is_cancelled | BOOLEAN | Whether order is cancelled |
| is_fulfilled | BOOLEAN | Whether order is fulfilled |
| fulfilled_at | TIMESTAMP | Fulfillment timestamp |
| fulfilled_by | VARCHAR(42) | Fulfiller's wallet address |
| fulfillment_tx_hash | VARCHAR(66) | Fulfillment transaction hash |
| cancelled_at | TIMESTAMP | Cancellation timestamp |
| cancellation_tx_hash | VARCHAR(66) | Cancellation transaction hash |
| para_user_id | VARCHAR(255) | Foreign key to users table |
| created_at | TIMESTAMP | Record creation timestamp |
| updated_at | TIMESTAMP | Record update timestamp |

**Indexes:**
- `idx_token_id` - Fast lookup by NFT token
- `idx_maker` - Fast lookup by order maker
- `idx_order_type` - Filter by listing/offer
- `idx_is_active` - Filter active orders
- `idx_expires_at` - Cleanup expired orders
- `idx_active_orders` - Composite index for common queries

#### **order_fulfillments**
Tracks on-chain order fulfillments.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| order_hash | VARCHAR(66) | Foreign key to seaport_orders |
| fulfiller | VARCHAR(42) | Fulfiller's wallet address |
| transaction_hash | VARCHAR(66) | Unique fulfillment transaction hash |
| block_number | BIGINT | Block number of fulfillment |
| amount_paid | VARCHAR(78) | Amount paid in wei |
| platform_fee_paid | VARCHAR(78) | Platform fee paid in wei |
| fulfilled_at | TIMESTAMP | Fulfillment timestamp |

#### **order_cancellations**
Tracks order cancellations.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| order_hash | VARCHAR(66) | Foreign key to seaport_orders |
| cancelled_by | VARCHAR(42) | Canceller's wallet address |
| transaction_hash | VARCHAR(66) | Optional on-chain cancellation tx |
| cancellation_reason | VARCHAR(255) | Reason for cancellation |
| cancelled_at | TIMESTAMP | Cancellation timestamp |

#### **order_events**
Audit log for all order activities.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| order_hash | VARCHAR(66) | Related order hash |
| event_type | VARCHAR(50) | Event type (created, cancelled, fulfilled, validation_failed) |
| actor | VARCHAR(42) | Wallet address of actor |
| event_data | JSONB | Additional event data |
| created_at | TIMESTAMP | Event timestamp |

---

## API Endpoints

### Base URL
- **Development**: `http://localhost:5000`
- **Production**: `https://your-domain.com`

### Authentication Endpoints

#### POST `/api/auth/para-auth`
Basic Para authentication using verification token.

**Request:**
```json
{
  "verificationToken": "string",
  "walletAddress": "0x..." // optional
}
```

**Response:**
```json
{
  "success": true,
  "token": "jwt_token",
  "user": {
    "id": 1,
    "paraUserId": "para_user_123",
    "email": "user@example.com",
    "authType": "email",
    "displayName": "John Doe",
    "walletAddress": "0x...",
    "hasWallet": true
  }
}
```

#### POST `/api/auth/import-session`

Full Para session import with wallet access.

**Request:**
```json
{
  "session": "serialized_session_string"
}
```

**Response:**
```json
{
  "success": true,
  "token": "jwt_token",
  "user": {
    "id": 1,
    "paraUserId": "para_user_123",
    "walletAddress": "0x...",
    "hasWallet": true
  },
  "wallet": {
    "address": "0x...",
    "type": "EVM"
  }
}
```

#### GET `/api/auth/verify`
Verify JWT token validity.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "user": {
    "userId": 1,
    "paraUserId": "para_user_123",
    "walletAddress": "0x..."
  }
}
```

---

### Auction Endpoints

#### POST `/api/auctions/created`
Record auction creation after blockchain transaction.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request:**
```json
{
  "title": "Meeting with John Doe",
  "description": "30-minute consultation",
  "duration": 100,
  "reservePrice": 0.1,
  "meetingDuration": 30,
  "creatorWallet": "0x...",
  "transactionHash": "0x...",
  "twitterId": "@johndoe",
  "sellerName": "John Doe",
  "profilePicture": "https://...",
  "eventDate": "2024-12-01T10:00:00Z",
  "eventStartTime": "2024-12-01T10:00:00Z",
  "eventEndTime": "2024-12-01T11:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "auction": {
    "id": 42,
    "title": "Meeting with John Doe",
    "creator_para_id": "para_user_123",
    "bid_price": "100000000000000000",
    "end_block": 12345678
  },
  "auctionId": 42,
  "transactionHash": "0x...",
  "blockNumber": 12345600
}
```

#### GET `/api/auctions/active/db`
Get active auctions from database (optimized, no blockchain calls).

**Query Parameters:**
- `limit` (optional): Max results (default: 50, max: 100)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "auctions": [
    {
      "id": 42,
      "sellerName": "John Doe",
      "twitterId": "@johndoe",
      "title": "Meeting with John Doe",
      "profilePicture": "https://...",
      "price": "0.100",
      "priceLabel": "Floor Price",
      "timeLeft": "2h 30m",
      "badge": "LIVE",
      "hasHighestBid": false
    }
  ],
  "total": 1,
  "offset": 0,
  "limit": 50
}
```

#### GET `/api/auctions/ended/db`
Get ended auctions from database.

**Response:**
```json
{
  "success": true,
  "auctions": [
    {
      "id": 40,
      "sellerName": "Jane Smith",
      "title": "Consultation",
      "price": "0.250",
      "priceLabel": "Winning Bid",
      "endedAgo": "3h ago",
      "hasWinner": true,
      "winner": "0x...",
      "nftTokenId": 15
    }
  ]
}
```

#### GET `/api/auctions/db/:auctionId`
Get single auction details from database.

**Response:**
```json
{
  "success": true,
  "auction": {
    "id": 42,
    "title": "Meeting with John Doe",
    "description": "30-minute consultation",
    "sellerName": "John Doe",
    "price": "0.100",
    "priceLabel": "Floor Price",
    "highestBid": "0",
    "highestBidder": null,
    "timeLeft": "2h 30m",
    "blocksRemaining": 4500,
    "ended": false,
    "meetingDuration": 30
  }
}
```

#### GET `/api/auctions/user/created`
Get auctions created by authenticated user.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "auctions": [
    {
      "id": 42,
      "title": "My Meeting",
      "ended": false,
      "has_meeting": false
    }
  ]
}
```

---

### Meeting Endpoints

#### POST `/api/meetings/access-winner`
Check if winner can access meeting (requires NFT burn).

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request:**
```json
{
  "auctionId": 42,
  "walletAddress": "0x..."
}
```

**Response (NFT burn required):**
```json
{
  "success": true,
  "requiresBurn": true,
  "meetingExists": false,
  "nftTokenId": 15,
  "auctionId": 42,
  "message": "You must burn your NFT to access the meeting"
}
```

**Response (Meeting already exists):**
```json
{
  "success": true,
  "requiresBurn": false,
  "meetingExists": true,
  "meeting": {
    "roomId": "auction-42-...",
    "url": "https://8x8.vc/..."
  }
}
```

#### POST `/api/meetings/burn-nft-access`

Burn NFT and create meeting access for winner.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request:**
```json
{
  "auctionId": 42,
  "burnTxHash": "0x...",
  "tokenId": 15
}
```

**Response:**
```json
{
  "success": true,
  "meeting": {
    "url": "https://8x8.vc/meeting-app/auction-42-...?jwt=...",
    "token": "jwt_token",
    "roomId": "auction-42-...",
    "expiresAt": "2024-12-01T12:00:00Z"
  },
  "message": "NFT burned successfully. Meeting access granted."
}
```

#### POST `/api/meetings/access-creator`
Get creator/host access to meeting.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request:**
```json
{
  "auctionId": 42
}
```

**Response:**
```json
{
  "success": true,
  "meetingExists": true,
  "meeting": {
    "url": "https://8x8.vc/meeting-app/auction-42-...?jwt=...",
    "token": "jwt_token",
    "roomId": "auction-42-...",
    "expiresAt": "2024-12-01T12:00:00Z"
  }
}
```

#### POST `/api/meetings/create-direct`
Create direct meeting without authentication (for testing).

**Request:**
```json
{
  "hostName": "Host User",
  "hostEmail": "host@example.com",
  "guestName": "Guest User",
  "guestEmail": "guest@example.com",
  "meetingName": "Quick Meeting",
  "duration": 60
}
```

**Response:**
```json
{
  "success": true,
  "meeting": {
    "roomId": "direct-...",
    "name": "Quick Meeting",
    "duration": 60
  },
  "participants": {
    "host": {
      "url": "https://8x8.vc/...",
      "role": "moderator"
    },
    "guest": {
      "url": "https://8x8.vc/...",
      "role": "participant"
    }
  }
}
```

#### GET `/api/meetings`
List user's meetings.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "meetings": [
    {
      "id": 1,
      "auctionId": 42,
      "roomId": "auction-42-...",
      "url": "https://8x8.vc/...",
      "auctionTitle": "Meeting with John Doe",
      "expiresAt": "2024-12-01T12:00:00Z"
    }
  ]
}
```

---

### Order Endpoints (Seaport Orderbook)

The order endpoints provide a complete marketplace orderbook for NFT trading using the Seaport protocol. Orders are cryptographically signed off-chain and stored in the database for fast querying, with real-time synchronization via WebSocket.

#### POST `/api/orders/listings/create`
Create a new listing order (sell NFT for tokens).

**Authentication:** Required (JWT)

**Request:**
```json
{
  "orderHash": "0x1234...",
  "orderType": "listing",
  "nftContract": "0x6fD65aE833C9679cBC571581CE0f5Cd73D565796",
  "tokenId": "15",
  "maker": "0xABCD...",
  "taker": null,
  "paymentToken": "0x0000000000000000000000000000000000000000",
  "price": "100000000000000000",
  "priceDecimal": "0.1",
  "platformFeeAmount": "2500000000000000",
  "platformFeeRecipient": "0xPLATFORM...",
  "startTime": 1701388800,
  "endTime": 1701475200,
  "orderComponents": {
    "offerer": "0xABCD...",
    "zone": "0x0000000000000000000000000000000000000000",
    "offer": [
      {
        "itemType": 2,
        "token": "0x6fD65aE833C9679cBC571581CE0f5Cd73D565796",
        "identifierOrCriteria": "15",
        "startAmount": "1",
        "endAmount": "1"
      }
    ],
    "consideration": [
      {
        "itemType": 0,
        "token": "0x0000000000000000000000000000000000000000",
        "identifierOrCriteria": "0",
        "startAmount": "97500000000000000",
        "endAmount": "97500000000000000",
        "recipient": "0xABCD..."
      },
      {
        "itemType": 0,
        "token": "0x0000000000000000000000000000000000000000",
        "identifierOrCriteria": "0",
        "startAmount": "2500000000000000",
        "endAmount": "2500000000000000",
        "recipient": "0xPLATFORM..."
      }
    ],
    "orderType": 0,
    "startTime": "1701388800",
    "endTime": "1701475200",
    "zoneHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "salt": "12345678901234567890",
    "conduitKey": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "counter": "0"
  },
  "signature": "0xSIGNATURE..."
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "order": {
    "orderHash": "0x1234...",
    "orderType": "listing",
    "nftContract": "0x6fD65aE833C9679cBC571581CE0f5Cd73D565796",
    "tokenId": "15",
    "maker": "0xABCD...",
    "price": "100000000000000000",
    "priceDecimal": "0.1",
    "paymentToken": "0x0000000000000000000000000000000000000000",
    "expiresAt": "2024-12-02T00:00:00.000Z",
    "isActive": true,
    "isCancelled": false,
    "isFulfilled": false,
    "createdAt": "2024-12-01T00:00:00.000Z"
  },
  "message": "Listing created successfully"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid order data or signature
- `401 Unauthorized` - Missing or invalid JWT token
- `409 Conflict` - Order hash already exists

---

#### POST `/api/orders/offers/create`
Create a new offer order (buy NFT with tokens).

**Authentication:** Required (JWT)

**Request:** Same structure as listing creation, but `orderType` must be `"offer"`

**Response (201 Created):**
```json
{
  "success": true,
  "order": {
    "orderHash": "0x5678...",
    "orderType": "offer",
    "nftContract": "0x6fD65aE833C9679cBC571581CE0f5Cd73D565796",
    "tokenId": "15",
    "maker": "0xEFGH...",
    "price": "120000000000000000",
    "priceDecimal": "0.12",
    "paymentToken": "0x0000000000000000000000000000000000000000",
    "expiresAt": "2024-12-02T00:00:00.000Z",
    "isActive": true,
    "isCancelled": false,
    "isFulfilled": false,
    "createdAt": "2024-12-01T00:00:00.000Z"
  },
  "message": "Offer created successfully"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid order data or signature
- `401 Unauthorized` - Missing or invalid JWT token
- `409 Conflict` - Order hash already exists

---

#### GET `/api/orders/listings/:tokenId`
Get the active listing for a specific NFT token.

**Authentication:** Not required (public endpoint)

**Query Parameters:**
- `nftContract` (required): NFT contract address

**Example:**
```
GET /api/orders/listings/15?nftContract=0x6fD65aE833C9679cBC571581CE0f5Cd73D565796
```

**Response (200 OK):**
```json
{
  "success": true,
  "listing": {
    "orderHash": "0x1234...",
    "orderType": "listing",
    "tokenId": "15",
    "nftContract": "0x6fD65aE833C9679cBC571581CE0f5Cd73D565796",
    "maker": "0xABCD...",
    "makerName": "John Doe",
    "price": "100000000000000000",
    "priceDecimal": "0.1",
    "paymentToken": "0x0000000000000000000000000000000000000000",
    "paymentTokenSymbol": "AVAX",
    "expiresAt": "2024-12-02T00:00:00.000Z",
    "timeRemaining": "23h 45m",
    "orderComponents": { /* full order components */ },
    "signature": "0xSIGNATURE...",
    "createdAt": "2024-12-01T00:00:00.000Z"
  }
}
```

**Response (404 Not Found):**
```json
{
  "success": false,
  "error": "No active listing found",
  "listing": null
}
```

**Error Responses:**
- `400 Bad Request` - Missing nftContract parameter

---

#### GET `/api/orders/offers/:tokenId`
Get all active offers for a specific NFT token.

**Authentication:** Not required (public endpoint)

**Query Parameters:**
- `nftContract` (required): NFT contract address
- `limit` (optional): Max results (default: 50, max: 100)
- `offset` (optional): Pagination offset (default: 0)
- `sort` (optional): Sort order - `price_asc`, `price_desc`, `recent` (default: `price_desc`)

**Example:**
```
GET /api/orders/offers/15?nftContract=0x6fD65aE833C9679cBC571581CE0f5Cd73D565796&sort=price_desc&limit=10
```

**Response (200 OK):**
```json
{
  "success": true,
  "offers": [
    {
      "orderHash": "0x5678...",
      "orderType": "offer",
      "tokenId": "15",
      "nftContract": "0x6fD65aE833C9679cBC571581CE0f5Cd73D565796",
      "maker": "0xEFGH...",
      "makerName": "Jane Smith",
      "price": "120000000000000000",
      "priceDecimal": "0.12",
      "paymentToken": "0x0000000000000000000000000000000000000000",
      "paymentTokenSymbol": "AVAX",
      "expiresAt": "2024-12-02T00:00:00.000Z",
      "timeRemaining": "23h 45m",
      "orderComponents": { /* full order components */ },
      "signature": "0xSIGNATURE...",
      "createdAt": "2024-12-01T00:00:00.000Z"
    }
  ],
  "total": 5,
  "limit": 10,
  "offset": 0
}
```

**Error Responses:**
- `400 Bad Request` - Missing nftContract parameter or invalid query params

---

#### GET `/api/orders/user/listings`
Get all active listings created by the authenticated user.

**Authentication:** Required (JWT)

**Response (200 OK):**
```json
{
  "success": true,
  "listings": [
    {
      "orderHash": "0x1234...",
      "orderType": "listing",
      "tokenId": "15",
      "nftContract": "0x6fD65aE833C9679cBC571581CE0f5Cd73D565796",
      "price": "100000000000000000",
      "priceDecimal": "0.1",
      "paymentToken": "0x0000000000000000000000000000000000000000",
      "expiresAt": "2024-12-02T00:00:00.000Z",
      "isActive": true,
      "createdAt": "2024-12-01T00:00:00.000Z"
    }
  ],
  "total": 1
}
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid JWT token

---

#### GET `/api/orders/user/offers`
Get all active offers created by the authenticated user.

**Authentication:** Required (JWT)

**Response (200 OK):**
```json
{
  "success": true,
  "offers": [
    {
      "orderHash": "0x5678...",
      "orderType": "offer",
      "tokenId": "15",
      "nftContract": "0x6fD65aE833C9679cBC571581CE0f5Cd73D565796",
      "price": "120000000000000000",
      "priceDecimal": "0.12",
      "paymentToken": "0x0000000000000000000000000000000000000000",
      "expiresAt": "2024-12-02T00:00:00.000Z",
      "isActive": true,
      "createdAt": "2024-12-01T00:00:00.000Z"
    }
  ],
  "total": 1
}
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid JWT token

---

#### DELETE `/api/orders/:orderHash/cancel`
Cancel an order. Only the order maker can cancel their own orders.

**Authentication:** Required (JWT)

**Request:**
```json
{
  "reason": "Changed my mind",
  "transactionHash": "0xCANCEL_TX..." // optional on-chain cancellation tx
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "order": {
    "orderHash": "0x1234...",
    "orderType": "listing",
    "tokenId": "15",
    "isActive": false,
    "isCancelled": true,
    "cancelledAt": "2024-12-01T12:00:00.000Z"
  },
  "message": "Order cancelled successfully"
}
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - User is not the order maker
- `404 Not Found` - Order not found
- `409 Conflict` - Order already fulfilled or cancelled

---

#### POST `/api/orders/:orderHash/fulfill`
Record order fulfillment after on-chain execution. This endpoint is called after the order is fulfilled on the Seaport contract.

**Authentication:** Required (JWT)

**Request:**
```json
{
  "fulfiller": "0xFULFILLER...",
  "transactionHash": "0xFULFILL_TX...",
  "blockNumber": 12345678,
  "amountPaid": "100000000000000000",
  "platformFeePaid": "2500000000000000"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "order": {
    "orderHash": "0x1234...",
    "orderType": "listing",
    "tokenId": "15",
    "isActive": false,
    "isFulfilled": true,
    "fulfilledAt": "2024-12-01T12:00:00.000Z",
    "fulfilledBy": "0xFULFILLER...",
    "fulfillmentTxHash": "0xFULFILL_TX..."
  },
  "message": "Order fulfillment recorded successfully"
}
```

**Error Responses:**
- `400 Bad Request` - Missing required fields
- `401 Unauthorized` - Missing or invalid JWT token
- `404 Not Found` - Order not found
- `409 Conflict` - Order already fulfilled

---

#### GET `/api/orders/marketplace`
Get all marketplace orders with filtering, sorting, and pagination.

**Authentication:** Not required (public endpoint)

**Query Parameters:**
- `limit` (optional): Max results (default: 50, max: 100)
- `offset` (optional): Pagination offset (default: 0)
- `orderType` (optional): Filter by type - `listing` or `offer`
- `nftContract` (optional): Filter by NFT contract address
- `sortBy` (optional): Sort field - `created_at`, `price`, `expires_at` (default: `created_at`)
- `sortOrder` (optional): Sort direction - `ASC` or `DESC` (default: `DESC`)

**Example:**
```
GET /api/orders/marketplace?orderType=listing&sortBy=price&sortOrder=ASC&limit=20
```

**Response (200 OK):**
```json
{
  "success": true,
  "orders": [
    {
      "orderHash": "0x1234...",
      "orderType": "listing",
      "tokenId": "15",
      "nftContract": "0x6fD65aE833C9679cBC571581CE0f5Cd73D565796",
      "maker": "0xABCD...",
      "makerName": "John Doe",
      "price": "100000000000000000",
      "priceDecimal": "0.1",
      "paymentToken": "0x0000000000000000000000000000000000000000",
      "expiresAt": "2024-12-02T00:00:00.000Z",
      "createdAt": "2024-12-01T00:00:00.000Z"
    }
  ],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

**Error Responses:**
- `400 Bad Request` - Invalid query parameters

---

#### GET `/api/orders/:orderHash`
Get a specific order by its hash.

**Authentication:** Not required (public endpoint)

**Response (200 OK):**
```json
{
  "success": true,
  "order": {
    "orderHash": "0x1234...",
    "orderType": "listing",
    "tokenId": "15",
    "nftContract": "0x6fD65aE833C9679cBC571581CE0f5Cd73D565796",
    "maker": "0xABCD...",
    "makerName": "John Doe",
    "price": "100000000000000000",
    "priceDecimal": "0.1",
    "paymentToken": "0x0000000000000000000000000000000000000000",
    "paymentTokenSymbol": "AVAX",
    "platformFeeAmount": "2500000000000000",
    "platformFeeRecipient": "0xPLATFORM...",
    "expiresAt": "2024-12-02T00:00:00.000Z",
    "orderComponents": { /* full order components */ },
    "signature": "0xSIGNATURE...",
    "isActive": true,
    "isCancelled": false,
    "isFulfilled": false,
    "createdAt": "2024-12-01T00:00:00.000Z",
    "updatedAt": "2024-12-01T00:00:00.000Z"
  }
}
```

**Error Responses:**
- `404 Not Found` - Order not found

---

### WebSocket Events (Order Namespace)

The order system provides real-time synchronization via WebSocket using Socket.IO. All order events are broadcast through the `/orders` namespace.

#### Connection

**Namespace:** `/orders`

**Authentication:** Required (JWT token in auth object)

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000/orders', {
  auth: {
    token: 'your_jwt_token'
  }
});

socket.on('connect', () => {
  console.log('Connected to order namespace');
});
```

#### Client Events (Emit)

##### `join-nft`
Join a room for a specific NFT to receive updates for that NFT only.

**Payload:**
```json
{
  "nftContract": "0x6fD65aE833C9679cBC571581CE0f5Cd73D565796",
  "tokenId": "15"
}
```

**Response Event:** `joined-nft`
```json
{
  "nftContract": "0x6fD65aE833C9679cBC571581CE0f5Cd73D565796",
  "tokenId": "15",
  "room": "nft:0x6fd65ae833c9679cbc571581ce0f5cd73d565796:15"
}
```

##### `leave-nft`
Leave a room for a specific NFT.

**Payload:**
```json
{
  "nftContract": "0x6fD65aE833C9679cBC571581CE0f5Cd73D565796",
  "tokenId": "15"
}
```

#### Server Events (Listen)

##### `order:created`
Emitted when a new order is created for a specific NFT (room-based).

**Payload:**
```json
{
  "orderHash": "0x1234...",
  "orderType": "listing",
  "tokenId": "15",
  "nftContract": "0x6fD65aE833C9679cBC571581CE0f5Cd73D565796",
  "maker": "0xABCD...",
  "price": "100000000000000000",
  "paymentToken": "0x0000000000000000000000000000000000000000",
  "timestamp": "2024-12-01T00:00:00.000Z"
}
```

##### `order:cancelled`
Emitted when an order is cancelled for a specific NFT (room-based).

**Payload:**
```json
{
  "orderHash": "0x1234...",
  "orderType": "listing",
  "tokenId": "15",
  "nftContract": "0x6fD65aE833C9679cBC571581CE0f5Cd73D565796",
  "maker": "0xABCD...",
  "timestamp": "2024-12-01T12:00:00.000Z"
}
```

##### `order:fulfilled`
Emitted when an order is fulfilled for a specific NFT (room-based).

**Payload:**
```json
{
  "orderHash": "0x1234...",
  "orderType": "listing",
  "tokenId": "15",
  "nftContract": "0x6fD65aE833C9679cBC571581CE0f5Cd73D565796",
  "maker": "0xABCD...",
  "fulfiller": "0xFULFILLER...",
  "transactionHash": "0xFULFILL_TX...",
  "timestamp": "2024-12-01T12:00:00.000Z"
}
```

##### `marketplace:order:created`
Emitted to all connected clients when any order is created (global broadcast).

**Payload:** Same as `order:created`

##### `marketplace:order:cancelled`
Emitted to all connected clients when any order is cancelled (global broadcast).

**Payload:** Same as `order:cancelled`

##### `marketplace:order:fulfilled`
Emitted to all connected clients when any order is fulfilled (global broadcast).

**Payload:** Same as `order:fulfilled`

#### WebSocket Usage Example

```javascript
import io from 'socket.io-client';

// Connect to order namespace
const socket = io('http://localhost:5000/orders', {
  auth: { token: jwtToken }
});

// Join specific NFT room
socket.emit('join-nft', {
  nftContract: '0x6fD65aE833C9679cBC571581CE0f5Cd73D565796',
  tokenId: '15'
});

// Listen for NFT-specific events
socket.on('order:created', (data) => {
  console.log('New order for this NFT:', data);
  // Update UI with new listing/offer
});

socket.on('order:cancelled', (data) => {
  console.log('Order cancelled for this NFT:', data);
  // Remove order from UI
});

socket.on('order:fulfilled', (data) => {
  console.log('Order fulfilled for this NFT:', data);
  // Mark order as sold in UI
});

// Listen for marketplace-wide events
socket.on('marketplace:order:created', (data) => {
  console.log('New order in marketplace:', data);
  // Update marketplace feed
});

// Leave NFT room when done
socket.emit('leave-nft', {
  nftContract: '0x6fD65aE833C9679cBC571581CE0f5Cd73D565796',
  tokenId: '15'
});

// Disconnect
socket.disconnect();
```

---

### Order Error Codes

| HTTP Code | Error Type | Description | Example |
|-----------|------------|-------------|---------|
| 400 | `ValidationError` | Invalid request data | Invalid signature, missing required fields |
| 401 | `UnauthorizedError` | Authentication failed | Missing or invalid JWT token |
| 403 | `ForbiddenError` | Authorization failed | User is not the order maker |
| 404 | `NotFoundError` | Resource not found | Order hash not found |
| 409 | `ConflictError` | Resource conflict | Order already exists, already fulfilled, or already cancelled |
| 500 | `InternalServerError` | Server error | Database error, blockchain RPC error |

#### Error Response Format

All error responses follow this format:

```json
{
  "error": "Error type",
  "details": "Detailed error message",
  "message": "User-friendly error message"
}
```

#### Common Error Examples

**Invalid Signature (400):**
```json
{
  "error": "ValidationError",
  "details": "Order signature verification failed",
  "message": "Invalid order signature"
}
```

**Unauthorized (401):**
```json
{
  "error": "UnauthorizedError",
  "details": "JWT token is missing or invalid",
  "message": "Authentication required"
}
```

**Not Order Maker (403):**
```json
{
  "error": "ForbiddenError",
  "details": "Only the order maker can cancel this order",
  "message": "You are not authorized to cancel this order"
}
```

**Order Not Found (404):**
```json
{
  "error": "NotFoundError",
  "details": "Order with hash 0x1234... not found",
  "message": "Order not found"
}
```

**Order Already Exists (409):**
```json
{
  "error": "ConflictError",
  "details": "An order with this hash already exists",
  "message": "Order already exists"
}
```

**Order Already Fulfilled (409):**
```json
{
  "error": "ConflictError",
  "details": "This order has already been fulfilled",
  "message": "Cannot cancel a fulfilled order"
}
```

---

### Contract Endpoints

#### GET `/api/contract/stats`
Get smart contract statistics.

**Response:**
```json
{
  "success": true,
  "stats": {
    "auctionCounter": 42,
    "platformFee": 250,
    "owner": "0x...",
    "paused": false,
    "contractBalance": "1.5",
    "database": {
      "auctions": {
        "total_auctions": "42",
        "active_auctions": "10",
        "ended_auctions": "32"
      }
    }
  }
}
```

#### GET `/api/contract/nfts/:address`
Get NFTs owned by user.

**Response:**
```json
{
  "success": true,
  "nfts": {
    "tokenIds": [15, 23, 31],
    "auctionIds": [40, 38, 35]
  },
  "total": 3
}
```

#### GET `/api/contract/dashboard/user/:address`
Get user dashboard with auction participation.

**Response:**
```json
{
  "success": true,
  "dashboard": {
    "upcomingEvents": [],
    "eventsInAuction": [
      {
        "id": 42,
        "title": "Meeting",
        "highestBid": "0.1"
      }
    ],
    "pastEvents": []
  }
}
```

---

### Admin Endpoints

#### GET `/api/admin/db-stats`
Get database statistics (no auth required for monitoring).

**Response:**
```json
{
  "success": true,
  "database": "connected",
  "stats": {
    "totalUsers": "150",
    "totalAuctions": "42",
    "totalMeetings": "30"
  },
  "recentUsers": [
    {
      "id": 1,
      "paraUserId": "para_user_123",
      "email": "user@example.com",
      "wallet": "0x..."
    }
  ]
}
```

---

## Authentication Flow

### Para Authentication (2-Step Process)

#### Step 1: Basic Authentication
Frontend gets verification token from Para SDK and sends to backend.

```javascript
// Frontend
const token = await para.getVerificationToken();
const response = await fetch('/api/auth/para-auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    verificationToken: token,
    walletAddress: userWallet // optional
  })
});
```

Backend verifies with Para API and returns JWT.

#### Step 2: Full Session Import (for wallet operations)
Frontend exports full session and imports to backend.

```javascript
// Frontend
const session = await para.exportSession();
const response = await fetch('/api/auth/import-session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ session })
});
```

Backend imports session and returns JWT with wallet access.

### JWT Token Structure

```json
{
  "userId": 1,
  "paraUserId": "para_user_123",
  "authType": "email",
  "email": "user@example.com",
  "displayName": "John Doe",
  "walletAddress": "0x...",
  "hasWallet": true,
  "role": "para_user",
  "iat": 1234567890,
  "exp": 1234654290
}
```

### Protected Routes
All routes requiring authentication expect:
```
Authorization: Bearer <jwt_token>
```

---

## Auction Lifecycle

### 1. Auction Creation

```
┌──────────┐
│ Frontend │
└────┬─────┘
     │
     │ 1. User fills auction form
     │
     ▼
┌────────────────┐
│ Smart Contract │
└────┬───────────┘
     │
     │ 2. createAuction() transaction
     │    - Emits AuctionCreated event
     │
     ▼
┌──────────┐
│ Frontend │
└────┬─────┘
     │
     │ 3. POST /api/auctions/created
     │    - transactionHash
     │    - auction details
     │
     ▼
┌─────────┐
│ Backend │
└────┬────┘
     │
     │ 4. Verify transaction
     │ 5. Parse AuctionCreated event
     │ 6. Store in database
     │
     ▼
┌──────────┐
│ Database │
└──────────┘
```

### 2. Active Auction Phase

```
┌──────────────┐
│  Cron Job    │ (runs every 10 seconds)
└──────┬───────┘
       │
       │ 1. Check active auctions
       │
       ▼
┌────────────────┐
│ Smart Contract │
└────┬───────────┘
       │
       │ 2. Get auction state
       │    - highest_bid
       │    - highest_bidder
       │    - blocks_remaining
       │
       ▼
┌──────────┐
│ Database │ 3. Update cached data
└──────────┘
```

### 3. Auction Ending

```
┌──────────────┐
│  Cron Job    │
└──────┬───────┘
       │
       │ 1. Detect end_block reached
       │
       ▼
┌────────────────┐
│ Smart Contract │
└────┬───────────┘
       │
       │ 2. Call endAuction()
       │    - Transfers funds
       │    - Mints NFT to winner
       │    - Emits AuctionEnded event
       │
       ▼
┌──────────┐
│ Database │ 3. Mark auction as ended
└──────────┘    4. Store NFT token ID
```

### 4. Meeting Access (On-Demand)

```
┌─────────┐
│ Winner  │
└────┬────┘
     │
     │ 1. POST /api/meetings/access-winner
     │    - Check if NFT burn required
     │
     ▼
┌─────────┐
│ Backend │
└────┬────┘
     │
     │ 2. Verify winner owns NFT
     │ 3. Return requiresBurn: true
     │
     ▼
┌─────────┐
│ Winner  │
└────┬────┘
     │
     │ 4. Burn NFT on blockchain
     │
     ▼
┌────────────────┐
│ Smart Contract │
└────┬───────────┘
     │
     │ 5. Emit NFTBurned event
     │
     ▼
┌─────────┐
│ Winner  │
└────┬────┘
     │
     │ 6. POST /api/meetings/burn-nft-access
     │    - burnTxHash
     │    - tokenId
     │
     ▼
┌─────────┐
│ Backend │
└────┬────┘
     │
     │ 7. Verify burn transaction
     │ 8. Create Jitsi meeting
     │ 9. Generate JWT tokens
     │ 10. Store in database
     │
     ▼
┌─────────┐
│ Winner  │ 11. Receive meeting URL
└─────────┘
```

---

## Meeting System

### Jitsi as a Service (JaaS) Integration

#### Configuration
```javascript
{
  domain: '8x8.vc',
  appId: 'meeting-app',
  privateKey: 'RSA_PRIVATE_KEY',
  kid: 'vpaas-magic-cookie-...',
  sub: 'vpaas-magic-cookie-...'
}
```

#### JWT Token Generation
Backend generates RS256 JWT tokens for meeting access:

```javascript
{
  aud: 'jitsi',
  iss: 'chat',
  sub: 'meeting-app',
  room: '*',
  exp: timestamp + 2h,
  context: {
    user: {
      id: 'user_123',
      name: 'John Doe',
      email: 'john@example.com',
      moderator: 'true' // for host
    }
  }
}
```

#### Meeting URL Format
```
https://8x8.vc/meeting-app/auction-42-timestamp?jwt=<token>
```

### Meeting Roles

| Role | Permissions |
|------|-------------|
| **Moderator** (Host) | Start/end meeting, mute participants, record |
| **Participant** (Winner) | Join meeting, audio/video |

---

## Blockchain Integration

### Smart Contract: MeetingAuction

**Network:** Avalanche C-Chain (Fuji Testnet / Mainnet)
**Address:** `0x6fD65aE833C9679cBC571581CE0f5Cd73D565796`

### Key Contract Functions

#### Read Functions
```solidity
function getAuction(uint256 auctionId) 
  returns (Auction memory)

function getActiveAuctions(uint256 offset, uint256 limit) 
  returns (uint256[] memory)

function getUserNFTs(address user) 
  returns (uint256[] tokenIds, uint256[] auctionIds)

function ownerOf(uint256 tokenId) 
  returns (address)
```

#### Write Functions
```solidity
function createAuction(
  string memory title,
  uint256 reservePrice,
  uint256 duration,
  string memory metadataIPFS
) returns (uint256 auctionId)

function placeBid(uint256 auctionId) 
  payable

function endAuction(uint256 auctionId)

function burnNFTForMeeting(uint256 tokenId)
```

### Events
```solidity
event AuctionCreated(
  uint256 indexed auctionId,
  address indexed host,
  string twitterId,
  uint256 reservePrice,
  uint256 endBlock,
  string metadataIPFS
)

event BidPlaced(
  uint256 indexed auctionId,
  address indexed bidder,
  uint256 amount,
  uint256 newEndBlock
)

event AuctionEnded(
  uint256 indexed auctionId,
  address indexed winner,
  address indexed host,
  uint256 winningBid,
  uint256 nftTokenId
)

event NFTBurned(
  uint256 indexed tokenId,
  uint256 indexed auctionId
)
```

### Web3 Provider Configuration

```javascript
{
  provider: 'wss://api.avax-test.network/ext/bc/C/ws',
  httpProvider: 'https://api.avax-test.network/ext/bc/C/rpc',
  chainId: 43113, // Fuji testnet
  blockTime: 2 // seconds per block
}
```

---

## Cron Jobs & Background Services

### AuctionCronService

**Schedule:** Every 10 seconds
**Purpose:** Monitor and process ended auctions

#### Workflow

1. **Fetch Active Auctions**
   - Query database for unprocessed auctions
   - Call `contract.getActiveAuctions()` for efficiency

2. **Check End Conditions**
   - Compare `currentBlock >= endBlock`
   - Identify auctions ready to end

3. **Batch End Auctions**
   - Call `contract.batchEndAuctions([ids])`
   - Fallback to individual `endAuction()` if batch fails

4. **Update Database**
   - Mark auctions as `auto_ended = true`
   - Store NFT token IDs
   - Update bid amounts and time remaining

5. **Update Active Auctions**
   - Refresh `highest_bid`, `highest_bidder`
   - Calculate `blocks_remaining`, `time_remaining_seconds`

#### Optimization Features
- Database-first filtering (avoid unnecessary RPC calls)
- Batch processing (end multiple auctions in one transaction)
- Smart caching (only check unprocessed auctions)
- Real-time updates (every 10 seconds)

#### Logging
```
🚀 CRON JOB TRIGGERED at 2024-12-01T10:00:00Z
📦 Current block: 12345678
💾 Found 5 unprocessed auctions in database
⛓️  Contract reports 3 active auctions
🔍 Total auctions to check: 5
🎯 Auction 42: Ready to process - Winner: 0x... (0.1 AVAX)
⛓️  BATCH ENDING 2 auctions in ONE transaction...
✅ BATCH SUCCESS! 2 auctions ended in one transaction
📊 Updating bid amounts for 3 active auctions...
✅ CRON JOB COMPLETED in 1250ms
```

---

## Environment Configuration

### Required Environment Variables

```bash
# Server
PORT=5000
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:password@host:5432/database
# OR individual vars:
DB_HOST=localhost
DB_PORT=5432
DB_NAME=meeting_auction
DB_USER=postgres
DB_PASSWORD=password

# Para Authentication
PARA_API_KEY=your_para_api_key
PARA_SECRET_API_KEY=your_para_secret_key
PARA_ENVIRONMENT=beta

# JWT
JWT_SECRET=your_jwt_secret_key

# Blockchain (Avalanche)
RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
AVALANCHE_RPC=https://api.avax-test.network/ext/bc/C/rpc
CONTRACT_ADDRESS=0x6fD65aE833C9679cBC571581CE0f5Cd73D565796
PLATFORM_PRIVATE_KEY=your_private_key
WALLET_PRIVATE_KEY=your_private_key

# Jitsi (JaaS)
JITSI_DOMAIN=8x8.vc
JAAS_APP_ID=vpaas-magic-cookie-...
JAAS_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----...
JAAS_KID=vpaas-magic-cookie-.../...
JAAS_SUB=vpaas-magic-cookie-...

# Frontend
FRONTEND_URL=https://your-frontend.vercel.app
```

### Optional Variables
```bash
# Logging
LOG_LEVEL=info

# CORS
ALLOWED_ORIGINS=http://localhost:3000,https://your-frontend.com
```

---

## Error Handling

### Standard Error Response Format

```json
{
  "error": "Error message",
  "details": "Detailed error description",
  "message": "Internal server error"
}
```

### Common Error Codes

| Code | Meaning | Example |
|------|---------|---------|
| 400 | Bad Request | Invalid input data |
| 401 | Unauthorized | Invalid or missing JWT token |
| 403 | Forbidden | User not authorized for action |
| 404 | Not Found | Auction/meeting not found |
| 409 | Conflict | Auction already recorded |
| 500 | Internal Server Error | Database/blockchain error |

### Error Handling Best Practices

1. **Validation Errors** (400)
   - Use Joi schema validation
   - Return specific field errors

2. **Authentication Errors** (401)
   - Check JWT token validity
   - Verify Para session

3. **Authorization Errors** (403)
   - Verify wallet ownership
   - Check auction creator/winner

4. **Blockchain Errors**
   - Retry failed transactions
   - Log transaction hashes
   - Provide fallback mechanisms

5. **Database Errors**
   - Use connection pooling
   - Handle timeouts gracefully
   - Log query failures

---

## Frontend Integration Guide

### 1. Authentication Flow

```javascript
// Step 1: Basic auth
const token = await para.getVerificationToken();
const authResponse = await fetch('/api/auth/para-auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    verificationToken: token,
    walletAddress: userWallet 
  })
});
const { token: jwtToken } = await authResponse.json();

// Step 2: Full session (for wallet operations)
const session = await para.exportSession();
const sessionResponse = await fetch('/api/auth/import-session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ session })
});
const { token: fullJwtToken } = await sessionResponse.json();

// Use JWT in subsequent requests
const headers = {
  'Authorization': `Bearer ${fullJwtToken}`,
  'Content-Type': 'application/json'
};
```

### 2. Create Auction

```javascript
// Step 1: Create auction on blockchain
const tx = await contract.createAuction(
  title,
  ethers.parseEther(reservePrice),
  duration,
  metadataIPFS
);
const receipt = await tx.wait();

// Step 2: Record in backend
const response = await fetch('/api/auctions/created', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    title,
    description,
    duration,
    reservePrice,
    meetingDuration,
    creatorWallet: userWallet,
    transactionHash: receipt.hash,
    twitterId: '@username',
    sellerName: 'John Doe',
    profilePicture: 'https://...'
  })
});
```

### 3. Fetch Active Auctions

```javascript
const response = await fetch('/api/auctions/active/db?limit=50&offset=0');
const { auctions } = await response.json();

// Display auction cards
auctions.forEach(auction => {
  console.log(`${auction.title} - ${auction.price} AVAX`);
  console.log(`Time left: ${auction.timeLeft}`);
  console.log(`Badge: ${auction.badge}`); // LIVE or HOT
});
```

### 4. Place Bid

```javascript
// Place bid on blockchain
const tx = await contract.placeBid(auctionId, {
  value: ethers.parseEther(bidAmount)
});
await tx.wait();

// Backend cron will automatically update database
// Frontend can poll /api/auctions/db/:auctionId for updates
```

### 5. Access Meeting (Winner)

```javascript
// Step 1: Check access requirements
const checkResponse = await fetch('/api/meetings/access-winner', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    auctionId,
    walletAddress: userWallet
  })
});
const { requiresBurn, nftTokenId } = await checkResponse.json();

if (requiresBurn) {
  // Step 2: Burn NFT on blockchain
  const burnTx = await contract.burnNFTForMeeting(nftTokenId);
  const burnReceipt = await burnTx.wait();
  
  // Step 3: Get meeting access
  const accessResponse = await fetch('/api/meetings/burn-nft-access', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwtToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      auctionId,
      burnTxHash: burnReceipt.hash,
      tokenId: nftTokenId
    })
  });
  const { meeting } = await accessResponse.json();
  
  // Step 4: Open meeting URL
  window.open(meeting.url, '_blank');
}
```

### 6. Access Meeting (Creator)

```javascript
const response = await fetch('/api/meetings/access-creator', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ auctionId })
});
const { meeting } = await response.json();

if (meeting) {
  window.open(meeting.url, '_blank');
}
```

### 7. Real-time Updates (WebSocket)

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: { token: jwtToken }
});

// Join auction room
socket.emit('join-auction', auctionId);

// Listen for bid updates
socket.on('bid-placed', (data) => {
  console.log('New bid:', data);
  // Update UI
});

// Listen for auction ended
socket.on('auction-ended', (data) => {
  console.log('Auction ended:', data);
  // Update UI
});
```

### 8. Order Management (Seaport Orderbook)

#### Create Listing

```javascript
import { Seaport } from '@opensea/seaport-js';
import { ethers } from 'ethers';

// Initialize Seaport SDK
const provider = new ethers.BrowserProvider(window.ethereum);
const signer = await provider.getSigner();
const seaport = new Seaport(signer);

// Create listing order
const { executeAllActions } = await seaport.createOrder({
  offer: [
    {
      itemType: 2, // ERC721
      token: nftContractAddress,
      identifier: tokenId,
    },
  ],
  consideration: [
    {
      amount: ethers.parseEther(price).toString(),
      recipient: await signer.getAddress(),
    },
    {
      amount: ethers.parseEther((price * 0.025).toString()).toString(), // 2.5% platform fee
      recipient: platformFeeRecipient,
    },
  ],
  endTime: Math.floor(Date.now() / 1000) + 86400, // 24 hours
});

const order = await executeAllActions();

// Submit to backend
const response = await fetch('/api/orders/listings/create', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    orderHash: order.orderHash,
    orderType: 'listing',
    nftContract: nftContractAddress,
    tokenId: tokenId,
    maker: await signer.getAddress(),
    paymentToken: ethers.ZeroAddress,
    price: ethers.parseEther(price).toString(),
    priceDecimal: price,
    platformFeeAmount: ethers.parseEther((price * 0.025).toString()).toString(),
    platformFeeRecipient: platformFeeRecipient,
    startTime: order.parameters.startTime,
    endTime: order.parameters.endTime,
    orderComponents: order.parameters,
    signature: order.signature,
  }),
});

const { order: createdOrder } = await response.json();
console.log('Listing created:', createdOrder);
```

#### Create Offer

```javascript
// Create offer order
const { executeAllActions } = await seaport.createOrder({
  offer: [
    {
      amount: ethers.parseEther(offerPrice).toString(),
      token: ethers.ZeroAddress, // Native token (AVAX)
    },
  ],
  consideration: [
    {
      itemType: 2, // ERC721
      token: nftContractAddress,
      identifier: tokenId,
      recipient: await signer.getAddress(),
    },
  ],
  endTime: Math.floor(Date.now() / 1000) + 86400, // 24 hours
});

const order = await executeAllActions();

// Submit to backend
const response = await fetch('/api/orders/offers/create', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    orderHash: order.orderHash,
    orderType: 'offer',
    nftContract: nftContractAddress,
    tokenId: tokenId,
    maker: await signer.getAddress(),
    paymentToken: ethers.ZeroAddress,
    price: ethers.parseEther(offerPrice).toString(),
    priceDecimal: offerPrice,
    startTime: order.parameters.startTime,
    endTime: order.parameters.endTime,
    orderComponents: order.parameters,
    signature: order.signature,
  }),
});

const { order: createdOrder } = await response.json();
console.log('Offer created:', createdOrder);
```

#### Fetch Orders for NFT

```javascript
// Get listing
const listingResponse = await fetch(
  `/api/orders/listings/${tokenId}?nftContract=${nftContractAddress}`
);
const { listing } = await listingResponse.json();

if (listing) {
  console.log('Current listing:', listing.priceDecimal, 'AVAX');
}

// Get offers
const offersResponse = await fetch(
  `/api/orders/offers/${tokenId}?nftContract=${nftContractAddress}&sort=price_desc&limit=10`
);
const { offers } = await offersResponse.json();

console.log(`${offers.length} offers found`);
offers.forEach(offer => {
  console.log(`${offer.makerName}: ${offer.priceDecimal} AVAX`);
});
```

#### Fulfill Order

```javascript
// Fulfill a listing (buy NFT)
const { executeAllActions } = await seaport.fulfillOrder({
  order: listing.orderComponents,
  accountAddress: await signer.getAddress(),
});

const transaction = await executeAllActions();
const receipt = await transaction.wait();

// Record fulfillment in backend
const response = await fetch(`/api/orders/${listing.orderHash}/fulfill`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    fulfiller: await signer.getAddress(),
    transactionHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    amountPaid: listing.price,
    platformFeePaid: listing.platformFeeAmount,
  }),
});

const { order: fulfilledOrder } = await response.json();
console.log('Order fulfilled:', fulfilledOrder);
```

#### Cancel Order

```javascript
// Cancel order
const response = await fetch(`/api/orders/${orderHash}/cancel`, {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    reason: 'Changed my mind',
  }),
});

const { order: cancelledOrder } = await response.json();
console.log('Order cancelled:', cancelledOrder);
```

#### Real-time Order Updates

```javascript
import io from 'socket.io-client';

// Connect to order namespace
const orderSocket = io('http://localhost:5000/orders', {
  auth: { token: jwtToken }
});

// Join NFT-specific room
orderSocket.emit('join-nft', {
  nftContract: nftContractAddress,
  tokenId: tokenId,
});

// Listen for new orders
orderSocket.on('order:created', (data) => {
  console.log('New order:', data);
  if (data.orderType === 'listing') {
    // Update listing display
    updateListingUI(data);
  } else {
    // Add to offers list
    addOfferToUI(data);
  }
});

// Listen for cancellations
orderSocket.on('order:cancelled', (data) => {
  console.log('Order cancelled:', data);
  removeOrderFromUI(data.orderHash);
});

// Listen for fulfillments
orderSocket.on('order:fulfilled', (data) => {
  console.log('Order fulfilled:', data);
  markOrderAsSold(data.orderHash);
});

// Listen for marketplace-wide events
orderSocket.on('marketplace:order:created', (data) => {
  console.log('New marketplace order:', data);
  // Update marketplace feed
});

// Clean up on unmount
return () => {
  orderSocket.emit('leave-nft', {
    nftContract: nftContractAddress,
    tokenId: tokenId,
  });
  orderSocket.disconnect();
};
```

#### Browse Marketplace

```javascript
// Get all marketplace orders
const response = await fetch(
  '/api/orders/marketplace?orderType=listing&sortBy=price&sortOrder=ASC&limit=50'
);
const { orders, total } = await response.json();

console.log(`${total} listings in marketplace`);
orders.forEach(order => {
  console.log(`Token ${order.tokenId}: ${order.priceDecimal} AVAX`);
});

// Get user's orders
const listingsResponse = await fetch('/api/orders/user/listings', {
  headers: { 'Authorization': `Bearer ${jwtToken}` }
});
const { listings } = await listingsResponse.json();

const offersResponse = await fetch('/api/orders/user/offers', {
  headers: { 'Authorization': `Bearer ${jwtToken}` }
});
const { offers: userOffers } = await offersResponse.json();

console.log(`You have ${listings.length} active listings`);
console.log(`You have ${userOffers.length} active offers`);
```

---

## Performance Considerations

### Database Optimization
- **Indexes** on frequently queried columns (wallet_address, para_user_id, auction_id)
- **Connection pooling** for efficient database connections
- **Query optimization** with JOINs instead of multiple queries

### Blockchain Optimization
- **Batch operations** for ending multiple auctions
- **Caching** blockchain data in database
- **Smart polling** (only check unprocessed auctions)
- **Event listening** for real-time updates

### API Optimization
- **Database-first endpoints** (`/active/db`, `/ended/db`) avoid blockchain calls
- **Pagination** for large result sets
- **Response caching** for static data
- **Compression** with gzip

---

## Security Best Practices

### Authentication
- JWT tokens with 7-day expiration
- Secure token storage (httpOnly cookies recommended)
- Para session verification

### Authorization
- Wallet ownership verification
- Creator/winner role checks
- NFT ownership validation

### Blockchain Security
- Transaction verification before database updates
- Replay attack prevention (check transaction hash uniqueness)
- Event parsing validation

### API Security
- Helmet.js for security headers
- CORS configuration
- Rate limiting (recommended)
- Input validation with Joi

---

## Deployment

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure production database
- [ ] Set secure `JWT_SECRET`
- [ ] Configure Para production API keys
- [ ] Set up Jitsi JaaS production credentials
- [ ] Configure Avalanche mainnet RPC
- [ ] Set production contract address
- [ ] Configure CORS for production frontend
- [ ] Enable HTTPS
- [ ] Set up logging and monitoring
- [ ] Configure error tracking (Sentry recommended)
- [ ] Set up database backups
- [ ] Configure rate limiting
- [ ] Enable compression

### Recommended Hosting
- **Backend**: Railway, Render, Heroku, AWS
- **Database**: Railway PostgreSQL, Supabase, AWS RDS
- **Monitoring**: Datadog, New Relic, Sentry

---

## Order Background Services

### OrderCleanupCronService

**Schedule:** Every 5 minutes (`*/5 * * * *`)
**Purpose:** Automatically mark expired orders as inactive

#### Workflow

1. **Query Expired Orders**
   - Find all orders where `expires_at < current_time` and `is_active = true`

2. **Mark as Inactive**
   - Set `is_active = false` for expired orders
   - Update `updated_at` timestamp

3. **Log Cleanup**
   - Log number of orders cleaned up
   - Track cleanup performance

#### Configuration

```bash
# Environment variables
ORDER_CLEANUP_CRON_SCHEDULE=*/5 * * * *
ENABLE_ORDER_CLEANUP=true
```

#### Logging

```
🧹 ORDER CLEANUP CRON: Starting cleanup at 2024-12-01T10:00:00Z
🔍 Found 5 expired orders to clean up
✅ Marked 5 orders as inactive
✅ ORDER CLEANUP COMPLETED in 150ms
```

---

### OrderFulfillmentMonitorService

**Purpose:** Monitor blockchain for OrderFulfilled events and update database

#### Workflow

1. **Initialize WebSocket Provider**
   - Connect to Avalanche WebSocket RPC
   - Listen for Seaport contract events

2. **Listen for OrderFulfilled Events**
   - Filter events from Seaport contract
   - Parse event data (orderHash, fulfiller, etc.)

3. **Update Database**
   - Mark order as fulfilled
   - Create fulfillment record
   - Store transaction details

4. **Broadcast via WebSocket**
   - Emit `order:fulfilled` event to connected clients
   - Update real-time UI

#### Configuration

```bash
# Environment variables
WS_RPC_URL=wss://api.avax-test.network/ext/bc/C/ws
SEAPORT_CONTRACT_ADDRESS=0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC
ENABLE_ORDER_MONITORING=true
```

#### Event Structure

```javascript
{
  orderHash: '0x1234...',
  offerer: '0xABCD...',
  zone: '0x0000...',
  recipient: '0xEFGH...',
  offer: [...],
  consideration: [...]
}
```

#### Logging

```
🎯 ORDER FULFILLMENT MONITOR: Initialized
📡 Listening for OrderFulfilled events on Seaport contract
✅ OrderFulfilled event detected: 0x1234...
💾 Updated order in database
📡 Broadcasted fulfillment event to clients
```

---

## Support & Resources

### Documentation
- [Para SDK Docs](https://docs.getpara.com)
- [Jitsi JaaS Docs](https://jaas.8x8.vc)
- [Avalanche Docs](https://docs.avax.network)
- [ethers.js Docs](https://docs.ethers.org)

### Contact
For backend support, contact the development team.

---

**Last Updated:** December 2024
**Version:** 1.0.0
