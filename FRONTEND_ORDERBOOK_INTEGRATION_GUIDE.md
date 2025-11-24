# Frontend Orderbook Integration Guide

**How On-Chain Seaport + Off-Chain Backend Work Together**

---

## Table of Contents

1. [Understanding the Architecture](#1-understanding-the-architecture)
2. [Flow Diagram: On-Chain + Off-Chain](#2-flow-diagram)
3. [Frontend Integration Files](#3-frontend-integration-files)
4. [Complete Code Examples](#4-complete-code-examples)
5. [Testing the Integration](#5-testing-the-integration)

---

## 1. Understanding the Architecture

### The Big Picture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React/Next.js)                     │
│                                                                       │
│  ┌──────────────────┐              ┌──────────────────┐            │
│  │  Seaport SDK     │              │   Backend API    │            │
│  │  (On-Chain)      │              │   (Off-Chain)    │            │
│  │                  │              │                  │            │
│  │ • Sign Orders    │─────────────▶│ • Store Orders   │            │
│  │ • Fulfill Orders │              │ • Validate       │            │
│  │ • Cancel Orders  │              │ • Broadcast      │            │
│  └──────────────────┘              └──────────────────┘            │
│           │                                  │                       │
└───────────┼──────────────────────────────────┼───────────────────────┘
            │                                  │
            ▼                                  ▼
   ┌─────────────────┐              ┌──────────────────┐
   │   Blockchain    │              │   PostgreSQL     │
   │   (Ethereum)    │              │   Database       │
   │                 │              │                  │
   │ • Seaport       │              │ • seaport_orders │
   │   Contract      │              │ • order_events   │
   │ • NFT Contracts │              │ • users          │
   └─────────────────┘              └──────────────────┘
```

### Key Concept: **Hybrid Model**

| Operation | On-Chain (Seaport SDK) | Off-Chain (Backend API) |
|-----------|------------------------|-------------------------|
| **Create Order** | ✅ Sign with wallet | ✅ Store in database |
| **List Orders** | ❌ No blockchain storage | ✅ Query from database |
| **Cancel Order** | ✅ Send transaction (optional) | ✅ Mark as cancelled |
| **Fulfill Order** | ✅ Execute trade on-chain | ✅ Record fulfillment |
| **Real-time Updates** | ❌ No events | ✅ WebSocket broadcasts |

---

## 2. Flow Diagram: On-Chain + Off-Chain

### Creating a Listing (Sell NFT)

```
USER CREATES LISTING
        │
        ├─────────────────────────────────────────────────┐
        │                                                 │
        ▼                                                 ▼
┌────────────────┐                              ┌─────────────────┐
│  FRONTEND      │                              │   BACKEND       │
│  (Seaport SDK) │                              │   (API)         │
└────────────────┘                              └─────────────────┘
        │                                                 │
        │ 1. Build order parameters                      │
        │    - NFT contract + token ID                   │
        │    - Price (in creator tokens)                 │
        │    - Expiration time                           │
        │    - Platform fee (2.5%)                       │
        │                                                 │
        │ 2. Generate Seaport order                      │
        │    components using SDK                        │
        │                                                 │
        │ 3. Sign order with wallet                      │
        │    (EIP-712 signature)                         │
        │    ✅ SIGNED ORDER                             │
        │                                                 │
        │ 4. POST /api/orders/listings/create            │
        │    {                                            │
        │      orderHash,                                │
        │      orderComponents,                          │
        │      signature                                 │
        │    }────────────────────────────────────────▶  │
        │                                                 │
        │                                        5. Validate signature
        │                                        6. Verify NFT ownership
        │                                        7. Check platform fee
        │                                        8. Store in database
        │                                        9. Broadcast via WebSocket
        │                                                 │
        │ 10. ◀────── { success: true, order } ──────────│
        │                                                 │
        ▼                                                 ▼
   Order signed                                    Order stored
   (off-chain)                                     (off-chain)
        │                                                 │
        └─────────────────────────────────────────────────┘
                              │
                              ▼
                    ✅ LISTING ACTIVE
                    (Visible to all users)
```

### Fulfilling an Order (Buy NFT)

```
BUYER WANTS TO BUY NFT
        │
        ├─────────────────────────────────────────────────┐
        │                                                 │
        ▼                                                 ▼
┌────────────────┐                              ┌─────────────────┐
│  FRONTEND      │                              │   BACKEND       │
│  (Buyer's UI)  │                              │   (API)         │
└────────────────┘                              └─────────────────┘
        │                                                 │
        │ 1. GET /api/orders/listings/:tokenId           │
        │    ?nftContract=0x...                          │
        │────────────────────────────────────────────▶   │
        │                                                 │
        │                                        2. Query database
        │                                        3. Return order details
        │                                                 │
        │ 4. ◀────── { listing: { orderComponents,       │
        │                        signature } } ───────────│
        │                                                 │
        │ 5. Prepare fulfillment with Seaport SDK        │
        │                                                 │
        ▼                                                 │
┌────────────────┐                                       │
│  BLOCKCHAIN    │                                       │
│  (Seaport)     │                                       │
└────────────────┘                                       │
        │                                                 │
        │ 6. Buyer calls Seaport.fulfillOrder()          │
        │    - Transfers tokens to seller                │
        │    - Transfers platform fee                    │
        │    - Transfers NFT to buyer                    │
        │    ✅ TRANSACTION MINED                        │
        │                                                 │
        │ 7. POST /api/orders/:orderHash/fulfill         │
        │    {                                            │
        │      fulfiller,                                │
        │      transactionHash,                          │
        │      blockNumber                               │
        │    }────────────────────────────────────────▶  │
        │                                                 │
        │                                        8. Update order status
        │                                        9. Record fulfillment
        │                                        10. Broadcast event
        │                                                 │
        │                                                 ▼
        │                                        OrderFulfillmentMonitor
        │                                        detects event automatically
        │                                                 │
        ▼                                                 ▼
   NFT transferred                              Order marked fulfilled
   (on-chain)                                   (off-chain)
```

---

## 3. Frontend Integration Files

### Recommended File Structure

```
frontend/
├── src/
│   ├── lib/
│   │   ├── seaport.ts              # Seaport SDK configuration
│   │   ├── orderbook-api.ts        # Backend API client
│   │   └── socket.ts               # WebSocket client
│   │
│   ├── hooks/
│   │   ├── useSeaport.ts           # Seaport SDK hook
│   │   ├── useOrderbook.ts         # Backend API hook
│   │   ├── useCreateListing.ts     # Create listing flow
│   │   ├── useCreateOffer.ts       # Create offer flow
│   │   ├── useFulfillOrder.ts      # Fulfill order flow
│   │   └── useOrderSync.ts         # Real-time order sync
│   │
│   ├── components/
│   │   ├── CreateListingModal.tsx  # UI for creating listings
│   │   ├── CreateOfferModal.tsx    # UI for creating offers
│   │   ├── OrdersList.tsx          # Display orders
│   │   └── NFTMarketplace.tsx      # Main marketplace page
│   │
│   └── types/
│       └── orderbook.ts            # TypeScript types
```

---

## 4. Complete Code Examples

### File 1: `lib/orderbook-api.ts`

Backend API client for all orderbook operations.

```typescript
// lib/orderbook-api.ts
import axios from 'axios';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5009';

// Create axios instance with auth interceptor
const api = axios.create({
  baseURL: BACKEND_URL,
});

// Add JWT token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken'); // Or your auth method
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface CreateOrderData {
  orderHash: string;
  orderType: 'listing' | 'offer';
  nftContract: string;
  tokenId: string;
  maker: string;
  taker?: string | null;
  paymentToken: string;
  price: string;
  priceDecimal?: string;
  platformFeeAmount?: string;
  platformFeeRecipient?: string;
  startTime: number;
  endTime: number;
  orderComponents: any; // Seaport OrderComponents
  signature: string;
}

export interface Order {
  orderHash: string;
  orderType: 'listing' | 'offer';
  tokenId: string;
  nftContract: string;
  maker: string;
  price: string;
  priceDecimal: string;
  paymentToken: string;
  expiresAt: string;
  orderComponents: any;
  signature: string;
  isActive: boolean;
  isCancelled: boolean;
  isFulfilled: boolean;
}

/**
 * Create a new listing order
 */
export async function createListing(orderData: CreateOrderData) {
  const response = await api.post<{ success: boolean; order: Order }>(
    '/api/orders/listings/create',
    orderData
  );
  return response.data;
}

/**
 * Create a new offer order
 */
export async function createOffer(orderData: CreateOrderData) {
  const response = await api.post<{ success: boolean; order: Order }>(
    '/api/orders/offers/create',
    orderData
  );
  return response.data;
}

/**
 * Get active listing for an NFT
 */
export async function getListing(tokenId: string, nftContract: string) {
  const response = await api.get<{ success: boolean; listing: Order | null }>(
    `/api/orders/listings/${tokenId}`,
    { params: { nftContract } }
  );
  return response.data.listing;
}

/**
 * Get all offers for an NFT
 */
export async function getOffers(
  tokenId: string,
  nftContract: string,
  options?: {
    limit?: number;
    offset?: number;
    sort?: 'price_asc' | 'price_desc' | 'recent';
  }
) {
  const response = await api.get<{
    success: boolean;
    offers: Order[];
    total: number;
  }>(`/api/orders/offers/${tokenId}`, {
    params: { nftContract, ...options },
  });
  return response.data;
}

/**
 * Get user's active listings
 */
export async function getUserListings() {
  const response = await api.get<{ success: boolean; listings: Order[] }>(
    '/api/orders/user/listings'
  );
  return response.data.listings;
}

/**
 * Get user's active offers
 */
export async function getUserOffers() {
  const response = await api.get<{ success: boolean; offers: Order[] }>(
    '/api/orders/user/offers'
  );
  return response.data.offers;
}

/**
 * Cancel an order
 */
export async function cancelOrder(
  orderHash: string,
  reason?: string,
  transactionHash?: string
) {
  const response = await api.delete<{ success: boolean; order: Order }>(
    `/api/orders/${orderHash}/cancel`,
    { data: { reason, transactionHash } }
  );
  return response.data;
}

/**
 * Record order fulfillment
 */
export async function fulfillOrder(
  orderHash: string,
  fulfillmentData: {
    fulfiller: string;
    transactionHash: string;
    blockNumber: number;
    amountPaid?: string;
    platformFeePaid?: string;
  }
) {
  const response = await api.post<{ success: boolean; order: Order }>(
    `/api/orders/${orderHash}/fulfill`,
    fulfillmentData
  );
  return response.data;
}

/**
 * Get marketplace orders
 */
export async function getMarketplaceOrders(options?: {
  limit?: number;
  offset?: number;
  orderType?: 'listing' | 'offer';
  nftContract?: string;
  sortBy?: 'created_at' | 'price' | 'expires_at';
  sortOrder?: 'ASC' | 'DESC';
}) {
  const response = await api.get<{
    success: boolean;
    orders: Order[];
    total: number;
  }>('/api/orders/marketplace', {
    params: options,
  });
  return response.data;
}

export default api;
```

---

### File 2: `lib/socket.ts`

WebSocket client for real-time order updates.

```typescript
// lib/socket.ts
import { io, Socket } from 'socket.io-client';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5009';

let socket: Socket | null = null;

/**
 * Initialize WebSocket connection
 */
export function initializeSocket(authToken: string) {
  if (socket) {
    return socket;
  }

  socket = io(`${BACKEND_URL}/orders`, {
    auth: {
      token: authToken,
    },
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    console.log('✅ Connected to orderbook WebSocket');
  });

  socket.on('disconnect', () => {
    console.log('❌ Disconnected from orderbook WebSocket');
  });

  socket.on('connect_error', (error) => {
    console.error('WebSocket connection error:', error);
  });

  return socket;
}

/**
 * Join NFT-specific room for targeted updates
 */
export function joinNFTRoom(nftContract: string, tokenId: string) {
  if (!socket) {
    throw new Error('Socket not initialized');
  }

  socket.emit('join-nft', { nftContract, tokenId });

  return new Promise<void>((resolve) => {
    socket!.once('joined-nft', (data) => {
      console.log('Joined NFT room:', data.room);
      resolve();
    });
  });
}

/**
 * Leave NFT-specific room
 */
export function leaveNFTRoom(nftContract: string, tokenId: string) {
  if (!socket) return;
  socket.emit('leave-nft', { nftContract, tokenId });
}

/**
 * Disconnect socket
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Get socket instance
 */
export function getSocket() {
  if (!socket) {
    throw new Error('Socket not initialized. Call initializeSocket() first.');
  }
  return socket;
}

export default {
  initializeSocket,
  joinNFTRoom,
  leaveNFTRoom,
  disconnectSocket,
  getSocket,
};
```

---

### File 3: `hooks/useCreateListing.ts`

Hook that combines Seaport SDK + Backend API for creating listings.

```typescript
// hooks/useCreateListing.ts
import { useState } from 'react';
import { useSeaport } from './useSeaport'; // Your existing Seaport hook
import { createListing } from '@/lib/orderbook-api';
import { parseUnits } from 'ethers';

interface CreateListingParams {
  nftContract: string;
  tokenId: string;
  paymentToken: string;
  price: string; // Human-readable price (e.g., "100.5")
  expirationDays: number;
}

export function useCreateListing() {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { seaport, address } = useSeaport(); // Your existing Seaport SDK hook

  const createListingOrder = async (params: CreateListingParams) => {
    if (!seaport || !address) {
      throw new Error('Wallet not connected');
    }

    setIsCreating(true);
    setError(null);

    try {
      const { nftContract, tokenId, paymentToken, price, expirationDays } = params;

      // 1. Calculate platform fee (2.5%)
      const PLATFORM_FEE_BASIS_POINTS = 250;
      const PLATFORM_FEE_RECIPIENT = process.env.NEXT_PUBLIC_PLATFORM_FEE_RECIPIENT;

      const priceInWei = parseUnits(price, 18); // Assuming 18 decimals
      const platformFeeAmount = (priceInWei * BigInt(PLATFORM_FEE_BASIS_POINTS)) / 10000n;

      // 2. Calculate expiration time
      const startTime = Math.floor(Date.now() / 1000);
      const endTime = startTime + expirationDays * 24 * 60 * 60;

      // 3. Build Seaport order using your existing SDK integration
      const { executeAllActions } = await seaport.createOrder(
        {
          offer: [
            {
              itemType: 2, // ERC721
              token: nftContract,
              identifier: tokenId,
            },
          ],
          consideration: [
            {
              amount: priceInWei.toString(),
              recipient: address,
              token: paymentToken,
            },
            // Platform fee
            ...(PLATFORM_FEE_RECIPIENT
              ? [
                  {
                    amount: platformFeeAmount.toString(),
                    recipient: PLATFORM_FEE_RECIPIENT,
                    token: paymentToken,
                  },
                ]
              : []),
          ],
          startTime: startTime.toString(),
          endTime: endTime.toString(),
        },
        address
      );

      // 4. Sign the order (triggers wallet signature)
      const order = await executeAllActions();

      // 5. Calculate order hash
      const orderHash = seaport.getOrderHash(order.parameters);

      // 6. Send to backend API
      const result = await createListing({
        orderHash,
        orderType: 'listing',
        nftContract,
        tokenId,
        maker: address,
        taker: null,
        paymentToken,
        price: priceInWei.toString(),
        priceDecimal: price,
        platformFeeAmount: PLATFORM_FEE_RECIPIENT ? platformFeeAmount.toString() : undefined,
        platformFeeRecipient: PLATFORM_FEE_RECIPIENT || undefined,
        startTime,
        endTime,
        orderComponents: order.parameters,
        signature: order.signature,
      });

      console.log('✅ Listing created:', result.order);
      setIsCreating(false);
      return result.order;
    } catch (err: any) {
      console.error('❌ Failed to create listing:', err);
      setError(err.message || 'Failed to create listing');
      setIsCreating(false);
      throw err;
    }
  };

  return {
    createListing: createListingOrder,
    isCreating,
    error,
  };
}
```

---

### File 4: `hooks/useFulfillOrder.ts`

Hook for buying NFTs (fulfilling orders).

```typescript
// hooks/useFulfillOrder.ts
import { useState } from 'react';
import { useSeaport } from './useSeaport';
import { fulfillOrder } from '@/lib/orderbook-api';
import type { Order } from '@/lib/orderbook-api';

export function useFulfillOrder() {
  const [isFulfilling, setIsFulfilling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { seaport, address, provider } = useSeaport();

  const fulfill = async (order: Order) => {
    if (!seaport || !address || !provider) {
      throw new Error('Wallet not connected');
    }

    setIsFulfilling(true);
    setError(null);

    try {
      console.log('🔄 Fulfilling order:', order.orderHash);

      // 1. Fulfill order on-chain using Seaport SDK
      const { executeAllActions } = await seaport.fulfillOrder({
        order: {
          parameters: order.orderComponents,
          signature: order.signature,
        },
        accountAddress: address,
      });

      // 2. Execute the transaction
      const transaction = await executeAllActions();

      console.log('⏳ Transaction sent:', transaction.hash);

      // 3. Wait for transaction confirmation
      const receipt = await provider.waitForTransaction(transaction.hash);

      console.log('✅ Transaction confirmed:', receipt.transactionHash);

      // 4. Notify backend of fulfillment
      await fulfillOrder(order.orderHash, {
        fulfiller: address,
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
      });

      console.log('✅ Backend notified of fulfillment');

      setIsFulfilling(false);
      return receipt;
    } catch (err: any) {
      console.error('❌ Failed to fulfill order:', err);
      setError(err.message || 'Failed to fulfill order');
      setIsFulfilling(false);
      throw err;
    }
  };

  return {
    fulfillOrder: fulfill,
    isFulfilling,
    error,
  };
}
```

---

### File 5: `hooks/useOrderSync.ts`

Hook for real-time order updates via WebSocket.

```typescript
// hooks/useOrderSync.ts
import { useEffect, useState } from 'react';
import { getSocket, initializeSocket } from '@/lib/socket';

interface OrderEvent {
  orderHash: string;
  orderType: 'listing' | 'offer';
  tokenId: string;
  nftContract: string;
  maker: string;
  price?: string;
  timestamp: string;
}

export function useOrderSync(authToken: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<OrderEvent | null>(null);

  useEffect(() => {
    if (!authToken) return;

    // Initialize socket
    const socket = initializeSocket(authToken);

    socket.on('connect', () => {
      console.log('✅ Order sync connected');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('❌ Order sync disconnected');
      setIsConnected(false);
    });

    // Listen for order creation events
    socket.on('order:created', (data: OrderEvent) => {
      console.log('📢 New order created:', data);
      setLastEvent(data);
      // Trigger UI update (e.g., refetch orders)
    });

    // Listen for order cancellation events
    socket.on('order:cancelled', (data: OrderEvent) => {
      console.log('📢 Order cancelled:', data);
      setLastEvent(data);
      // Update UI to remove cancelled order
    });

    // Listen for order fulfillment events
    socket.on('order:fulfilled', (data: OrderEvent) => {
      console.log('📢 Order fulfilled:', data);
      setLastEvent(data);
      // Update UI to show order as sold
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('order:created');
      socket.off('order:cancelled');
      socket.off('order:fulfilled');
    };
  }, [authToken]);

  return {
    isConnected,
    lastEvent,
  };
}
```

---

### File 6: `components/CreateListingModal.tsx`

React component for creating listings.

```typescript
// components/CreateListingModal.tsx
import { useState } from 'react';
import { useCreateListing } from '@/hooks/useCreateListing';

interface CreateListingModalProps {
  nftContract: string;
  tokenId: string;
  onSuccess: () => void;
  onClose: () => void;
}

export default function CreateListingModal({
  nftContract,
  tokenId,
  onSuccess,
  onClose,
}: CreateListingModalProps) {
  const [price, setPrice] = useState('');
  const [expirationDays, setExpirationDays] = useState(7);
  const { createListing, isCreating, error } = useCreateListing();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await createListing({
        nftContract,
        tokenId,
        paymentToken: process.env.NEXT_PUBLIC_CREATOR_TOKEN_ADDRESS!, // Your creator token
        price,
        expirationDays,
      });

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to create listing:', err);
    }
  };

  return (
    <div className="modal">
      <div className="modal-content">
        <h2>Create Listing</h2>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Price (in Creator Tokens)</label>
            <input
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="100.5"
              required
            />
          </div>

          <div className="form-group">
            <label>Expiration</label>
            <select
              value={expirationDays}
              onChange={(e) => setExpirationDays(Number(e.target.value))}
            >
              <option value={1}>1 day</option>
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
          </div>

          {error && <div className="error">{error}</div>}

          <div className="button-group">
            <button type="button" onClick={onClose} disabled={isCreating}>
              Cancel
            </button>
            <button type="submit" disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create Listing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

---

### File 7: `components/NFTMarketplace.tsx`

Main marketplace component showing listings and offers.

```typescript
// components/NFTMarketplace.tsx
import { useEffect, useState } from 'react';
import { getListing, getOffers } from '@/lib/orderbook-api';
import { useFulfillOrder } from '@/hooks/useFulfillOrder';
import { useOrderSync } from '@/hooks/useOrderSync';
import type { Order } from '@/lib/orderbook-api';

interface NFTMarketplaceProps {
  nftContract: string;
  tokenId: string;
  authToken: string;
}

export default function NFTMarketplace({
  nftContract,
  tokenId,
  authToken,
}: NFTMarketplaceProps) {
  const [listing, setListing] = useState<Order | null>(null);
  const [offers, setOffers] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const { fulfillOrder, isFulfilling } = useFulfillOrder();
  const { isConnected, lastEvent } = useOrderSync(authToken);

  // Fetch orders
  const fetchOrders = async () => {
    setLoading(true);
    try {
      const [listingData, offersData] = await Promise.all([
        getListing(tokenId, nftContract),
        getOffers(tokenId, nftContract, { sort: 'price_desc' }),
      ]);

      setListing(listingData);
      setOffers(offersData.offers);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchOrders();
  }, [nftContract, tokenId]);

  // Refetch when real-time events occur
  useEffect(() => {
    if (lastEvent && lastEvent.tokenId === tokenId) {
      fetchOrders();
    }
  }, [lastEvent]);

  const handleBuyNFT = async () => {
    if (!listing) return;

    try {
      await fulfillOrder(listing);
      alert('NFT purchased successfully!');
      fetchOrders();
    } catch (err) {
      alert('Failed to purchase NFT');
    }
  };

  if (loading) {
    return <div>Loading orders...</div>;
  }

  return (
    <div className="marketplace">
      <div className="connection-status">
        Real-time updates: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
      </div>

      {/* Active Listing */}
      <div className="listing-section">
        <h2>Current Listing</h2>
        {listing ? (
          <div className="listing-card">
            <p>Price: {listing.priceDecimal} tokens</p>
            <p>Seller: {listing.maker}</p>
            <p>Expires: {new Date(listing.expiresAt).toLocaleDateString()}</p>
            <button onClick={handleBuyNFT} disabled={isFulfilling}>
              {isFulfilling ? 'Purchasing...' : 'Buy Now'}
            </button>
          </div>
        ) : (
          <p>No active listing</p>
        )}
      </div>

      {/* Offers */}
      <div className="offers-section">
        <h2>Active Offers ({offers.length})</h2>
        {offers.length > 0 ? (
          <div className="offers-list">
            {offers.map((offer) => (
              <div key={offer.orderHash} className="offer-card">
                <p>Price: {offer.priceDecimal} tokens</p>
                <p>From: {offer.maker}</p>
                <p>Expires: {new Date(offer.expiresAt).toLocaleDateString()}</p>
                <button>Accept Offer</button>
              </div>
            ))}
          </div>
        ) : (
          <p>No active offers</p>
        )}
      </div>
    </div>
  );
}
```

---

## 5. Testing the Integration

### Step 1: Start Backend Server

```bash
cd backend
npm run dev
```

Verify you see:
```
✅ OrderSocketService initialized with /orders namespace
✅ Database connected successfully
✅ Order cleanup cron service started
✅ OrderFulfillmentMonitorService started
```

### Step 2: Test API Connection

```typescript
// Test in browser console
import { getListing } from '@/lib/orderbook-api';

const listing = await getListing('1', '0xYourNFTContract');
console.log('Listing:', listing);
```

### Step 3: Create Test Listing

```typescript
import { useCreateListing } from '@/hooks/useCreateListing';

const { createListing } = useCreateListing();

await createListing({
  nftContract: '0xYourNFTContract',
  tokenId: '1',
  paymentToken: '0xYourCreatorToken',
  price: '100',
  expirationDays: 7,
});
```

### Step 4: Verify WebSocket Updates

Open browser console:
```
✅ Order sync connected
📢 New order created: { orderHash: '0x...', ... }
```

### Step 5: Test Order Fulfillment

```typescript
import { useFulfillOrder } from '@/hooks/useFulfillOrder';

const { fulfillOrder } = useFulfillOrder();

const listing = await getListing('1', '0xNFT');
await fulfillOrder(listing);
```

Check console:
```
⏳ Transaction sent: 0x...
✅ Transaction confirmed: 0x...
✅ Backend notified of fulfillment
📢 Order fulfilled: { orderHash: '0x...', ... }
```

---

## 6. Environment Variables

Add to your `.env.local`:

```bash
# Backend API
NEXT_PUBLIC_BACKEND_URL=http://localhost:5009

# Platform Fee
NEXT_PUBLIC_PLATFORM_FEE_RECIPIENT=0xYourPlatformWallet
NEXT_PUBLIC_PLATFORM_FEE_BASIS_POINTS=250

# Seaport
NEXT_PUBLIC_SEAPORT_CONTRACT=0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC

# NFT Contract
NEXT_PUBLIC_NFT_CONTRACT=0xYourNFTContract

# Creator Token
NEXT_PUBLIC_CREATOR_TOKEN_ADDRESS=0xYourCreatorToken
```

---

## 7. Summary

### What Happens On-Chain (Seaport SDK)
✅ Signing orders (EIP-712)
✅ Fulfilling orders (trading NFTs)
✅ Cancelling orders (optional on-chain cancellation)

### What Happens Off-Chain (Backend API)
✅ Storing signed orders in PostgreSQL
✅ Validating order signatures
✅ Broadcasting order events via WebSocket
✅ Querying available orders
✅ Recording fulfillment history

### Your Frontend Integration Checklist
- [ ] Copy the 7 code files above to your frontend
- [ ] Update environment variables
- [ ] Connect `useSeaport()` hook (your existing Seaport integration)
- [ ] Test creating a listing
- [ ] Test buying an NFT
- [ ] Verify WebSocket real-time updates
- [ ] Test cancelling orders

---

**Questions?** Check the test files in the backend for more examples!
