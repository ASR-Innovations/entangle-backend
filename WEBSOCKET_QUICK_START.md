# WebSocket Quick Start Guide

## For Frontend Developers

### 1. Install Socket.IO Client

```bash
npm install socket.io-client
```

### 2. Connect to Orders Namespace

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000/orders', {
  auth: {
    token: yourJWTToken  // Get from your auth system
  }
});
```

### 3. Subscribe to NFT Updates

```javascript
// Join room for specific NFT
socket.emit('join-nft', {
  nftContract: '0x1234567890123456789012345678901234567890',
  tokenId: '123'
});

// Confirmation
socket.on('joined-nft', (data) => {
  console.log('Subscribed to:', data.room);
});
```

### 4. Listen for Events

```javascript
// New order created
socket.on('order:created', (order) => {
  console.log('New order:', order);
  // Update your UI
});

// Order cancelled
socket.on('order:cancelled', (order) => {
  console.log('Order cancelled:', order);
  // Remove from UI
});

// Order fulfilled
socket.on('order:fulfilled', (order) => {
  console.log('Order fulfilled:', order);
  // Update status in UI
});
```

### 5. Unsubscribe When Done

```javascript
// Leave room
socket.emit('leave-nft', {
  nftContract: '0x1234567890123456789012345678901234567890',
  tokenId: '123'
});

// Disconnect
socket.disconnect();
```

## React Hook Example

```javascript
import { useEffect, useState } from 'react';
import io from 'socket.io-client';

function useOrderUpdates(nftContract, tokenId, authToken) {
  const [orders, setOrders] = useState([]);
  
  useEffect(() => {
    const socket = io('http://localhost:5000/orders', {
      auth: { token: authToken }
    });
    
    socket.on('connect', () => {
      socket.emit('join-nft', { nftContract, tokenId });
    });
    
    socket.on('order:created', (order) => {
      setOrders(prev => [...prev, order]);
    });
    
    socket.on('order:cancelled', (order) => {
      setOrders(prev => prev.filter(o => o.orderHash !== order.orderHash));
    });
    
    socket.on('order:fulfilled', (order) => {
      setOrders(prev => prev.map(o => 
        o.orderHash === order.orderHash 
          ? { ...o, fulfilled: true }
          : o
      ));
    });
    
    return () => {
      socket.emit('leave-nft', { nftContract, tokenId });
      socket.disconnect();
    };
  }, [nftContract, tokenId, authToken]);
  
  return orders;
}

// Usage in component
function NFTPage({ nftContract, tokenId }) {
  const authToken = useAuth(); // Your auth hook
  const orders = useOrderUpdates(nftContract, tokenId, authToken);
  
  return (
    <div>
      {orders.map(order => (
        <OrderCard key={order.orderHash} order={order} />
      ))}
    </div>
  );
}
```

## Event Data Structures

### order:created
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

### order:cancelled
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

### order:fulfilled
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

## Troubleshooting

### Connection Fails
- Check JWT token is valid
- Verify server URL is correct
- Check CORS settings

### Not Receiving Events
- Verify you joined the correct room
- Check event listeners are set up before events occur
- Confirm orders are being created/cancelled/fulfilled

### Multiple Connections
- Use a single socket instance per app
- Store in context/state management
- Reuse across components

## Best Practices

1. **Single Socket Instance** - Create one socket per app, not per component
2. **Clean Up** - Always disconnect and leave rooms when unmounting
3. **Error Handling** - Handle connection errors gracefully
4. **Reconnection** - Implement automatic reconnection logic
5. **State Sync** - Fetch initial data via REST, then use WebSocket for updates

## Full Documentation

See `WEBSOCKET_ORDER_INTEGRATION.md` for complete documentation.
