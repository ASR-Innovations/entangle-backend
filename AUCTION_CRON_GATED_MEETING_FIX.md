# Auction Cron Gated Meeting Fix

## Problem Identified

The auction cron was creating meetings but **NOT using NFT gating**. 

### What Was Wrong:

❌ **Before:** `AuctionCronService` called `JitsiService.createAuctionMeeting()`
- Created basic Jitsi meeting
- No NFT gating
- No Lit Protocol integration
- No access control policy

✅ **After:** `AuctionCronService` now calls `MeetingService.createGatedMeeting()`
- Creates NFT-gated meeting
- Includes Lit Protocol integration
- Stores NFT access policy in database
- Enables token-based access control

## Changes Made

### 1. AuctionCronService.js

**Import Changed:**
```javascript
// OLD:
const { getJitsiService } = require('./JitsiService');

// NEW:
const { getMeetingService } = require('./MeetingService');
```

**createMeetingForAuction() Method Updated:**
- Now validates NFT token ID exists
- Calls `MeetingService.createGatedMeeting()` instead of `JitsiService.createAuctionMeeting()`
- Passes NFT contract address (the auction contract itself)
- Passes NFT token ID minted when auction ended
- Links meeting to auction via `auctionId` parameter

**Key Features:**
- ✅ NFT-gated access control
- ✅ Stores policy in database
- ✅ Links meeting to auction
- ✅ Logs NFT contract and token ID

### 2. MeetingService.js

**Added Optional Parameter:**
```javascript
async createGatedMeeting({ 
  hostUser, 
  nftContract, 
  nftTokenId, 
  meetingName,
  duration = 60,
  windowStart = null,
  windowEnd = null,
  auctionId = null  // NEW: Optional auction ID
}) {
```

**Database Schema Fix (ALL Methods Updated):**

1. **createGatedMeeting():**
   - Now uses actual database schema (meetings table)
   - Stores NFT info in `jitsi_room_config` as JSON
   - Uses `auction_id` field for auction-created meetings
   - Sets `auction_id = 0` for manually created gated meetings
   - Meeting Config Structure:
     ```javascript
     const roomConfig = {
       ...room.config,
       nftContract,      // NFT contract address
       nftTokenId,       // NFT token ID
       policy,           // Access policy
       gated: true       // Flag for gated meeting
     };
     ```

2. **createSimpleMeeting():**
   - Fixed to use actual schema fields
   - Stores tokens in `creator_access_token` and `winner_access_token`
   - Uses `jitsi_room_id` instead of `room_id`
   - Config Structure:
     ```javascript
     const roomConfig = {
       ...room.config,
       gated: false,
       hostUserId: hostUser.id,
       guestUserId: guestUser.id
     };
     ```

3. **joinGatedMeeting():**
   - Fixed query to use `jitsi_room_id` instead of `room_id`
   - Reads NFT info from `jitsi_room_config` JSON:
     ```javascript
     const roomConfig = JSON.parse(meeting.jitsi_room_config);
     const nftContract = roomConfig.nftContract;
     const nftTokenId = roomConfig.nftTokenId;
     const policy = roomConfig.policy;
     ```

### 3. Database Updates

**updateAuctionInDatabase() Simplified:**
- Removed duplicate meeting insertion
- MeetingService already stores meeting in database
- Only updates auction table with NFT and room info

## How It Works Now

### Complete Auction → Meeting Flow:

1. **Auction Ends** (via cron)
   - Cron detects ended auction
   - Calls `endAuction()` on blockchain
   - NFT is minted to winner

2. **Get NFT Data**
   - Retrieves auction with `nftTokenId`
   - Gets creator and winner user data

3. **Create NFT-Gated Meeting**
   ```javascript
   await meetingService.createGatedMeeting({
     hostUser: creatorData,
     nftContract: contractAddress,  // Auction contract
     nftTokenId: nftTokenId,         // Minted NFT ID
     auctionId: auctionId,           // Link to auction
     ...
   });
   ```

4. **Meeting Stored with Policy**
   - Meeting row created in database
   - NFT contract + token ID in config
   - Policy stored for access verification
   - Linked to auction via `auction_id`

5. **Access Control** (when user tries to join)
   - Lit Protocol verifies NFT ownership
   - Only NFT holder (winner) can access
   - Host has moderator access

## Testing Checklist

- [ ] Start server and wait for cron (runs every 2 minutes)
- [ ] Create and end an auction with a winner
- [ ] Verify NFT is minted
- [ ] Check that gated meeting is created
- [ ] Verify meeting is stored in database with:
  - `auction_id` set correctly
  - `jitsi_room_config` contains NFT info
  - `gated: true` flag set
- [ ] Test winner can access meeting (NFT verification)
- [ ] Test non-winner cannot access meeting

## Key Differences

| Feature | Old (JitsiService) | New (MeetingService) |
|---------|-------------------|---------------------|
| NFT Gating | ❌ No | ✅ Yes |
| Lit Protocol | ❌ No | ✅ Yes |
| Access Policy | ❌ No | ✅ Stored in DB |
| Database Storage | ❌ Manual | ✅ Automatic |
| Auction Link | ✅ Yes | ✅ Yes |
| Token Verification | ❌ No | ✅ Yes |

## Files Modified

1. `/backend/src/services/AuctionCronService.js`
   - Import changed to MeetingService
   - createMeetingForAuction() rewritten
   - updateAuctionInDatabase() simplified

2. `/backend/src/services/MeetingService.js`
   - Added `auctionId` parameter
   - Fixed database schema usage
   - Stores NFT info in room config

## Related Endpoints

**Meeting Access (NFT Verification):**
- `POST /api/meetings/:roomId/access` - Verify NFT and get access token
- Uses Lit Protocol to verify NFT ownership
- Returns meeting access token if valid

**Manual Gated Meeting Creation:**
- `POST /api/meetings/create-gated` - Create gated meeting manually
- Now compatible with auction-created meetings
- Uses same `createGatedMeeting()` method

## Notes

- Auction contract IS the NFT contract (it mints NFTs)
- NFT token ID is available after `endAuction()` transaction
- Meeting policy stored in `jitsi_room_config` JSON field
- Winner must own NFT to access meeting
- Host always has access (moderator role)

## Next Steps

1. ✅ Fix implemented
2. ⏳ Test with live auction
3. ⏳ Verify NFT gating works
4. ⏳ Test meeting access flow
5. ⏳ Update frontend to handle gated meetings

