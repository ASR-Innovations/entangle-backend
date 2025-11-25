# WebSocket Order Real-time Synchronization

## Overview

This document describes the WebSocket real-time synchronization implementation for the Seaport orderbook. The system provides real-time updates for order creation, cancellation, and fulfillment events across all connected clients.

## Architecture

### Namespace Structure

The order WebSocket functionality uses a dedicated Socket.IO namespace: `/orders`

This separation provides:
- Isolated event handling for order-related events
- Independent authentication and authorization
- Better scalability and organization

### Authentication

All WebSocket connections to the `/orders` namespace require JWT authentication.

**Connection Example:**
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000/orders', {
  auth: {
    token: 'your-jwt-token-here'
  }
});
```

**Authentication Flow:**
1. Client provides JWT token in `auth.token` during connection
2. Server validates token using `authenticateSocket` middleware
3. If valid, connection is established and `socket.user` contains decoded user data
4. If invalid, connection is rejected with authentication error

## Room-Based Broadcasting

### NFT-Specific Rooms

Orders are broadcast to NFT-specific rooms, allowing clients to subscribe only to updates for NFTs they're interested in.

**Room Naming Convention:**
```
nft:{nftContract}:{tokenId}
```

Example: `nft:0x1234567890123456789012345678901234567890:123`

### Joining/Leaving Rooms

**Join an NFT Room:**
```javascript
socket.emit('join-nft', {
  nftContract: '0x1234567890123456789012345678901234567890',
  tokenId: '123'
});

socket.on('joined-nft', (data) => {
  console.log('Joined room:', data.room);
});
```

**Leave an NFT Room:**
```javascript
socket.emit('leave-nft', {
  nftContract: '0x1234567890123456789012345678901234567890',
  tokenId: '123'
});
```

## Events

### 1. Order Created Event

Broadcast when a new order (listing or offer) is created.

**Event Name:** `order:created`

**Broadcast Scope:**
- NFT-specific room: `nft:{contract}:{tokenId}`
- Global marketplace: `marketplace:order:created`

**Event Data:**
```javascript
{
  orderHash: '0x...',
  orderType: 'listing' | 'offer',
  tokenId: '123',
  nftContract: '0x...',
  maker: '0x...',
  price: '1000000000000000000',
  paymentToken: '0x...',
  timestamp: '2025-11-20T15:45:03.000Z'
}
```

**Client Example:**
```javascript
// Listen for orders in specific NFT room
socket.on('order:created', (data) => {
  console.log('New order created:', data);
  // Update UI with new order
});

// Listen for all marketplace orders
socket.on('marketplace:order:created', (data) => {
  console.log('New marketplace order:', data);
  // Update marketplace feed
});
```

### 2. Order Cancelled Event

Broadcast when an order is cancelled by its maker.

**Event Name:** `order:cancelled`

**Broadcast Scope:**
- NFT-specific room: `nft:{contract}:{tokenId}`
- Global marketplace: `marketplace:order:cancelled`

**Event Data:**
```javascript
{
  orderHash: '0x...',
  orderType: 'listing' | 'offer',
  tokenId: '123',
  nftContract: '0x...',
  maker: '0x...',
  timestamp: '2025-11-20T15:45:03.000Z'
}
```

**Client Example:**
```javascript
socket.on('order:cancelled', (data) => {
  console.log('Order cancelled:', data);
  // Remove order from UI
});
```

### 3. Order Fulfilled Event

Broadcast when an order is fulfilled on-chain.

**Event Name:** `order:fulfilled`

**Broadcast Scope:**
- NFT-specific room: `nft:{contract}:{tokenId}`
- Global marketplace: `marketplace:order:fulfilled`

**Event Data:**
```javascript
{
  orderHash: '0x...',
  orderType: 'listing' | 'offer',
  tokenId: '123',
  nftContract: '0x...',
  maker: '0x...',
  fulfiller: '0x...',
  transactionHash: '0x...',
  timestamp: '2025-11-20T15:45:03.000Z'
}
```

**Client Example:**
```javascript
socket.on('order:fulfilled', (data) => {
  console.log('Order fulfilled:', data);
  // Update UI to show fulfilled status
  // Show transaction link
});
```

## Complete Client Integration Example

```javascript
import io from 'socket.io-client';

