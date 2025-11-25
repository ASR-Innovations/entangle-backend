# Requirements Document: Seaport Orderbook Backend Integration

## Introduction

This document specifies the requirements for integrating a Seaport protocol orderbook backend into the Entangle platform. The orderbook enables NFT marketplace functionality where users can create listings (sell NFT for creator tokens) and make offers (buy NFT with creator tokens). Orders are synchronized in real-time across all connected users and persist in PostgreSQL for reliability and query performance.

## Glossary

- **Seaport**: OpenSea's open-source NFT marketplace protocol for creating and fulfilling orders
- **Order**: A cryptographically signed intent to trade (listing or offer)
- **Listing**: A sell order where the maker offers an NFT for tokens
- **Offer**: A buy order where the maker offers tokens for an NFT
- **Maker**: The user who creates an order
- **Taker**: The user who fulfills an order
- **Order Hash**: Unique identifier for an order (keccak256 hash)
- **EIP-712**: Ethereum standard for typed structured data hashing and signing
- **Orderbook**: Centralized database storing signed Seaport orders
- **Fulfillment**: On-chain execution of an order via Seaport smart contract
- **Order Components**: The structured data that defines a Seaport order

## Requirements

### Requirement 1: Order Storage and Persistence

**User Story:** As a marketplace user, I want my orders to persist across sessions, so that I don't lose my listings and offers when I refresh the page.

#### Acceptance Criteria

1. WHEN a user creates a listing or offer, THEN the system SHALL store the signed order in PostgreSQL database
2. WHEN a user refreshes the page, THEN the system SHALL retrieve and display all active orders from the database
3. WHEN an order expires, THEN the system SHALL automatically mark it as inactive
4. WHEN an order is fulfilled on-chain, THEN the system SHALL update the order status to fulfilled
5. WHEN an order is cancelled, THEN the system SHALL mark the order as cancelled and store cancellation details

### Requirement 2: Order Creation and Validation

**User Story:** As a marketplace user, I want to create listings and offers for NFTs, so that I can participate in the marketplace.

#### Acceptance Criteria

1. WHEN a user submits a listing, THEN the system SHALL validate the order signature using EIP-712
2. WHEN a user submits an offer, THEN the system SHALL verify the maker address matches the signature
3. WHEN an order is submitted, THEN the system SHALL validate that the NFT exists and the maker owns it (for listings)
4. WHEN an order is submitted, THEN the system SHALL validate the expiration time is in the future
5. WHEN an order is submitted, THEN the system SHALL validate the price is greater than zero
6. WHEN an order is submitted, THEN the system SHALL calculate and store the order hash
7. WHEN validation fails, THEN the system SHALL return a descriptive error message

### Requirement 3: Order Retrieval and Querying

**User Story:** As a marketplace user, I want to view available listings and offers for NFTs, so that I can find trading opportunities.

#### Acceptance Criteria

1. WHEN a user views an NFT, THEN the system SHALL return the active listing for that NFT
2. WHEN a user views an NFT, THEN the system SHALL return all active offers for that NFT sorted by price
3. WHEN a user views their profile, THEN the system SHALL return all their active listings
4. WHEN a user views their profile, THEN the system SHALL return all their active offers
5. WHEN querying orders, THEN the system SHALL only return orders that have not expired
6. WHEN querying orders, THEN the system SHALL include maker information (display name, wallet address)
7. WHEN querying offers, THEN the system SHALL support sorting by price (ascending/descending) and recency

### Requirement 4: Real-time Order Synchronization

**User Story:** As a marketplace user, I want to see order updates in real-time, so that I have the most current marketplace information.

#### Acceptance Criteria

1. WHEN a new order is created, THEN the system SHALL broadcast the order to all connected clients via WebSocket
2. WHEN an order is cancelled, THEN the system SHALL broadcast the cancellation to all connected clients
3. WHEN an order is fulfilled, THEN the system SHALL broadcast the fulfillment to all connected clients
4. WHEN a client connects, THEN the system SHALL authenticate the WebSocket connection using JWT
5. WHEN an order update is broadcast, THEN the system SHALL include the order hash, type, and relevant details

### Requirement 5: Order Cancellation

**User Story:** As a marketplace user, I want to cancel my orders, so that I can remove listings or offers I no longer want.

#### Acceptance Criteria

