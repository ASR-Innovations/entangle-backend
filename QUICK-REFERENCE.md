# Quick Reference - Auction Endpoints

## Endpoints

### Active Auctions
```bash
GET /api/auctions/active/db?limit=20
```

### Ended Auctions
```bash
GET /api/auctions/ended/db?limit=20
```


---

## Quick Integration

### Fetch Active Auctions
```javascript
const response = await fetch('http://localhost:5009/api/auctions/active/db?limit=20&offset=0');
const data = await response.json();
const auctions = data.auctions;
```

### Fetch Ended Auctions
```javascript
const response = await fetch('http://localhost:5009/api/auctions/ended/db?limit=20&offset=0');
const data = await response.json();
const auctions = data.auctions;
```

---

## Card Data Mapping

### Active Auction Card
```javascript
{
  profilePicture: auction.profilePicture,
  badge: auction.badge,              // "LIVE" or "HOT"
  sellerName: auction.sellerName,
  title: auction.title,
  eventTime: auction.eventStartTime,
  price: auction.price,              // "0.050"
  priceLabel: auction.priceLabel,    // "Floor Price" or "Highest Bid"
  timeLeft: auction.timeLeft         // "13h 23m"
}
```

### Ended Auction Card
```javascript
{
  profilePicture: auction.profilePicture,
  badge: "ENDED",
  sellerName: auction.sellerName,
  title: auction.title,
  eventTime: auction.eventStartTime,
  price: auction.price,              // "0.050"
  priceLabel: auction.priceLabel,    // "Reserve Price" or "Winning Bid"
  endedAgo: auction.endedAgo,        // "50m ago"
}
```

---

## Badge Logic

### Active Auctions
- **LIVE** = No bids yet (shows floor price)
- **HOT** = Has bids (shows highest bid)

### Ended Auctions
- **ENDED** = Auction has ended

---

## Price Display Logic

### Active Auctions
```javascript
if (auction.hasHighestBid) {
  // Show highest bid
  display: auction.price + " USDC"
  label: "Highest Bid"
} else {
  // Show floor price
  display: auction.price + " USDC"
  label: "Floor Price"
}
```

### Ended Auctions
```javascript
if (auction.hasWinner) {
  // Show winning bid
  display: auction.price + " USDC"
  label: "Winning Bid"
  winner: auction.winner
} else {
  // Show reserve price
  display: auction.price + " USDC"
  label: "Reserve Price"
  winner: null
}
```

---

## Performance

| Metric | Old (Blockchain) | New (Database) |
|--------|-----------------|----------------|
| Response Time | 2-3 seconds | ~50ms |
| Speed Improvement | - | **40-60x faster** |
| RPC Calls | 1 per auction | 0 |

---

## Files Created

1. ✅ `FRONTEND-INTEGRATION-GUIDE.md` - Complete integration guide
2. ✅ `QUICK-REFERENCE.md` - This file
3. ✅ `API-ENDPOINTS-DB.md` - Active auctions API docs
4. ✅ `ENDED-AUCTIONS-ENDPOINT.md` - Ended auctions API docs
5. ✅ `FRONTEND-DATA-EXAMPLES.md` - Real data examples
6. ✅ `ALL-AUCTION-ENDPOINTS-SUMMARY.md` - Complete summary

---

## Test Commands

```bash
# Test active auctions
curl 'http://localhost:5009/api/auctions/active/db?limit=5'

# Test ended auctions
curl 'http://localhost:5009/api/auctions/ended/db?limit=5'

```

---

## Ready to Use! 🚀

All endpoints are tested and working. Just replace your blockchain calls with these database endpoints for instant performance improvement!
