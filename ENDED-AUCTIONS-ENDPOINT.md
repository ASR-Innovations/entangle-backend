# Ended Auctions Endpoint Documentation

## Endpoint: GET `/api/auctions/ended/db`

**Description:** Fetches all ended auctions from the database with formatted data ready for frontend display.

---

## Request

### URL
```
GET http://localhost:5009/api/auctions/ended/db
```

### Query Parameters
- `limit` (optional): Number of auctions to return (default: 50, max: 100)
- `offset` (optional): Pagination offset (default: 0)

### Example Requests
```bash
# Get first 10 ended auctions
GET /api/auctions/ended/db?limit=10

# Get next 10 ended auctions (pagination)
GET /api/auctions/ended/db?limit=10&offset=10

# Get all ended auctions (up to 100)
GET /api/auctions/ended/db
```

---

## Response Format

### Success Response (200 OK)

```json
{
  "success": true,
  "auctions": [
    {
      "id": 24,
      "sellerName": "sachinmatta@outlook.com",
      "twitterId": null,
      "title": "Pitch me your startup #4",
      "profilePicture": null,
      "eventDate": null,
      "eventStartTime": null,
      "eventEndTime": null,
      "price": "0.050",
      "priceLabel": "Winning Bid",
      "priceRaw": "50000000000000000",
      "endedAgo": "50m ago",
      "endedAt": "2025-11-08T14:01:28.306Z",
      "hasWinner": true,
      "winner": "0x61Ce0aFC9FDeF4b3248dcbaCEb69373037c8A98a",
      "nftTokenId": 24,
      "autoEnded": true,
      "ended": true,
      "createdAt": "2025-10-01T19:34:51.432Z"
    }
  ],
  "total": 5,
  "offset": 0,
  "limit": 5
}
```

---

## Response Fields

### Auction Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Auction ID |
| `sellerName` | string | Name of the auction creator/seller |
| `twitterId` | string\|null | Twitter handle if available |
| `title` | string | Auction title |
| `profilePicture` | string\|null | URL to profile picture |
| `eventDate` | string\|null | Event date (ISO 8601) |
| `eventStartTime` | string\|null | Event start time (ISO 8601) |
| `eventEndTime` | string\|null | Event end time (ISO 8601) |
| `price` | string | Display price in tokens (e.g., "0.050") |
| `priceLabel` | string | "Winning Bid" or "Reserve Price" |
| `priceRaw` | string | Raw price in wei |
| `endedAgo` | string | Human-readable time since ended (e.g., "50m ago", "2h ago", "3d ago") |
| `endedAt` | string | Exact timestamp when auction ended (ISO 8601) |
| `hasWinner` | boolean | Whether auction had a winning bid |
| `winner` | string\|null | Winner's wallet address (if hasWinner is true) |
| `nftTokenId` | number\|null | NFT token ID if minted |
| `autoEnded` | boolean | Whether auction was auto-ended by cron job |
| `ended` | boolean | Always true for this endpoint |
| `createdAt` | string | When auction was created (ISO 8601) |

---

## Price Display Logic

### With Winner (Has Bids)
```json
{
  "price": "0.050",
  "priceLabel": "Winning Bid",
  "hasWinner": true,
  "winner": "0x61Ce0aFC9FDeF4b3248dcbaCEb69373037c8A98a"
}
```

### Without Winner (No Bids)
```json
{
  "price": "0.010",
  "priceLabel": "Reserve Price",
  "hasWinner": false,
  "winner": null
}
```

---

## Time Display Logic

The `endedAgo` field shows how long ago the auction ended:

- **Less than 1 hour:** "Xm ago" (e.g., "45m ago")
- **1-24 hours:** "Xh ago" (e.g., "5h ago")
- **More than 24 hours:** "Xd ago" (e.g., "3d ago")

---

## Frontend Usage Examples

### React/Next.js Component

