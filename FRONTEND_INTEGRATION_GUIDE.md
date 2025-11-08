# Frontend Integration Guide - Approach 1 (Database Cache)

## ✅ Backend Implementation Status: **FULLY COMPLETE**

All backend components are implemented and ready:
- ✅ Database schema updated with cache columns
- ✅ Cron job updating cache every 10 seconds
- ✅ API endpoint optimized to use cached data
- ✅ Migration script ready for existing databases

---

## 🎯 What Changed for Frontend

### Before (Old Approach - SLOW)
```javascript
// Frontend was querying blockchain directly
for (let i = 1; i <= 100; i++) {
  const auction = await contract.getAuction(i); // 600ms each = 60 seconds total
}
```

### After (New Approach - FAST)
```javascript
// Frontend now calls API endpoint
const response = await fetch('/api/auctions/active');
const data = await response.json(); // ~100ms total!
```

---

## 📡 API Endpoint Details

### Endpoint
```
GET /api/auctions/active
```

### Query Parameters
- `limit` (optional): Number of auctions to return (default: 50, max: 100)
- `offset` (optional): Pagination offset (default: 0)

### Example Request
```javascript
// Basic request
fetch('http://your-backend-url/api/auctions/active')

// With pagination
fetch('http://your-backend-url/api/auctions/active?limit=20&offset=0')
```

---

## 📦 API Response Format

### Success Response (200 OK)
```json
{
  "success": true,
  "auctions": [
    {
      "id": 1,
      "title": "Meeting with CEO",
      "description": "One-on-one meeting opportunity",
      "creatorParaId": "user_123",
      "creatorWallet": "0x1234567890abcdef...",
      "creatorName": "John Doe",
      "authType": "email",
      "oAuthMethod": "google",
      "meetingDuration": 60,
      
      // ⭐ NEW: Cached data (updated every 10 seconds)
      "highestBid": 5.5,                    // Current highest bid in AVAX
      "highestBidder": "0xabcdef...",      // Wallet of highest bidder (or null)
      "endBlock": 15000100,                // Block number when auction ends
      "currentBlock": 15000000,            // Latest block at update time
      "timeRemainingSeconds": 250,         // ⭐ Calculated time remaining
      "lastUpdated": "2024-01-15T10:00:00Z", // When cache was last updated
      
      // Existing fields
      "nftTokenId": null,
      "createdAt": "2024-01-15T09:00:00Z",
      
      // Metadata
      "cacheStatus": "cached",             // "cached" or "pending"
      "cacheAge": 5                        // Seconds since last update
    }
  ],
  "total": 50,
  "offset": 0,
  "limit": 50,
  "performance": {
    "queryTimeMs": 45,
    "totalTimeMs": 52,
    "cacheStatus": "active",
    "note": "Data cached in database, updated every 10 seconds by cron job"
  }
}
```

### Error Response (500)
```json
{
  "error": "Failed to fetch auctions",
  "message": "Error details (only in development)"
}
```

---

## 💻 Frontend Integration Code

### React/Next.js Example

```javascript
import { useState, useEffect } from 'react';

function ActiveAuctions() {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchActiveAuctions();
    
    // Optional: Refresh every 30 seconds to get updated time
    const interval = setInterval(fetchActiveAuctions, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchActiveAuctions = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://your-backend-url/api/auctions/active?limit=50');
      const data = await response.json();
      
      if (data.success) {
        setAuctions(data.auctions);
        console.log(`✅ Loaded ${data.auctions.length} auctions in ${data.performance.totalTimeMs}ms`);
      } else {
        setError('Failed to fetch auctions');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Format time remaining
  const formatTimeRemaining = (seconds) => {
    if (!seconds || seconds <= 0) return 'Ended';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  if (loading) return <div>Loading auctions...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h2>Active Auctions</h2>
      {auctions.map(auction => (
        <div key={auction.id} className="auction-card">
          <h3>{auction.title}</h3>
          <p>{auction.description}</p>
          
          {/* ⭐ NEW: Display cached price */}
          <div className="price">
            <strong>Current Bid:</strong> {auction.highestBid} AVAX
            {auction.highestBidder && (
              <span className="bidder">by {auction.highestBidder.slice(0, 6)}...</span>
            )}
          </div>
          
          {/* ⭐ NEW: Display time remaining with countdown */}
          <div className="time-remaining">
            <strong>Time Remaining:</strong> {formatTimeRemaining(auction.timeRemainingSeconds)}
          </div>
          
          {/* Cache status indicator */}
          {auction.cacheStatus === 'cached' && (
            <small className="cache-info">
              Updated {auction.cacheAge}s ago
            </small>
          )}
        </div>
      ))}
    </div>
  );
}
```