class OrderWebSocketClient {
  constructor(baseUrl, authToken) {
    this.socket = io(`${baseUrl}/orders`, {
      auth: { token: authToken }
    });
    
    this.setupEventHandlers();
  }
  
  setupEventHandlers() {
    // Connection events
    this.socket.on('connect', () => {
      console.log('Connected to order WebSocket');
    });
    
    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error.message);
    });
    
    this.socket.on('disconnect', () => {
      console.log('Disconnected from order WebSocket');
    });
    
    // Order events
    this.socket.on('order:created', (data) => {
      this.handleOrderCreated(data);
    });
    
    this.socket.on('order:cancelled', (data) => {
      this.handleOrderCancelled(data);
    });
    
    this.socket.on('order:fulfilled', (data) => {
      this.handleOrderFulfilled(data);
    });
    
    // Marketplace events
    this.socket.on('marketplace:order:created', (data) => {
      this.handleMarketplaceOrderCreated(data);
    });
  }
  
  // Subscribe to specific NFT updates
  subscribeToNFT(nftContract, tokenId) {
    this.socket.emit('join-nft', { nftContract, tokenId });
    
    this.socket.once('joined-nft', (data) => {
      console.log('Subscribed to NFT:', data.room);
    });
  }
  
  // Unsubscribe from NFT updates
  unsubscribeFromNFT(nftContract, tokenId) {
    this.socket.emit('leave-nft', { nftContract, tokenId });
  }
  
  // Event handlers
  handleOrderCreated(data) {
    console.log('New order:', data);
    // Update your UI state
  }
  
  handleOrderCancelled(data) {
    console.log('Order cancelled:', data);
    // Remove order from UI
  }
  
  handleOrderFulfilled(data) {
    console.log('Order fulfilled:', data);
    // Update order status in UI
  }
  
  handleMarketplaceOrderCreated(data) {
    console.log('New marketplace order:', data);
    // Update marketplace feed
  }
  
  disconnect() {
    this.socket.disconnect();
  }
}

// Usage
const client = new OrderWebSocketClient(
  'http://localhost:5000',
  'your-jwt-token'
);

// Subscribe to specific NFT
client.subscribeToNFT(
  '0x1234567890123456789012345678901234567890',
  '123'
);

// Later, unsubscribe
client.unsubscribeFromNFT(
  '0x1234567890123456789012345678901234567890',
  '123'
);
```

## React Integration Example

```javascript
import { useEffect, useState } from 'react';
import io from 'socket.io-client';

function useOrderWebSocket(nftContract, tokenId, authToken) {
  const [orders, setOrders] = useState([]);
  const [socket, setSocket] = useState(null);
  
  useEffect(() => {
    // Connect to WebSocket
    const newSocket = io('http://localhost:5000/orders', {
      auth: { token: authToken }
    });
    
    setSocket(newSocket);
    
    // Setup event handlers
    newSocket.on('connect', () => {
      console.log('Connected to order WebSocket');
      
      // Join NFT room
      if (nftContract && tokenId) {
        newSocket.emit('join-nft', { nftContract, tokenId });
      }
    });
    
    newSocket.on('order:created', (data) => {
      setOrders(prev => [...prev, data]);
    });
    
    newSocket.on('order:cancelled', (data) => {
      setOrders(prev => prev.filter(o => o.orderHash !== data.orderHash));
    });
    
    newSocket.on('order:fulfilled', (data) => {
      setOrders(prev => prev.map(o => 
        o.orderHash === data.orderHash 
          ? { ...o, fulfilled: true, fulfiller: data.fulfiller }
          : o
      ));
    });
    
    // Cleanup
    return () => {
      if (nftContract && tokenId) {
        newSocket.emit('leave-nft', { nftContract, tokenId });
      }
      newSocket.disconnect();
    };
  }, [nftContract, tokenId, authToken]);
  
  return { orders, socket };
}