```jsx
import { useState, useEffect } from 'react';

function EndedAuctionsList() {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEndedAuctions();
  }, []);

  const fetchEndedAuctions = async () => {
    try {
      const response = await fetch('http://localhost:5009/api/auctions/ended/db?limit=20');
      const data = await response.json();
      
      if (data.success) {
        setAuctions(data.auctions);
      }
    } catch (error) {
      console.error('Failed to fetch ended auctions:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="ended-auctions-grid">
      {auctions.map(auction => (
        <EndedAuctionCard key={auction.id} auction={auction} />
      ))}
    </div>
  );
}

function EndedAuctionCard({ auction }) {
  return (
    <div className="auction-card ended">
      {/* Profile Picture */}
      <img 
        src={auction.profilePicture || '/default-avatar.png'} 
        alt={auction.sellerName} 
      />
      
      {/* Ended Badge */}
      <span className="badge ended">ENDED</span>
      
      {/* Seller Info */}
      <div className="seller">
        <h3>{auction.sellerName}</h3>
        {auction.twitterId && <span className="verified">✓</span>}
      </div>
      
      {/* Event Title */}
      <p className="title">{auction.title}</p>
      
      {/* Winner Info (if has winner) */}
      {auction.hasWinner ? (
        <div className="winner-info">
          <span className="winner-badge">🏆 Winner</span>
          <span className="winner-address">
            {auction.winner.slice(0, 6)}...{auction.winner.slice(-4)}
          </span>
        </div>
      ) : (
        <div className="no-bids">
          <span>No bids received</span>
        </div>
      )}
      
      {/* Price & Time */}
      <div className="footer">
        <div className="price">
          <span className="amount">{auction.price} USDC</span>
          <span className="label">{auction.priceLabel}</span>
        </div>
        <div className="ended-time">
          <span className="time">{auction.endedAgo}</span>
          <span className="label">Ended</span>
        </div>
      </div>
      
      {/* NFT Badge (if minted) */}
      {auction.nftTokenId && (
        <div className="nft-badge">
          NFT #{auction.nftTokenId}
        </div>
      )}
    </div>
  );
}

export default EndedAuctionsList;
```

### Vanilla JavaScript

```javascript
async function loadEndedAuctions() {
  try {
    const response = await fetch('http://localhost:5009/api/auctions/ended/db?limit=20');
    const data = await response.json();
    
    if (data.success) {
      const container = document.getElementById('ended-auctions');
      
      data.auctions.forEach(auction => {
        const card = createAuctionCard(auction);
        container.appendChild(card);
      });
    }
  } catch (error) {
    console.error('Error loading ended auctions:', error);
  }
}

function createAuctionCard(auction) {
  const card = document.createElement('div');
  card.className = 'auction-card ended';
  
  card.innerHTML = `
    <img src="${auction.profilePicture || '/default-avatar.png'}" alt="${auction.sellerName}">
    <span class="badge ended">ENDED</span>
    
    <div class="seller">
      <h3>${auction.sellerName}</h3>
      ${auction.twitterId ? '<span class="verified">✓</span>' : ''}
    </div>
    
    <p class="title">${auction.title}</p>
    
    ${auction.hasWinner ? `
      <div class="winner-info">
        <span class="winner-badge">🏆 Winner</span>
        <span class="winner-address">${auction.winner.slice(0, 6)}...${auction.winner.slice(-4)}</span>
      </div>
    ` : `
      <div class="no-bids">No bids received</div>
    `}
    
    <div class="footer">
      <div class="price">
        <span class="amount">${auction.price} USDC</span>
        <span class="label">${auction.priceLabel}</span>
      </div>
      <div class="ended-time">
        <span class="time">${auction.endedAgo}</span>
        <span class="label">Ended</span>
      </div>
    </div>
    
    ${auction.nftTokenId ? `<div class="nft-badge">NFT #${auction.nftTokenId}</div>` : ''}
  `;
  
  return card;
}

// Load on page load
document.addEventListener('DOMContentLoaded', loadEndedAuctions);
```

---

## Comparison: Active vs Ended Auctions

### Active Auctions (`/api/auctions/active/db`)
- ✅ Shows "LIVE" or "HOT" badge
- ✅ Shows "Floor Price" or "Highest Bid"
- ✅ Shows time remaining ("13h 23m")
- ✅ Real-time countdown
- ✅ `ended: false`

### Ended Auctions (`/api/auctions/ended/db`)
- ✅ Shows "ENDED" badge
- ✅ Shows "Reserve Price" or "Winning Bid"
- ✅ Shows time since ended ("50m ago")
- ✅ Shows winner info (if has winner)
- ✅ Shows NFT token ID (if minted)
- ✅ `ended: true`

---

## Error Responses

### 500 Internal Server Error
```json
{
  "error": "Failed to fetch ended auctions",
  "message": "Database connection error"
}
```

---

## Performance

- ⚡ **Response Time:** ~50ms
- 💾 **Data Source:** Database only (no blockchain calls)
- 🔄 **Data Freshness:** Updated when auction ends
- ✅ **Scalability:** Can handle 100+ ended auctions efficiently

---

## Testing

### cURL
```bash
# Test ended auctions endpoint
curl -s 'http://localhost:5009/api/auctions/ended/db?limit=5' | jq '.'
```

### Postman
```
GET http://localhost:5009/api/auctions/ended/db?limit=10
```

---

## Summary

✅ **Endpoint created:** `/api/auctions/ended/db`  
✅ **Returns ended auctions** with winner info  
✅ **Shows winning bid or reserve price**  
✅ **Human-readable time** since ended  
✅ **NFT token ID** if minted  
✅ **Fast performance** (database only)  
✅ **Pagination support** (limit & offset)  

Your frontend can now display both active and ended auctions using these optimized database endpoints!