### Vue.js Example

```vue
<template>
  <div>
    <h2>Active Auctions</h2>
    <div v-if="loading">Loading...</div>
    <div v-else-if="error">Error: {{ error }}</div>
    <div v-else>
      <div v-for="auction in auctions" :key="auction.id" class="auction-card">
        <h3>{{ auction.title }}</h3>
        <p>{{ auction.description }}</p>
        
        <!-- ⭐ NEW: Display cached price -->
        <div class="price">
          <strong>Current Bid:</strong> {{ auction.highestBid }} AVAX
          <span v-if="auction.highestBidder" class="bidder">
            by {{ auction.highestBidder.slice(0, 6) }}...
          </span>
        </div>
        
        <!-- ⭐ NEW: Display time remaining -->
        <div class="time-remaining">
          <strong>Time Remaining:</strong> {{ formatTime(auction.timeRemainingSeconds) }}
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      auctions: [],
      loading: true,
      error: null
    };
  },
  mounted() {
    this.fetchAuctions();
    // Refresh every 30 seconds
    setInterval(this.fetchAuctions, 30000);
  },
  methods: {
    async fetchAuctions() {
      try {
        this.loading = true;
        const response = await fetch('http://your-backend-url/api/auctions/active?limit=50');
        const data = await response.json();
        
        if (data.success) {
          this.auctions = data.auctions;
          console.log(`✅ Loaded ${data.auctions.length} auctions`);
        }
      } catch (err) {
        this.error = err.message;
      } finally {
        this.loading = false;
      }
    },
    formatTime(seconds) {
      if (!seconds || seconds <= 0) return 'Ended';
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      return hours > 0 
        ? `${hours}h ${minutes}m ${secs}s`
        : `${minutes}m ${secs}s`;
    }
  }
};
</script>
```

### Vanilla JavaScript Example

```javascript
// Fetch active auctions
async function fetchActiveAuctions() {
  try {
    const response = await fetch('http://your-backend-url/api/auctions/active?limit=50');
    const data = await response.json();
    
    if (data.success) {
      console.log(`✅ Loaded ${data.auctions.length} auctions in ${data.performance.totalTimeMs}ms`);
      displayAuctions(data.auctions);
    }
  } catch (error) {
    console.error('Failed to fetch auctions:', error);
  }
}

// Display auctions
function displayAuctions(auctions) {
  const container = document.getElementById('auctions-container');
  container.innerHTML = auctions.map(auction => `
    <div class="auction-card">
      <h3>${auction.title}</h3>
      <p>${auction.description}</p>
      
      <!-- ⭐ NEW: Display cached price -->
      <div class="price">
        <strong>Current Bid:</strong> ${auction.highestBid} AVAX
        ${auction.highestBidder ? `<span>by ${auction.highestBidder.slice(0, 6)}...</span>` : ''}
      </div>
      
      <!-- ⭐ NEW: Display time remaining -->
      <div class="time-remaining">
        <strong>Time Remaining:</strong> ${formatTime(auction.timeRemainingSeconds)}
      </div>
    </div>
  `).join('');
}

// Format time helper
function formatTime(seconds) {
  if (!seconds || seconds <= 0) return 'Ended';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return hours > 0 ? `${hours}h ${minutes}m ${secs}s` : `${minutes}m ${secs}s`;
}

// Fetch on page load and refresh every 30 seconds
fetchActiveAuctions();
setInterval(fetchActiveAuctions, 30000);
```

---

## ⏱️ Real-Time Countdown Implementation

Since `timeRemainingSeconds` is updated every 10 seconds, you can implement a client-side countdown:

```javascript
function AuctionCard({ auction }) {
  const [timeRemaining, setTimeRemaining] = useState(auction.timeRemainingSeconds);

  useEffect(() => {
    // Start countdown from cached value
    setTimeRemaining(auction.timeRemainingSeconds);
    
    // Update every second
    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        const newTime = prev - 1;
        return newTime > 0 ? newTime : 0;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [auction.timeRemainingSeconds]); // Reset when auction data updates

  return (
    <div>
      <div>Time Remaining: {formatTime(timeRemaining)}</div>
      {timeRemaining <= 0 && <div>Auction Ended</div>}
    </div>
  );
}
```

---

## 🔄 Migration from Old Code

### Step 1: Remove Blockchain Queries
**Remove this:**
```javascript
// ❌ OLD: Direct blockchain queries (SLOW)
const contract = new ethers.Contract(...);
for (let i = 1; i <= 100; i++) {
  const auction = await contract.getAuction(i);
  // Process auction...
}
```

### Step 2: Replace with API Call
**Use this:**
```javascript
// ✅ NEW: API call (FAST)
const response = await fetch('/api/auctions/active');
const data = await response.json();
const auctions = data.auctions;
```

### Step 3: Update Data Access
**Old fields might have been:**
```javascript
// ❌ OLD
auction.highestBid.toString() // Was in wei
auction.endBlock - currentBlock // Had to calculate
```

**New fields are ready to use:**
```javascript
// ✅ NEW
auction.highestBid // Already in AVAX (number)
auction.timeRemainingSeconds // Already calculated
```

---

## 📊 Key Fields to Use

### Essential Fields
- `highestBid` (number) - Current highest bid in AVAX
- `highestBidder` (string|null) - Wallet address of highest bidder
- `timeRemainingSeconds` (number) - Time remaining in seconds

### Display Fields
- `title` - Auction title
- `description` - Auction description
- `creatorName` - Creator's display name
- `meetingDuration` - Meeting duration in minutes

### Metadata Fields
- `cacheStatus` - "cached" or "pending"
- `cacheAge` - Seconds since last update
- `lastUpdated` - ISO timestamp of last update

---

## 🎨 UI Recommendations

### Display Price
```jsx
<div className="price-display">
  <span className="label">Current Bid:</span>
  <span className="amount">{auction.highestBid} AVAX</span>
  {auction.highestBidder && (
    <span className="bidder">by {shortenAddress(auction.highestBidder)}</span>
  )}
</div>
```

### Display Countdown
```jsx
<div className="countdown">
  <span className="label">Time Remaining:</span>
  <span className="time">{formatTime(auction.timeRemainingSeconds)}</span>
  {auction.cacheAge && auction.cacheAge < 15 && (
    <span className="badge">Live</span>
  )}
</div>
```

### Cache Status Indicator
```jsx
{auction.cacheStatus === 'cached' && (
  <small className="cache-indicator">
    Updated {auction.cacheAge}s ago
  </small>
)}
```

---

## ⚠️ Important Notes

1. **Cache Update Frequency**: Data is updated every 10 seconds. Price changes may take up to 10 seconds to appear.

2. **Time Countdown**: Use `timeRemainingSeconds` as starting point, then countdown client-side for smooth UX.

3. **Refresh Strategy**: 
   - Initial load: Call API once
   - Updates: Refresh every 30-60 seconds to sync with backend
   - Countdown: Update client-side every second

4. **Error Handling**: Always handle cases where `highestBid` might be 0 or `highestBidder` might be null.

5. **Performance**: API response is now ~100ms (was ~60 seconds). No need for loading spinners for long periods!

---

## ✅ Testing Checklist

- [ ] API endpoint returns data quickly (< 200ms)
- [ ] `highestBid` displays correctly (in AVAX, not wei)
- [ ] `timeRemainingSeconds` is used for countdown
- [ ] Countdown updates smoothly
- [ ] Price updates appear within 10-15 seconds
- [ ] Pagination works with `limit` and `offset`
- [ ] Error handling works for failed requests

---

## 🚀 Quick Start

1. **Update your API endpoint URL** in frontend code
2. **Replace blockchain queries** with API call
3. **Use new fields**: `highestBid`, `timeRemainingSeconds`, `highestBidder`
4. **Implement countdown** using `timeRemainingSeconds`
5. **Test and verify** performance improvement

---

**Backend is ready!** Just update your frontend to use the new API endpoint. 🎉