1. WHEN a user cancels an order, THEN the system SHALL verify the user is the order maker
2. WHEN an order is cancelled, THEN the system SHALL mark the order as inactive and cancelled
3. WHEN an order is cancelled, THEN the system SHALL store the cancellation timestamp and reason
4. WHEN an order is cancelled, THEN the system SHALL log the cancellation event
5. WHEN an order is already fulfilled or cancelled, THEN the system SHALL reject the cancellation request

### Requirement 6: Order Fulfillment Tracking

**User Story:** As a marketplace user, I want the system to track when my orders are fulfilled, so that I have a complete transaction history.

#### Acceptance Criteria

1. WHEN an order is fulfilled on-chain, THEN the system SHALL detect the OrderFulfilled event
2. WHEN an OrderFulfilled event is detected, THEN the system SHALL update the order status to fulfilled
3. WHEN an order is fulfilled, THEN the system SHALL store the fulfiller address, transaction hash, and block number
4. WHEN an order is fulfilled, THEN the system SHALL create a fulfillment record in the order_fulfillments table
5. WHEN an order is fulfilled, THEN the system SHALL log the fulfillment event

### Requirement 7: Order Expiration Management

**User Story:** As a system administrator, I want expired orders to be automatically cleaned up, so that the marketplace only shows valid orders.

#### Acceptance Criteria

1. WHEN the cleanup cron job runs, THEN the system SHALL identify all orders with expires_at < current time
2. WHEN expired orders are found, THEN the system SHALL mark them as inactive
3. WHEN orders are marked inactive, THEN the system SHALL log the number of orders cleaned up
4. WHEN the cleanup job runs, THEN the system SHALL execute every 5 minutes
5. WHEN an expired order is queried, THEN the system SHALL not return it in active order lists

### Requirement 8: Order Event Logging

**User Story:** As a system administrator, I want all order activities logged, so that I can audit and debug marketplace operations.

#### Acceptance Criteria

1. WHEN an order is created, THEN the system SHALL log an order:created event
2. WHEN an order is cancelled, THEN the system SHALL log an order:cancelled event
3. WHEN an order is fulfilled, THEN the system SHALL log an order:fulfilled event
4. WHEN an order validation fails, THEN the system SHALL log an order:validation_failed event
5. WHEN logging events, THEN the system SHALL include order hash, actor address, and event data

### Requirement 9: Marketplace Overview

**User Story:** As a marketplace user, I want to browse all active orders, so that I can discover trading opportunities.

#### Acceptance Criteria

1. WHEN a user views the marketplace, THEN the system SHALL return all active listings
2. WHEN a user views the marketplace, THEN the system SHALL return all active offers
3. WHEN querying the marketplace, THEN the system SHALL support pagination with limit and offset
4. WHEN querying the marketplace, THEN the system SHALL support filtering by NFT contract address
5. WHEN querying the marketplace, THEN the system SHALL support filtering by order type (listing/offer)

### Requirement 10: Platform Fee Integration

**User Story:** As a platform operator, I want to collect fees on fulfilled orders, so that the platform can generate revenue.

#### Acceptance Criteria

1. WHEN an order is created, THEN the system SHALL validate the platform fee is included in consideration items
2. WHEN an order is stored, THEN the system SHALL record the platform fee amount and recipient
3. WHEN an order is fulfilled, THEN the system SHALL verify the platform fee was paid
4. WHEN querying orders, THEN the system SHALL include platform fee information
5. WHEN the platform fee recipient changes, THEN the system SHALL validate new orders use the correct recipient

### Requirement 11: Authentication and Authorization

**User Story:** As a marketplace user, I want my orders to be secure, so that only I can cancel my orders.

#### Acceptance Criteria

1. WHEN creating an order, THEN the system SHALL require a valid JWT token
2. WHEN cancelling an order, THEN the system SHALL verify the user is the order maker
3. WHEN querying user-specific orders, THEN the system SHALL require authentication
4. WHEN querying public marketplace data, THEN the system SHALL allow unauthenticated access
5. WHEN authentication fails, THEN the system SHALL return a 401 Unauthorized error

### Requirement 12: Error Handling and Validation

**User Story:** As a marketplace user, I want clear error messages, so that I understand why my order failed.

#### Acceptance Criteria

1. WHEN order validation fails, THEN the system SHALL return a 400 Bad Request with specific error details
2. WHEN signature verification fails, THEN the system SHALL return "Invalid order signature"
3. WHEN an order is expired, THEN the system SHALL return "Order has expired"
4. WHEN a duplicate order is submitted, THEN the system SHALL return "Order already exists"
5. WHEN database operations fail, THEN the system SHALL return a 500 Internal Server Error with logged details
