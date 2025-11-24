# Design Document: Seaport Orderbook Backend Integration

## Overview

This document describes the design for integrating a Seaport protocol orderbook backend into the Entangle platform. The system provides a centralized orderbook for storing, querying, and synchronizing NFT marketplace orders in real-time.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│              (React/Next.js + Seaport SDK)                      │
└────────────┬────────────────────────────────────────────────────┘
             │
             │ HTTP/REST + WebSocket
             │
┌────────────▼────────────────────────────────────────────────────┐
│                   EXPRESS SERVER (NEW)                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Order Routes                           │  │
│  │  • POST /api/orders/listings/create                      │  │
│  │  • POST /api/orders/offers/create                        │  │
│  │  • GET  /api/orders/listings/:tokenId                    │  │
│  │  • GET  /api/orders/offers/:tokenId                      │  │
│  │  • GET  /api/orders/user/listings                        │  │
│  │  • GET  /api/orders/user/offers                          │  │
│  │  • DELETE /api/orders/:orderHash/cancel                  │  │
│  │  • POST /api/orders/:orderHash/fulfill                   │  │
│  │  • GET  /api/orders/marketplace                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Services                               │  │
│  │  • OrderService - Business logic                         │  │
│  │  • OrderValidationService - Signature verification       │  │
│  │  • OrderCleanupCronService - Expire old orders          │  │
│  │  • OrderFulfillmentMonitorService - Blockchain events   │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────┬────────────────────────────────────────────────────────┘
         │
         │
    ┌────┴────┬──────────────┬──────────────┬──────────────┐
    │         │              │              │              │
    ▼         ▼              ▼              ▼              ▼
┌────────┐ ┌──────┐  ┌──────────────┐ ┌──────────┐ ┌──────────┐
│Socket  │ │ Para │  │  PostgreSQL  │ │ Avalanche│ │  Cron    │
│  IO    │ │ Auth │  │   Database   │ │Blockchain│ │ Service  │
│        │ │      │  │              │ │          │ │          │
│Real-   │ │      │  │ + Orders     │ │ Seaport  │ │+Cleanup  │
│time    │ │      │  │ + Fulfill.   │ │ Events   │ │+Monitor  │
│Sync    │ │      │  │ + Cancel.    │ │          │ │          │
└────────┘ └──────┘  └──────────────┘ └──────────┘ └──────────┘
```

### Data Flow

#### Order Creation Flow
```
1. User signs order with wallet (EIP-712)
2. Frontend sends signed order to backend
3. Backend validates signature
4. Backend stores order in PostgreSQL
5. Backend broadcasts order via Socket.IO
6. All connected clients receive update
```

#### Order Fulfillment Flow
```
1. User fulfills order on-chain (Seaport contract)
2. Blockchain emits OrderFulfilled event
3. OrderFulfillmentMonitorService detects event
4. Backend updates order status to fulfilled
5. Backend broadcasts fulfillment via Socket.IO
6. All connected clients receive update
```

## Components and Interfaces

### Database Schema

#### seaport_orders Table
```sql
CREATE TABLE seaport_orders (
    order_hash VARCHAR(66) PRIMARY KEY,
    order_type VARCHAR(20) NOT NULL CHECK (order_type IN ('listing', 'offer')),
    nft_contract VARCHAR(42) NOT NULL,
    token_id VARCHAR(78) NOT NULL,
    maker VARCHAR(42) NOT NULL,
    taker VARCHAR(42),
    payment_token VARCHAR(42) NOT NULL,
    price VARCHAR(78) NOT NULL,
    price_decimal VARCHAR(50),
    platform_fee_amount VARCHAR(78),
    platform_fee_recipient VARCHAR(42),
    start_time BIGINT NOT NULL,
    end_time BIGINT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    order_components JSONB NOT NULL,
    signature TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_cancelled BOOLEAN DEFAULT false,
    is_fulfilled BOOLEAN DEFAULT false,
    fulfilled_at TIMESTAMP,
    fulfilled_by VARCHAR(42),
    fulfillment_tx_hash VARCHAR(66),
    cancelled_at TIMESTAMP,
    cancellation_tx_hash VARCHAR(66),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    para_user_id VARCHAR(255),
    CONSTRAINT fk_user FOREIGN KEY (para_user_id) 
        REFERENCES users(para_user_id) ON DELETE SET NULL
);
```

#### order_fulfillments Table
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
    CONSTRAINT fk_order FOREIGN KEY (order_hash) 
        REFERENCES seaport_orders(order_hash) ON DELETE CASCADE
);
```

