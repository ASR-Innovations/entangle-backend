# Seaport Orderbook Backend Integration

## Table of Contents
1. [Overview](#overview)
2. [Research Findings](#research-findings)
3. [Architecture Integration](#architecture-integration)
4. [Database Schema](#database-schema)
5. [API Endpoints](#api-endpoints)
6. [Real-time Synchronization](#real-time-synchronization)
7. [Order Validation & Verification](#order-validation--verification)
8. [Background Services](#background-services)
9. [Implementation Guide](#implementation-guide)
10. [Testing Strategy](#testing-strategy)

---

## Overview

This document describes the integration of a Seaport protocol orderbook backend into the existing Entangle platform. The orderbook enables NFT marketplace functionality where:

- **Users can create listings** (sell NFT for creator tokens)
- **Users can make offers** (buy NFT with creator tokens)
- **Orders are synchronized in real-time** across all connected users
- **Orders persist in PostgreSQL** for reliability and query performance
- **Orders are cryptographically signed** using Seaport protocol
- **Fulfillment happens on-chain** via Seaport smart contracts

### Why This Is Needed

**The Problem:**
Seaport orders are signed off-chain but NOT stored on the blockchain. Without a backend orderbook:
- ❌ Orders only exist in browser memory
- ❌ Orders are lost on page refresh
- ❌ Other users cannot see your orders
- ❌ No way to query available listings/offers

**The Solution:**
A centralized orderbook backend that:
- ✅ Stores signed Seaport orders in PostgreSQL
- ✅ Provides REST API for order CRUD operations
- ✅ Broadcasts order updates via WebSocket (Socket.IO)
- ✅ Validates order signatures cryptographically
- ✅ Monitors blockchain for fulfilled/cancelled orders
- ✅ Ensures data consistency and real-time sync

---

## Research Findings

### Confirmed Facts About Seaport Orders

Based on official Seaport GitHub issues (#605, #1011) and documentation:

1. **✅ Orders ARE Stored Off-Chain**
   - Maker orders (bids and listings) are stored off-chain but cryptographically signed
   - OpenSea stores the signed orders in their backend database
   - The blockchain only validates them during fulfillment

2. **✅ Orders Are NOT Visible Without a Backend**
   - Without OpenSea API or your own database, orders are invisible to other users
   - The blockchain has no mechanism to filter/search orders
   - Even "on-chain validated" orders require off-chain storage for discovery

3. **✅ No Practical Way to Query Orders from Blockchain**
   - Quote from Seaport Issue #1011: "Even with the validate() function, the OrderValidated event doesn't contain order parameters or signatures. You still need to store orders off-chain anyway."
   - The blockchain provides no mechanism to retrieve orders based on criteria

4. **✅ This Design is Intentional**
   - **Gas Efficiency**: Creating orders costs 0 gas (just signing)
   - **Speed**: Instant order creation
   - **Flexibility**: Free cancellations
   - **Trade-off**: Requires centralized infrastructure for order discovery

### How OpenSea Does It

1. **Users sign orders** → Sends to OpenSea backend API
2. **OpenSea stores** → PostgreSQL database
3. **OpenSea indexes** → Makes orders searchable
4. **Users query API** → See all available orders
5. **Fulfillment happens on-chain** → Seaport validates signature & executes

**Without OpenSea API or your own backend = Orders invisible to others**

---

## Architecture Integration

### System Architecture (Extended)

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│              (React/Next.js + Seaport SDK)                      │
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
│  │ • Orders ⭐   │  │ • Validation │  │ • Meeting    │         │
│  │ • Listings ⭐ │  │              │  │ • Orderbook⭐│         │
│  │ • Offers   ⭐ │  │              │  │              │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└────────┬────────────────────────────────────────────────────────┘
         │
         │
    ┌────┴────┬──────────────┬──────────────┬──────────────┬──────────┐
    │         │              │              │              │          │
    ▼         ▼              ▼              ▼              ▼          ▼
┌────────┐ ┌──────┐  ┌──────────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐
│  Para  │ │ Jitsi│  │  PostgreSQL  │ │ Avalanche│ │  Cron    │ │Socket.IO│
│  API   │ │ JaaS │  │   Database   │ │Blockchain│ │ Service  │ │Real-time│
│        │ │      │  │              │ │          │ │          │ │ Orders  │
│        │ │      │  │ + Orders ⭐   │ │ Seaport ⭐│ │+Orders⭐ │ │ Sync ⭐ │
└────────┘ └──────┘  └──────────────┘ └──────────┘ └──────────┘ └────────┘
```

⭐ = New orderbook components

### Request Flow: Create Listing

```
┌──────────┐
│ Frontend │
│  (User)  │
└────┬─────┘
     │
     │ 1. User creates listing in UI
     │    - Sets price, expiration
     │    - Clicks "Create Listing"
     │
     ▼
┌──────────────────┐
│ Seaport SDK      │
│ (Frontend)       │
└────┬─────────────┘
     │
     │ 2. Generate order structure
     │    - Offer: [NFT]
     │    - Consideration: [Tokens + Platform Fee]
     │    - Sign with wallet (Para)
     │
     ▼
┌──────────────────┐
│ Para Wallet      │
│ (Sign)           │
└────┬─────────────┘
     │
     │ 3. User signs order (EIP-712)
     │    - Signature returned
     │    - Order hash calculated
     │
     ▼
┌──────────┐
│ Frontend │
└────┬─────┘
     │
     │ 4. POST /api/orders/listings/create
     │    Body: { orderData, signature, orderHash }
     │    Headers: Authorization: Bearer <jwt>
     │
     ▼
┌─────────────────┐
│ Backend API     │
└────┬────────────┘
     │
     │ 5. Validate order
     │    - Verify signature
     │    - Check NFT ownership
     │    - Validate expiration
     │
     ▼
┌──────────────────┐
│ PostgreSQL       │
│ (seaport_orders) │
└────┬─────────────┘
     │
     │ 6. Store order in database
     │    - order_hash (PK)
     │    - order_type: 'listing'
     │    - Full order data (JSONB)
     │
     ▼
┌──────────────────┐
│ Socket.IO        │
└────┬─────────────┘
     │
     │ 7. Broadcast to all connected users
     │    socket.emit('order:created', orderData)
     │
     ▼
┌──────────────────┐
│ All Frontends    │
│ (Real-time)      │
└──────────────────┘
     │
     │ 8. Update UI instantly
     │    - Show new listing
     │    - Update marketplace
```

---

## Database Schema

### New Tables

#### **seaport_orders** (Main Orders Table)

Stores all Seaport orders (listings and offers).

```sql
CREATE TABLE seaport_orders (
    -- Primary Key
    order_hash VARCHAR(66) PRIMARY KEY,  -- Seaport order hash (0x...)

    -- Order Classification
    order_type VARCHAR(20) NOT NULL CHECK (order_type IN ('listing', 'offer')),

    -- NFT Information
    nft_contract VARCHAR(42) NOT NULL,   -- NFT contract address
    token_id VARCHAR(78) NOT NULL,       -- NFT token ID (supports large numbers)

    -- Parties
    maker VARCHAR(42) NOT NULL,          -- Order creator (seller for listing, buyer for offer)
    taker VARCHAR(42),                   -- Optional: specific counterparty

    -- Pricing
    payment_token VARCHAR(42) NOT NULL,  -- ERC20 token address for payment
    price VARCHAR(78) NOT NULL,          -- Price in wei (base units)
    price_decimal VARCHAR(50),           -- Human-readable price (e.g., "10.5")

    -- Platform Fee
    platform_fee_amount VARCHAR(78),     -- Platform fee in wei
    platform_fee_recipient VARCHAR(42),  -- Platform fee receiver

    -- Timing
    start_time BIGINT NOT NULL,          -- Unix timestamp (seconds)
    end_time BIGINT NOT NULL,            -- Unix timestamp (seconds)
    expires_at TIMESTAMP NOT NULL,       -- PostgreSQL timestamp for queries

    -- Seaport Order Data
    order_components JSONB NOT NULL,     -- Full Seaport OrderComponents structure
    signature TEXT NOT NULL,             -- EIP-712 signature

    -- Status
    is_active BOOLEAN DEFAULT true,
    is_cancelled BOOLEAN DEFAULT false,
    is_fulfilled BOOLEAN DEFAULT false,

    -- Fulfillment Info (populated when fulfilled)
    fulfilled_at TIMESTAMP,
    fulfilled_by VARCHAR(42),
    fulfillment_tx_hash VARCHAR(66),

    -- Cancellation Info
    cancelled_at TIMESTAMP,
    cancellation_tx_hash VARCHAR(66),

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- User Link (for filtering user's orders)
    para_user_id VARCHAR(255),           -- Link to users table

    -- Indexes for performance
    CONSTRAINT fk_user FOREIGN KEY (para_user_id) REFERENCES users(para_user_id) ON DELETE SET NULL
);

-- Indexes for fast queries
CREATE INDEX idx_token_id ON seaport_orders(token_id, nft_contract);
CREATE INDEX idx_maker ON seaport_orders(maker);
CREATE INDEX idx_order_type ON seaport_orders(order_type);
CREATE INDEX idx_is_active ON seaport_orders(is_active);
CREATE INDEX idx_expires_at ON seaport_orders(expires_at);
CREATE INDEX idx_created_at ON seaport_orders(created_at DESC);
CREATE INDEX idx_para_user_id ON seaport_orders(para_user_id);

-- Composite index for common queries
CREATE INDEX idx_active_orders ON seaport_orders(order_type, token_id, is_active, expires_at);
```

#### **order_fulfillments** (Order Execution History)

```sql
CREATE TABLE order_fulfillments (
    id SERIAL PRIMARY KEY,
    order_hash VARCHAR(66) NOT NULL,
    fulfiller VARCHAR(42) NOT NULL,
    transaction_hash VARCHAR(66) NOT NULL UNIQUE,
    block_number BIGINT NOT NULL,
    amount_paid VARCHAR(78),
    platform_fee_paid VARCHAR(78),
    fulfilled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_order FOREIGN KEY (order_hash) REFERENCES seaport_orders(order_hash) ON DELETE CASCADE
);

CREATE INDEX idx_fulfillment_tx_hash ON order_fulfillments(transaction_hash);
CREATE INDEX idx_fulfillment_order_hash ON order_fulfillments(order_hash);
```

#### **order_cancellations** (Cancellation History)

```sql
CREATE TABLE order_cancellations (
    id SERIAL PRIMARY KEY,
    order_hash VARCHAR(66) NOT NULL,
    cancelled_by VARCHAR(42) NOT NULL,
    transaction_hash VARCHAR(66) UNIQUE,
    cancellation_reason VARCHAR(255),
    cancelled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_order_cancel FOREIGN KEY (order_hash) REFERENCES seaport_orders(order_hash) ON DELETE CASCADE
);

CREATE INDEX idx_cancellation_order_hash ON order_cancellations(order_hash);
```

#### **order_events** (Activity Log)

```sql
CREATE TABLE order_events (
    id SERIAL PRIMARY KEY,
    order_hash VARCHAR(66),
    event_type VARCHAR(50) NOT NULL,
    actor VARCHAR(42),
    event_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_event_order_hash ON order_events(order_hash);
CREATE INDEX idx_event_type ON order_events(event_type);
CREATE INDEX idx_event_created_at ON order_events(created_at DESC);
```

---

## API Endpoints

### Base URL
- **Development**: `http://localhost:5000`
- **Production**: `https://your-domain.com`

### Order Endpoints

#### POST `/api/orders/listings/create`
Create a new NFT listing.

**Authentication:** Required (JWT)

**Request:**
```json
{
  "orderHash": "0x1234...",
  "orderType": "listing",
  "nftContract": "0x6fD65aE833C9679cBC571581CE0f5Cd73D565796",
  "tokenId": "35",
  "maker": "0xabc...",
  "paymentToken": "0xDEF...",
  "price": "1234000000000000000000",
  "priceDecimal": "1234.0",
  "startTime": 1735689600,
  "endTime": 1735776000,
  "orderComponents": {
    "offerer": "0xabc...",
    "zone": "0x0000000000000000000000000000000000000000",
    "offer": [...],
    "consideration": [...],
    "orderType": 0,
    "startTime": "1735689600",
    "endTime": "1735776000",
    "zoneHash": "0x0000...",
    "salt": "0x...",
    "conduitKey": "0x0000..."
  },
  "signature": "0x5678..."
}
```

**Response:**
```json
{
  "success": true,
  "order": {
    "orderHash": "0x1234...",
    "orderType": "listing",
    "tokenId": "35",
    "maker": "0xabc...",
    "price": "1234.0",
    "expiresAt": "2024-12-31T00:00:00Z",
    "isActive": true
  },
  "message": "Listing created successfully"
}
```

---

#### POST `/api/orders/offers/create`
Create a new offer on an NFT.

**Authentication:** Required (JWT)

**Request:**
```json
{
  "orderHash": "0x5678...",
  "orderType": "offer",
  "nftContract": "0x6fD65aE833C9679cBC571581CE0f5Cd73D565796",
  "tokenId": "35",
  "maker": "0xdef...",
  "paymentToken": "0xABC...",
  "price": "1000000000000000000000",
  "priceDecimal": "1000.0",
  "startTime": 1735689600,
  "endTime": 1735776000,
  "orderComponents": {...},
  "signature": "0x9abc..."
}
```

**Response:**
```json
{
  "success": true,
  "order": {
    "orderHash": "0x5678...",
    "orderType": "offer",
    "tokenId": "35",
    "maker": "0xdef...",
    "price": "1000.0",
    "expiresAt": "2024-12-31T00:00:00Z",
    "isActive": true
  },
  "message": "Offer created successfully"
}
```

---

#### GET `/api/orders/listings/:tokenId`
Get active listing for a specific NFT.

**Authentication:** Optional (public endpoint)

**Response:**
```json
{
  "success": true,
  "listing": {
    "orderHash": "0x1234...",
    "tokenId": "35",
    "maker": "0xabc...",
    "makerName": "John Doe",
    "price": "1234.0",
    "paymentToken": "0xDEF...",
    "paymentTokenSymbol": "PRO",
    "expiresAt": "2024-12-31T00:00:00Z",
    "timeRemaining": "23h 45m",
    "orderComponents": {...},
    "signature": "0x5678..."
  }
}
```

---

#### GET `/api/orders/offers/:tokenId`
Get all active offers for a specific NFT.

**Authentication:** Optional (public endpoint)

**Query Parameters:**
- `limit` (optional): Max results (default: 50, max: 100)
- `offset` (optional): Pagination offset (default: 0)
- `sort` (optional): `price_asc` | `price_desc` | `recent` (default: `price_desc`)

**Response:**
```json
{
  "success": true,
  "offers": [
    {
      "orderHash": "0x5678...",
      "tokenId": "35",
      "maker": "0xdef...",
      "makerName": "Jane Smith",
      "price": "1500.0",
      "paymentToken": "0xABC...",
      "paymentTokenSymbol": "PRO",
      "expiresAt": "2024-12-31T00:00:00Z",
      "timeRemaining": "12h 30m",
      "orderComponents": {...},
      "signature": "0x9abc..."
    }
  ],
  "total": 2
}
```

---

#### GET `/api/orders/user/listings`
Get current user's active listings.

**Authentication:** Required (JWT)

#### GET `/api/orders/user/offers`
Get current user's active offers.

**Authentication:** Required (JWT)

#### DELETE `/api/orders/:orderHash/cancel`
Cancel an order.

**Authentication:** Required (JWT)

#### POST `/api/orders/:orderHash/fulfill`
Mark order as fulfilled (called after on-chain fulfillment).

**Authentication:** Required (JWT)

#### GET `/api/orders/marketplace`
Get all active marketplace orders.

**Authentication:** Optional (public endpoint)

---

## Real-time Synchronization

### WebSocket Events (Socket.IO)

All order updates are broadcast in real-time using Socket.IO.

#### Server-Side Implementation

```javascript
// Backend: routes/orders.js
const io = require('../services/socket-service');

// After creating an order
io.emit('order:created', {
  orderHash: order.orderHash,
  orderType: order.orderType,
  tokenId: order.tokenId,
  maker: order.maker,
  price: order.priceDecimal,
  timestamp: Date.now()
});

// After cancelling an order
io.emit('order:cancelled', {
  orderHash: order.orderHash,
  reason: 'user_cancelled',
  timestamp: Date.now()
});

// After fulfilling an order
io.emit('order:fulfilled', {
  orderHash: order.orderHash,
  fulfiller: fulfillmentData.fulfiller,
  transactionHash: fulfillmentData.transactionHash,
  timestamp: Date.now()
});
```

#### Client-Side Implementation

```javascript
// Frontend: hooks/useOrderSync.ts
import { useEffect } from 'react';
import { socket } from '@/lib/socket';

export function useOrderSync() {
  useEffect(() => {
    // Listen for new orders
    socket.on('order:created', (data) => {
      console.log('New order created:', data);
      refreshOrders();
    });

    // Listen for cancelled orders
    socket.on('order:cancelled', (data) => {
      console.log('Order cancelled:', data);
      removeOrder(data.orderHash);
    });

    // Listen for fulfilled orders
    socket.on('order:fulfilled', (data) => {
      console.log('Order fulfilled:', data);
      markOrderFulfilled(data.orderHash);
    });

    return () => {
      socket.off('order:created');
      socket.off('order:cancelled');
      socket.off('order:fulfilled');
    };
  }, []);
}
```

---

## Order Validation & Verification

### Order Signature Verification

All incoming orders must have valid EIP-712 signatures.

```javascript
// Backend: services/order-validation-service.js
const { ethers } = require('ethers');

async function verifyOrderSignature(orderComponents, signature, maker) {
  try {
    // Reconstruct EIP-712 hash
    const domain = {
      name: 'Seaport',
      version: '1.6',
      chainId: 43113,
      verifyingContract: process.env.SEAPORT_CONTRACT_ADDRESS
    };

    const types = {
      OrderComponents: [
        { name: 'offerer', type: 'address' },
        { name: 'zone', type: 'address' },
        { name: 'offer', type: 'OfferItem[]' },
        { name: 'consideration', type: 'ConsiderationItem[]' },
        { name: 'orderType', type: 'uint8' },
        { name: 'startTime', type: 'uint256' },
        { name: 'endTime', type: 'uint256' },
        { name: 'zoneHash', type: 'bytes32' },
        { name: 'salt', type: 'uint256' },
        { name: 'conduitKey', type: 'bytes32' },
        { name: 'counter', type: 'uint256' }
      ],
      OfferItem: [...],
      ConsiderationItem: [...]
    };

    // Verify signature
    const recoveredAddress = ethers.verifyTypedData(
      domain,
      types,
      orderComponents,
      signature
    );

    return recoveredAddress.toLowerCase() === maker.toLowerCase();
  } catch (error) {
    console.error('Signature verification error:', error);
    throw error;
  }
}
```

---

## Background Services

### OrderCleanupCronService

Automatically mark expired orders as inactive.

**Schedule:** Every 5 minutes

```javascript
// Backend: services/order-cleanup-cron-service.js
const cron = require('node-cron');
const { query } = require('../config/database');

class OrderCleanupCronService {
  start() {
    cron.schedule('*/5 * * * *', async () => {
      await this.cleanupExpiredOrders();
    });
  }

  async cleanupExpiredOrders() {
    const result = await query(
      `UPDATE seaport_orders
       SET is_active = false
       WHERE is_active = true
         AND expires_at < CURRENT_TIMESTAMP`,
      []
    );

    if (result.rows.length > 0) {
      console.log(`Marked ${result.rows.length} expired orders as inactive`);
    }
  }
}

module.exports = new OrderCleanupCronService();
```

### OrderFulfillmentMonitorService

Monitor blockchain for OrderFulfilled events.

```javascript
// Backend: services/order-fulfillment-monitor-service.js
const { ethers } = require('ethers');

class OrderFulfillmentMonitorService {
  async start() {
    this.provider = new ethers.WebSocketProvider(process.env.WS_RPC_URL);

    const abi = [
      'event OrderFulfilled(bytes32 orderHash, address indexed offerer, address indexed zone, address fulfiller, ...)'
    ];

    this.contract = new ethers.Contract(
      process.env.SEAPORT_CONTRACT_ADDRESS,
      abi,
      this.provider
    );

    this.contract.on('OrderFulfilled', async (orderHash, offerer, zone, fulfiller, event) => {
      await this.handleOrderFulfilled({ orderHash, fulfiller, transactionHash: event.transactionHash });
    });
  }
}

module.exports = new OrderFulfillmentMonitorService();
```

---

## Implementation Guide

### Phase 1: Database Setup (Day 1)
1. Create migration files
2. Run SQL migrations
3. Verify tables created

### Phase 2: API Routes (Day 2-3)
1. Create `routes/orders.js`
2. Implement endpoints
3. Register routes in server.js

### Phase 3: Controllers & Services (Day 3-4)
1. Create `controllers/order-controller.js`
2. Create `services/order-service.js`
3. Create `services/order-validation-service.js`

### Phase 4: Background Services (Day 5)
1. Create cron services
2. Start services in server.js

### Phase 5: Testing (Day 6-7)
1. Unit tests
2. Integration tests
3. E2E tests

---

## Testing Strategy

### Unit Tests
```javascript
const { validateOrderData } = require('../services/order-validation-service');

test('should validate valid listing', () => {
  const orderData = { /* ... */ };
  const result = validateOrderData(orderData);
  expect(result.isValid).toBe(true);
});
```

### Integration Tests
```javascript
const request = require('supertest');

test('POST /api/orders/listings/create should create listing', async () => {
  const response = await request(app)
    .post('/api/orders/listings/create')
    .set('Authorization', `Bearer ${authToken}`)
    .send(orderData);
  expect(response.status).toBe(201);
});
```

---

## Platform Fee Integration

### Overview

The platform fee system allows the marketplace to collect a percentage fee on all order fulfillments. Platform fees are validated during order creation and verified during fulfillment.

### Configuration

Platform fees are configured via environment variables:

```bash
# Platform Fee Configuration
# PLATFORM_FEE_RECIPIENT: Wallet address that receives platform fees
# Leave commented out to disable platform fee validation
PLATFORM_FEE_RECIPIENT=0x1234567890123456789012345678901234567890

# PLATFORM_FEE_BASIS_POINTS: Platform fee as basis points (1 basis point = 0.01%)
# Default: 250 (2.5%)
# Example: 100 = 1%, 250 = 2.5%, 500 = 5%
PLATFORM_FEE_BASIS_POINTS=250
```

### How It Works

#### 1. Order Creation
When a user creates an order (listing or offer), the platform fee must be included in the `consideration` array:

```javascript
const orderComponents = {
  offerer: makerAddress,
  offer: [nftItem],
  consideration: [
    // Payment to seller
    {
      itemType: 0, // ERC20
      token: paymentTokenAddress,
      identifierOrCriteria: '0',
      startAmount: priceAmount,
      endAmount: priceAmount,
      recipient: sellerAddress
    },
    // Platform fee
    {
      itemType: 0, // ERC20
      token: paymentTokenAddress,
      identifierOrCriteria: '0',
      startAmount: platformFeeAmount,
      endAmount: platformFeeAmount,
      recipient: platformFeeRecipient
    }
  ],
  // ... other fields
};
```

#### 2. Validation
The backend validates:
- Platform fee recipient matches configured address
- Platform fee amount is correct (within 1% tolerance for rounding)
- Platform fee is included in consideration items

```javascript
// Backend validation
const expectedFee = (price * platformFeeBasisPoints) / 10000;
const actualFee = findPlatformFeeInConsideration(orderComponents);

if (Math.abs(actualFee - expectedFee) > expectedFee * 0.01) {
  throw new Error('Platform fee amount incorrect');
}
```

#### 3. Fulfillment Verification
When an order is fulfilled on-chain, the backend verifies the platform fee was paid:

```javascript
// After blockchain fulfillment
const platformFeePaid = extractFeeFromTransaction(txReceipt);
if (platformFeePaid !== order.platformFeeAmount) {
  logger.warn('Platform fee mismatch', { expected, actual });
}
```

### Fee Calculation

Platform fees are calculated using basis points:

```
Fee Amount = (Price × Basis Points) / 10,000

Examples:
- Price: 1 ETH, Basis Points: 250 → Fee: 0.025 ETH (2.5%)
- Price: 100 tokens, Basis Points: 100 → Fee: 1 token (1%)
- Price: 1000 tokens, Basis Points: 500 → Fee: 50 tokens (5%)
```

### Disabling Platform Fees

To disable platform fee validation, simply comment out or remove the `PLATFORM_FEE_RECIPIENT` environment variable:

```bash
# Platform fees disabled
# PLATFORM_FEE_RECIPIENT=0x1234567890123456789012345678901234567890
PLATFORM_FEE_BASIS_POINTS=250
```

When disabled:
- Orders can be created without platform fees
- No validation is performed
- Existing orders with fees are still valid

### Testing Platform Fees

Run the platform fee validation test:

```bash
node test-platform-fee-validation.js
```

This test verifies:
- ✅ Valid platform fees are accepted
- ✅ Missing platform fees are rejected
- ✅ Wrong recipient addresses are rejected
- ✅ Incorrect fee amounts are rejected
- ✅ Fee calculation is accurate

---

## Environment Variables

```bash
# Seaport Orderbook Configuration
SEAPORT_CONTRACT_ADDRESS=0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC
WS_RPC_URL=wss://api.avax-test.network/ext/bc/C/ws
ORDER_CLEANUP_CRON_SCHEDULE=*/5 * * * *
ENABLE_ORDER_MONITORING=true

# Platform Fee Configuration (Requirements 10.1-10.5)
# PLATFORM_FEE_RECIPIENT: Wallet address that receives platform fees
# Leave commented out to disable platform fee validation
# PLATFORM_FEE_RECIPIENT=0x0000000000000000000000000000000000000000
PLATFORM_FEE_BASIS_POINTS=250
```

---

## Summary Checklist

### Backend Implementation
- [ ] Create database tables
- [ ] Implement API routes
- [ ] Create order controllers
- [ ] Implement order service
- [ ] Add order validation
- [ ] Implement signature verification
- [ ] Create Socket.IO handlers
- [ ] Implement cron services
- [ ] Write tests

### Frontend Integration
- [ ] Update marketplace service
- [ ] Implement WebSocket listeners
- [ ] Add real-time order sync
- [ ] Test order creation flow

---

**Estimated Timeline:** 1 week for full implementation

**Last Updated:** December 2024
**Version:** 2.0.0
