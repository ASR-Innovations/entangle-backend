# Order API Quick Reference

## Base URL
```
http://localhost:5000/api/orders
```

## Authentication
Protected endpoints require JWT token in Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### Create Listing
```http
POST /api/orders/listings/create
Authorization: Bearer <token>
Content-Type: application/json

{
  "orderHash": "0x...",
  "orderType": "listing",
  "nftContract": "0x...",
  "tokenId": "123",
  "maker": "0x...",
  "paymentToken": "0x...",
  "price": "1000000000000000000",
  "startTime": 1234567890,
  "endTime": 1234567890,
  "orderComponents": { ... },
  "signature": "0x..."
}
```

### Create Offer
```http
POST /api/orders/offers/create
Authorization: Bearer <token>
Content-Type: application/json

{
  "orderHash": "0x...",
  "orderType": "offer",
  "nftContract": "0x...",
  "tokenId": "123",
  "maker": "0x...",
  "paymentToken": "0x...",
  "price": "1000000000000000000",
  "startTime": 1234567890,
  "endTime": 1234567890,
  "orderComponents": { ... },
  "signature": "0x..."
}
```

### Get Listing for Token
```http
GET /api/orders/listings/:tokenId?nftContract=0x...
```

### Get Offers for Token
```http
GET /api/orders/offers/:tokenId?nftContract=0x...&limit=50&offset=0&sort=price_desc
```

### Get User's Listings
```http
GET /api/orders/user/listings
Authorization: Bearer <token>
```

### Get User's Offers
```http
GET /api/orders/user/offers
Authorization: Bearer <token>
```

### Cancel Order
```http
DELETE /api/orders/:orderHash/cancel
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "Changed my mind",
  "transactionHash": "0x..."
}
```

### Record Fulfillment
```http
POST /api/orders/:orderHash/fulfill
Authorization: Bearer <token>
Content-Type: application/json

{
  "fulfiller": "0x...",
  "transactionHash": "0x...",
  "blockNumber": 12345678,
  "amountPaid": "1000000000000000000",
  "platformFeePaid": "25000000000000000"
}
```

### Get Marketplace Orders
```http
GET /api/orders/marketplace?limit=50&offset=0&orderType=listing&sortBy=price&sortOrder=DESC
```

### Get Order by Hash
```http
GET /api/orders/:orderHash
```

## Response Format

### Success Response
```json
{
  "success": true,
  "order": { ... },
  "message": "Operation successful"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error type",
  "details": "Detailed error message"
}
```

## Query Parameters

### Pagination
- `limit`: Number of results (1-100, default: 50)
- `offset`: Starting position (default: 0)

### Sorting
- `sort`: For offers - `price_asc`, `price_desc`, `recent`
- `sortBy`: For marketplace - `created_at`, `price`, `expires_at`
- `sortOrder`: `ASC` or `DESC`

### Filtering
- `orderType`: `listing` or `offer`
- `nftContract`: Ethereum address

## WebSocket Events

Listen for real-time updates:

```javascript
socket.on('order:created', (data) => {
  console.log('New order:', data);
});

socket.on('order:cancelled', (data) => {
  console.log('Order cancelled:', data);
});

socket.on('order:fulfilled', (data) => {
  console.log('Order fulfilled:', data);
});
```

## Example: Complete Order Flow

### 1. Create a Listing
```bash
curl -X POST http://localhost:5000/api/orders/listings/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "orderHash": "0x1234...",
    "orderType": "listing",
    "nftContract": "0xNFT_CONTRACT",
    "tokenId": "1",
    "maker": "0xMAKER_ADDRESS",
    "paymentToken": "0xTOKEN_ADDRESS",
    "price": "1000000000000000000",
    "startTime": 1700000000,
    "endTime": 1700086400,
    "orderComponents": {...},
    "signature": "0xSIGNATURE"
  }'
```

### 2. View the Listing
```bash
curl http://localhost:5000/api/orders/listings/1?nftContract=0xNFT_CONTRACT
```

### 3. Cancel the Listing
```bash
curl -X DELETE http://localhost:5000/api/orders/0x1234.../cancel \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "No longer selling"}'
```

## Status Codes

- `200 OK`: Successful GET/DELETE/POST
- `201 Created`: Successful order creation
- `400 Bad Request`: Validation error
- `401 Unauthorized`: Missing/invalid token
- `403 Forbidden`: Not authorized
- `404 Not Found`: Resource not found
- `409 Conflict`: Duplicate or invalid state
- `500 Internal Server Error`: Server error
