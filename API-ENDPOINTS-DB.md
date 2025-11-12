# Database-Optimized Auction Endpoints

These endpoints fetch auction data directly from the database instead of making blockchain calls, providing faster response times for frontend card displays.

## Endpoints

### 1. Get All Active Auctions (Database)

**Endpoint:** `GET /api/auctions/active/db`

**Description:** Fetches all active auctions from the database with formatted data ready for frontend cards.

**Query Parameters:**
- `limit` (optional): Number of auctions to return (default: 50, max: 100)
- `offset` (optional): Pagination offset (default: 0)

**Response Format:**
```json
{
  "success": true,
  "auctions": [
    {
      "id": 77,
      "sellerName": "Abhi Kumar",
      "twitterId": "AbhiKum9635317",
      "title": "test",
      "profilePicture": "https://pbs.twimg.com/profile_images/...",
      "eventDate": "2025-11-09T00:00:00.000Z",
      "eventStartTime": "2025-11-09T04:30:00.000Z",
      "eventEndTime": "2025-11-09T05:30:00.000Z",
      "price": "0.050",
      "priceLabel": "Highest Bid",
      "priceRaw": "50000000000000000",
      "timeLeft": "13h 23m",
      "timeLeftSeconds": 48180,
      "blocksRemaining": 24090,
      "badge": "HOT",
      "hasHighestBid": true,
      "highestBidder": "0x61Ce0aFC9FDeF4b3248dcbaCEb69373037c8A98a",
      "ended": false,
      "createdAt": "2025-11-07T21:59:18.000Z"
    }
  ],
  "total": 8,
  "offset": 0,
  "limit": 50
}
```

**Card Display Logic:**
- **Badge**: 
  - `"LIVE"` = No bids yet (shows floor price)
  - `"HOT"` = Has bids (shows highest bid)
- **Price Display**:
  - If `hasHighestBid === true`: Shows highest bid with label "Highest Bid"
  - If `hasHighestBid === false`: Shows floor price with label "Floor Price"
- **Time Left**: Formatted as "Xh Ym" or "Ym" if less than 1 hour

---

### 2. Get Single Auction by ID (Database)

**Endpoint:** `GET /api/auctions/db/:auctionId`

**Description:** Fetches a specific auction by ID from the database with all details.

**URL Parameters:**
- `auctionId` (required): The auction ID

**Response Format:**
```json
{
  "success": true,
  "auction": {
    "id": 77,
    "contractAddress": "0x6fD65aE833C9679cBC571581CE0f5Cd73D565796",
    "creatorParaId": "para_user_123",
    "creatorWallet": "0x0cb9d7191c9dd544a9994dce38211bfb7097307e",
    "creatorName": "John Doe",
    "authType": "oauth",
    "oAuthMethod": "twitter",
    "sellerName": "Abhi Kumar",
    "twitterId": "AbhiKum9635317",
    "title": "test",
    "description": "Test auction description",
    "profilePicture": "https://pbs.twimg.com/profile_images/...",
    "eventDate": "2025-11-09T00:00:00.000Z",
    "eventStartTime": "2025-11-09T04:30:00.000Z",
    "eventEndTime": "2025-11-09T05:30:00.000Z",
    "meetingDuration": 60,
    "price": "0.050",
    "priceLabel": "Highest Bid",
    "priceRaw": "50000000000000000",
    "floorPrice": "10000000000000000",
    "highestBid": "50000000000000000",
    "highestBidder": "0x61Ce0aFC9FDeF4b3248dcbaCEb69373037c8A98a",
    "timeLeft": "13h 23m",
    "timeLeftSeconds": 48180,
    "blocksRemaining": 24090,
    "endBlock": 47569592,
    "durationBlocks": 60,
    "badge": "HOT",
    "hasHighestBid": true,
    "ended": false,
    "autoEnded": false,
    "nftTokenId": null,
    "jitsiRoomId": null,
    "metadataIpfs": "Qmtest20251109",
    "createdAt": "2025-11-07T21:59:18.000Z",
    "updatedAt": "2025-11-08T10:25:30.000Z"
  }
}
```

---

## Key Features

### 1. **Floor Price vs Highest Bid Logic**
The endpoints automatically determine which price to display:
- If `highest_bid` is `0` or `null` or `highest_bidder` is zero address → Show `bid_price` (floor price)
- If `highest_bid` exists and has a valid bidder → Show `highest_bid`

### 2. **Badge System**
- `LIVE`: Auction is active but has no bids yet
- `HOT`: Auction has received bids

### 3. **Time Formatting**
- Automatically converts `time_remaining_seconds` to human-readable format
- Format: "Xh Ym" for hours and minutes, or "Ym" for minutes only

### 4. **Price Conversion**
- Automatically converts wei values to token amounts (divides by 1e18)
- Formatted to 3 decimal places for display

---

## Performance Benefits

✅ **No blockchain calls** - All data from database  
✅ **Fast response times** - Typical response < 50ms  
✅ **Reduced RPC usage** - No external API calls  
✅ **Real-time updates** - Data updated every 10 seconds by cron job  

---

## Usage Example (Frontend)

```javascript
// Fetch all active auctions for cards
const response = await fetch('http://localhost:5009/api/auctions/active/db?limit=20');
const data = await response.json();

data.auctions.forEach(auction => {
  // Display card with:
  // - auction.profilePicture (image)
  // - auction.sellerName (name)
  // - auction.title (title)
  // - auction.eventStartTime (date/time)
  // - auction.price (price with auction.priceLabel)
  // - auction.timeLeft (countdown)
  // - auction.badge (LIVE or HOT badge)
});

// Fetch specific auction details
const auctionResponse = await fetch('http://localhost:5009/api/auctions/db/77');
const auctionData = await auctionResponse.json();
console.log(auctionData.auction);
```

---

## Error Responses

**400 Bad Request:**
```json
{
  "error": "Invalid auction ID"
}
```

**404 Not Found:**
```json
{
  "error": "Auction not found"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Failed to fetch auctions",
  "message": "Database connection error"
}
```