// Component usage
function NFTOrderBook({ nftContract, tokenId, authToken }) {
  const { orders } = useOrderWebSocket(nftContract, tokenId, authToken);
  
  return (
    <div>
      <h2>Orders</h2>
      {orders.map(order => (
        <div key={order.orderHash}>
          <p>Type: {order.orderType}</p>
          <p>Price: {order.price}</p>
          <p>Maker: {order.maker}</p>
        </div>
      ))}
    </div>
  );
}
```

## Server-Side Implementation

### OrderSocketService

The `OrderSocketService` class handles all WebSocket functionality:

**Location:** `src/services/OrderSocketService.js`

**Key Methods:**
- `initialize()` - Sets up namespace and event handlers
- `broadcastOrderCreated(orderData)` - Broadcasts order creation
- `broadcastOrderCancelled(orderData)` - Broadcasts order cancellation
- `broadcastOrderFulfilled(orderData)` - Broadcasts order fulfillment
- `getRoomName(nftContract, tokenId)` - Generates room name
- `getRoomClientCount(nftContract, tokenId)` - Gets connected clients in room
- `getTotalClientCount()` - Gets total connected clients

### Integration with Order Routes

Order routes automatically broadcast events when orders are created, cancelled, or fulfilled:

```javascript
// Example from src/routes/orders.js
const { getOrderSocketService } = require('../services/OrderSocketService');
const orderSocketService = getOrderSocketService();

// After creating order
orderSocketService.broadcastOrderCreated({
  orderHash: order.orderHash,
  orderType: order.orderType,
  tokenId: order.tokenId,
  nftContract: order.nftContract,
  maker: order.maker,
  price: order.price,
  paymentToken: order.paymentToken
});
```

## Testing

### Manual Testing

1. Start the server:
```bash
npm start
```

2. Connect a WebSocket client with authentication
3. Join an NFT room
4. Create/cancel/fulfill orders via REST API
5. Verify events are received in real-time

### Automated Testing

Run the verification test:
```bash
node test-order-websocket-simple.js
```

## Performance Considerations

### Scalability

- **Room-based broadcasting** reduces unnecessary network traffic
- Clients only receive updates for NFTs they're subscribed to
- Global marketplace events available for feed/dashboard views

### Connection Management

- Automatic reconnection on client side recommended
- Exponential backoff for reconnection attempts
- Graceful handling of disconnections

### Best Practices

1. **Subscribe only to needed NFTs** - Don't join all rooms
2. **Unsubscribe when leaving pages** - Clean up room subscriptions
3. **Handle reconnections** - Implement reconnection logic with state sync
4. **Debounce UI updates** - Batch multiple rapid updates
5. **Error handling** - Always handle connection errors gracefully

## Security

### Authentication

- All connections require valid JWT token
- Token validated on connection and stored in `socket.user`
- Expired tokens rejected with authentication error

### Authorization

- Room joining is open (any authenticated user can join any room)
- Broadcasting is server-controlled (clients cannot broadcast)
- Events are read-only for clients

### Rate Limiting

Consider implementing rate limiting for:
- Connection attempts
- Room join/leave operations
- Event broadcasting (server-side)

## Troubleshooting

### Connection Issues

**Problem:** Cannot connect to WebSocket
**Solution:** 
- Verify server is running
- Check JWT token is valid and not expired
- Verify CORS configuration allows your origin

**Problem:** Not receiving events
**Solution:**
- Verify you've joined the correct NFT room
- Check event listener is set up before events occur
- Verify order operations are completing successfully

### Performance Issues

**Problem:** Too many events causing UI lag
**Solution:**
- Implement debouncing for UI updates
- Use virtual scrolling for large order lists
- Batch multiple updates together

## Requirements Coverage

This implementation satisfies the following requirements:

- ✅ **Requirement 4.1:** Broadcast new orders to all connected clients
- ✅ **Requirement 4.2:** Broadcast cancellations to all connected clients
- ✅ **Requirement 4.3:** Broadcast fulfillments to all connected clients
- ✅ **Requirement 4.4:** WebSocket authentication using JWT
- ✅ **Requirement 4.5:** Room-based broadcasting per NFT

## Future Enhancements

Potential improvements for future versions:

1. **Presence tracking** - Show who's viewing an NFT
2. **Typing indicators** - For chat/negotiation features
3. **Order book depth** - Real-time order book visualization
4. **Price alerts** - Client-side price change notifications
5. **Historical events** - Replay recent events on connection
6. **Compression** - WebSocket message compression for bandwidth
7. **Redis adapter** - For horizontal scaling across multiple servers