#### order_cancellations Table
```sql
CREATE TABLE order_cancellations (
    id SERIAL PRIMARY KEY,
    order_hash VARCHAR(66) NOT NULL,
    cancelled_by VARCHAR(42) NOT NULL,
    transaction_hash VARCHAR(66) UNIQUE,
    cancellation_reason VARCHAR(255),
    cancelled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_order_cancel FOREIGN KEY (order_hash) 
        REFERENCES seaport_orders(order_hash) ON DELETE CASCADE
);
```

#### order_events Table
```sql
CREATE TABLE order_events (
    id SERIAL PRIMARY KEY,
    order_hash VARCHAR(66),
    event_type VARCHAR(50) NOT NULL,
    actor VARCHAR(42),
    event_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### API Interfaces

#### POST /api/orders/listings/create
```typescript
interface CreateListingRequest {
  orderHash: string;
  orderType: 'listing';
  nftContract: string;
  tokenId: string;
  maker: string;
  taker?: string;
  paymentToken: string;
  price: string;
  priceDecimal: string;
  platformFeeAmount?: string;
  platformFeeRecipient?: string;
  startTime: number;
  endTime: number;
  orderComponents: SeaportOrderComponents;
  signature: string;
}

interface CreateListingResponse {
  success: boolean;
  order: {
    orderHash: string;
    orderType: string;
    tokenId: string;
    maker: string;
    price: string;
    expiresAt: string;
    isActive: boolean;
  };
  message: string;
}
```

#### GET /api/orders/listings/:tokenId
```typescript
interface GetListingResponse {
  success: boolean;
  listing: {
    orderHash: string;
    tokenId: string;
    maker: string;
    makerName: string;
    price: string;
    paymentToken: string;
    paymentTokenSymbol: string;
    expiresAt: string;
    timeRemaining: string;
    orderComponents: SeaportOrderComponents;
    signature: string;
  } | null;
}
```

#### GET /api/orders/offers/:tokenId
```typescript
interface GetOffersRequest {
  limit?: number;
  offset?: number;
  sort?: 'price_asc' | 'price_desc' | 'recent';
}

interface GetOffersResponse {
  success: boolean;
  offers: Array<{
    orderHash: string;
    tokenId: string;
    maker: string;
    makerName: string;
    price: string;
    paymentToken: string;
    paymentTokenSymbol: string;
    expiresAt: string;
    timeRemaining: string;
    orderComponents: SeaportOrderComponents;
    signature: string;
  }>;
  total: number;
}
```

### Service Interfaces

#### OrderService
```typescript
class OrderService {
  async createOrder(orderData: CreateOrderData): Promise<Order>;
  async getOrderByHash(orderHash: string): Promise<Order | null>;
  async getListingForToken(tokenId: string, nftContract: string): Promise<Order | null>;
  async getOffersForToken(tokenId: string, nftContract: string, options: QueryOptions): Promise<Order[]>;
  async getUserListings(paraUserId: string): Promise<Order[]>;
  async getUserOffers(paraUserId: string): Promise<Order[]>;
  async cancelOrder(orderHash: string, userId: string, reason?: string): Promise<void>;
  async fulfillOrder(orderHash: string, fulfillmentData: FulfillmentData): Promise<void>;
  async getMarketplaceOrders(options: MarketplaceQueryOptions): Promise<Order[]>;
}
```

#### OrderValidationService
```typescript
class OrderValidationService {
  async validateOrderData(orderData: CreateOrderData): Promise<ValidationResult>;
  async verifyOrderSignature(orderComponents: SeaportOrderComponents, signature: string, maker: string): Promise<boolean>;
  async validateNFTOwnership(nftContract: string, tokenId: string, owner: string): Promise<boolean>;
  async validateExpiration(endTime: number): Promise<boolean>;
  async validatePrice(price: string): Promise<boolean>;
  calculateOrderHash(orderComponents: SeaportOrderComponents): string;
}
```

## Data Models

### Order Model
```typescript
interface Order {
  orderHash: string;
  orderType: 'listing' | 'offer';
  nftContract: string;
  tokenId: string;
  maker: string;
  taker?: string;
  paymentToken: string;
  price: string;
  priceDecimal: string;
  platformFeeAmount?: string;
  platformFeeRecipient?: string;
  startTime: number;
  endTime: number;
  expiresAt: Date;
  orderComponents: SeaportOrderComponents;
  signature: string;
  isActive: boolean;
  isCancelled: boolean;
  isFulfilled: boolean;
  fulfilledAt?: Date;
  fulfilledBy?: string;
  fulfillmentTxHash?: string;
  cancelledAt?: Date;
  cancellationTxHash?: string;
  createdAt: Date;
  updatedAt: Date;
  paraUserId?: string;
}
```

### Seaport Order Components
```typescript
interface SeaportOrderComponents {
  offerer: string;
  zone: string;
  offer: OfferItem[];
  consideration: ConsiderationItem[];
  orderType: number;
  startTime: string;
  endTime: string;
  zoneHash: string;
  salt: string;
  conduitKey: string;
  counter: string;
}

interface OfferItem {
  itemType: number;
  token: string;
  identifierOrCriteria: string;
  startAmount: string;
  endAmount: string;
}

interface ConsiderationItem {
  itemType: number;
  token: string;
  identifierOrCriteria: string;
  startAmount: string;
  endAmount: string;
  recipient: string;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Order Signature Validity
*For any* order stored in the database, verifying the signature with the order components and maker address should return true.
**Validates: Requirements 2.1, 2.2**

### Property 2: Order Hash Uniqueness
*For any* two different orders, their order hashes should be different (no collisions).
**Validates: Requirements 2.6**

### Property 3: Active Order Expiration
*For any* order marked as active, the expires_at timestamp should be in the future.
**Validates: Requirements 7.1, 7.2**

### Property 4: Order Maker Authorization
*For any* order cancellation request, the requesting user should be the order maker.
**Validates: Requirements 5.1, 11.2**

### Property 5: Fulfilled Order Immutability
*For any* order marked as fulfilled, attempting to cancel it should fail.
**Validates: Requirements 5.5**

### Property 6: Order Type Consistency
*For any* listing order, the offer array should contain exactly one NFT item.
**Validates: Requirements 2.3**

### Property 7: Price Positivity
*For any* order, the price should be greater than zero.
**Validates: Requirements 2.5**

### Property 8: Real-time Broadcast Completeness
*For any* order creation, all connected WebSocket clients should receive the order:created event.
**Validates: Requirements 4.1**

### Property 9: Order Retrieval Consistency
*For any* active order stored in the database, querying by order hash should return the same order.
**Validates: Requirements 3.1, 3.2**

### Property 10: Expiration Cleanup Correctness
*For any* order with expires_at < current_time, the cleanup cron should mark it as inactive.
**Validates: Requirements 7.1, 7.2**

## Error Handling

### Validation Errors (400 Bad Request)
- Invalid signature
- Expired order
- Invalid price (zero or negative)
- Missing required fields
- Invalid NFT contract address
- Invalid wallet address format

### Authentication Errors (401 Unauthorized)
- Missing JWT token
- Invalid JWT token
- Expired JWT token

### Authorization Errors (403 Forbidden)
- User not order maker (for cancellation)
- User does not own NFT (for listing creation)

### Not Found Errors (404 Not Found)
- Order hash not found
- NFT not found
- User not found

### Conflict Errors (409 Conflict)
- Order hash already exists
- Order already fulfilled
- Order already cancelled

### Server Errors (500 Internal Server Error)
- Database connection failure
- Blockchain RPC failure
- Signature verification error

## Testing Strategy

### Unit Tests
- Order validation logic
- Signature verification
- Order hash calculation
- Price formatting
- Time remaining calculation

### Integration Tests
- Order creation flow
- Order retrieval queries
- Order cancellation
- Order fulfillment tracking
- WebSocket event broadcasting

### Property-Based Tests
- Signature verification for random valid orders
- Order hash uniqueness for random orders
- Expiration validation for random timestamps
- Authorization checks for random users

### End-to-End Tests
- Complete order lifecycle (create → fulfill)
- Complete order lifecycle (create → cancel)
- Real-time synchronization across multiple clients
- Cron job execution and cleanup

## Security Considerations

### Signature Verification
- All orders must have valid EIP-712 signatures
- Signature must match the maker address
- Prevent signature replay attacks

### Authorization
- Only order makers can cancel their orders
- Only authenticated users can create orders
- Public endpoints for querying marketplace data

### Input Validation
- Validate all wallet addresses (checksum format)
- Validate all numeric values (price, timestamps)
- Sanitize all string inputs
- Validate order components structure

### Rate Limiting
- Limit order creation to prevent spam
- Limit query endpoints to prevent DoS
- Implement exponential backoff for failed requests

## Performance Optimization

### Database Indexes
```sql
CREATE INDEX idx_token_id ON seaport_orders(token_id, nft_contract);
CREATE INDEX idx_maker ON seaport_orders(maker);
CREATE INDEX idx_order_type ON seaport_orders(order_type);
CREATE INDEX idx_is_active ON seaport_orders(is_active);
CREATE INDEX idx_expires_at ON seaport_orders(expires_at);
CREATE INDEX idx_created_at ON seaport_orders(created_at DESC);
CREATE INDEX idx_para_user_id ON seaport_orders(para_user_id);
CREATE INDEX idx_active_orders ON seaport_orders(order_type, token_id, is_active, expires_at);
```

### Query Optimization
- Use composite indexes for common query patterns
- Implement pagination for large result sets
- Cache frequently accessed data (Redis optional)
- Use database connection pooling

### WebSocket Optimization
- Implement room-based broadcasting (per NFT)
- Compress WebSocket messages
- Implement reconnection logic with exponential backoff
- Batch multiple updates when possible

## Deployment Considerations

### Environment Variables
```bash
# Seaport Configuration
SEAPORT_CONTRACT_ADDRESS=0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC
SEAPORT_CHAIN_ID=43113

# WebSocket Configuration
WS_RPC_URL=wss://api.avax-test.network/ext/bc/C/ws

# Cron Configuration
ORDER_CLEANUP_CRON_SCHEDULE=*/5 * * * *
ENABLE_ORDER_MONITORING=true

# Platform Fee Configuration
PLATFORM_FEE_RECIPIENT=0x...
PLATFORM_FEE_BASIS_POINTS=250
```

### Database Migration
- Create migration script for new tables
- Add indexes after table creation
- Verify foreign key constraints
- Test rollback procedures

### Monitoring
- Log all order operations
- Monitor WebSocket connection count
- Track order creation/fulfillment rates
- Alert on validation failures
- Monitor cron job execution

## Future Enhancements

### Phase 2 Features
- Bulk order operations
- Order modification (price updates)
- Advanced filtering (price range, date range)
- Order analytics and statistics
- Email notifications for order events

### Phase 3 Features
- Order matching engine
- Automated market making
- Order book depth visualization
- Historical order data analysis
- Multi-chain support
