# Complete Meeting Access Flow - Frontend & Backend Integration Guide

## Table of Contents
1. [Overview](#overview)
2. [Auction End Process](#auction-end-process)
3. [Winner/Attendee Flow](#winnerattendee-flow)
4. [Creator/Host Flow](#creatorhost-flow)
5. [Complete API Reference](#complete-api-reference)
6. [Frontend Implementation Examples](#frontend-implementation-examples)
7. [WebSocket Events](#websocket-events)
8. [Error Handling](#error-handling)

---

## Overview

### System Architecture
```
┌──────────────────────────────────────────────────────────────────────┐
│                    AUCTION LIFECYCLE                                  │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                  ┌───────────────────────┐
                  │  Auction Ends         │
                  │  (Cron Job)           │
                  │  - NFT Minted         │
                  │  - DB Updated         │
                  └───────────┬───────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
                ▼                           ▼
    ┌───────────────────────┐   ┌──────────────────────┐
    │   WINNER FLOW         │   │   CREATOR FLOW       │
    │   (Must Burn NFT)     │   │   (No Burn Required) │
    └───────────────────────┘   └──────────────────────┘
```

---

## Auction End Process

### Backend (Automatic - Cron Job)

**Trigger**: Runs every 2 minutes, checks for ended auctions

**Process**:
```javascript
// AuctionCronService.js:123-278
1. Check blockchain for ended auctions
2. Call contract.endAuction(auctionId)
3. NFT minted to winner's wallet
4. Update database:
   - auctions.nft_token_id = <token_id>
   - auctions.auto_ended = TRUE
   - auctions.jitsi_room_id = NULL (no meeting yet)
5. NO MEETING CREATED YET
```

**Database State After Auction Ends**:
```sql
-- auctions table
{
  id: 123,
  creator_wallet: "0xCreator...",
  nft_token_id: 456,
  jitsi_room_id: NULL,
  auto_ended: TRUE
}

-- meetings table
-- NO RECORD YET
```

### Frontend Notification

Both users should be notified when auction ends:

**Endpoint**: `GET /api/auctions/:auctionId`

**Request**:
```javascript
GET /api/auctions/123
Headers: {
  'Authorization': 'Bearer <jwt_token>'
}
```

**Response**:
```json
{
  "success": true,
  "auction": {
    "id": 123,
    "title": "30 Min Strategy Session",
    "creator_wallet": "0xCreator...",
    "creator_para_id": "para-creator-123",
    "creator_name": "John Doe",
    "meeting_duration": 60,
    "nft_token_id": 456,
    "jitsi_room_id": null,
    "auto_ended": true,
    "highestBidder": "0xWinner...",
    "highestBid": "0.5",
    "ended": true
  }
}
```

**Frontend Action**:
```javascript
// Poll or WebSocket to detect auction end
if (auction.ended && auction.nft_token_id) {
  if (userWallet === auction.highestBidder) {
    // Redirect to winner flow
    router.push(`/auction/${auctionId}/winner-access`);
  } else if (userWallet === auction.creator_wallet) {
    // Redirect to creator flow
    router.push(`/auction/${auctionId}/creator-access`);
  }
}
```

---

## Winner/Attendee Flow

### Step 1: Check Access Status

**Purpose**: Determine if winner needs to burn NFT or if meeting already exists

**Endpoint**: `POST /api/meetings/access-winner`

**Request**:
```javascript
POST /api/meetings/access-winner
Headers: {
  'Authorization': 'Bearer <jwt_token>',
  'Content-Type': 'application/json'
}
Body: {
  "auctionId": 123
}
```

**Response - Burn Required**:
```json
{
  "requiresBurn": true,
  "nftTokenId": 456,
  "meetingExists": false,
  "contractAddress": "0x9171Cf8E1d3c7EBf7bf8866CcD2c8C58512A3Be8",
  "message": "You must burn your NFT to access the meeting"
}
```

**Response - Meeting Already Created**:
```json
{
  "requiresBurn": false,
  "meetingExists": true,
  "meeting": {
    "roomId": "auction-123-1697123456789",
    "url": "https://8x8.vc/meeting-app/auction-123-1697123456789?jwt=eyJhbGci...",
    "token": "eyJhbGci...",
    "expiresAt": "2025-10-15T12:00:00.000Z"
  },
  "message": "Meeting already created, you can join now"
}
```

**Possible Errors**:
```json
// Not the winner
{
  "error": "Only the auction winner can access this endpoint"
}

// Auction not found
{
  "error": "Auction not found"
}

// Auction not ended
{
  "error": "Auction has not ended yet"
}

// No NFT minted
{
  "error": "NFT not minted for this auction"
}

// NFT already burned but meeting not created (edge case)
{
  "error": "NFT has already been burned, but meeting was not created. Please contact support."
}
```

### Step 2: Burn NFT (Frontend - Smart Contract Interaction)

**Smart Contract Call**:
```javascript
// Frontend code
import { ethers } from 'ethers';

// Connect to user's wallet
const provider = new ethers.BrowserProvider(window.ethereum);
const signer = await provider.getSigner();

// Contract instance
const contractAddress = "0x9171Cf8E1d3c7EBf7bf8866CcD2c8C58512A3Be8";
const contractABI = [...]; // MeetingAuction ABI
const contract = new ethers.Contract(contractAddress, contractABI, signer);

// Burn NFT
try {
  const nftTokenId = 456; // From Step 1 response

  // Call burn function
  const tx = await contract.burnNFTForAccess(nftTokenId);

  console.log('Burn transaction submitted:', tx.hash);

  // Wait for confirmation
  const receipt = await tx.wait();

  console.log('Burn confirmed! Block:', receipt.blockNumber);

  // Proceed to Step 3 with transaction hash
  return {
    transactionHash: tx.hash,
    blockNumber: receipt.blockNumber
  };

} catch (error) {
  console.error('Burn failed:', error);
  // Handle error (show to user)
}
```

**Expected Smart Contract Event**:
```solidity
event NFTBurnedForMeeting(
  uint256 indexed auctionId,
  address indexed burner,
  uint256 indexed nftTokenId
);
```

### Step 3: Verify Burn & Create Meeting

**Purpose**: Backend verifies burn transaction and creates meeting on-demand

**Endpoint**: `POST /api/meetings/burn-nft-access`

**Request**:
```javascript
POST /api/meetings/burn-nft-access
Headers: {
  'Authorization': 'Bearer <jwt_token>',
  'Content-Type': 'application/json'
}
Body: {
  "auctionId": 123,
  "burnTransactionHash": "0xabc123..."
}
```

**Response - Success**:
```json
{
  "success": true,
  "meeting": {
    "roomId": "auction-123-1697123456789",
    "url": "https://8x8.vc/meeting-app/auction-123-1697123456789?jwt=eyJhbGci...",
    "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InZwYWFzLW1hZ2ljLWNvb2tpZS0xMjM0In0...",
    "expiresAt": "2025-10-15T12:00:00.000Z",
    "duration": 60,
    "role": "participant"
  },
  "message": "Meeting created successfully. You can now join!",
  "nftBurned": true
}
```

**Response - Errors**:
```json
// Invalid transaction
{
  "error": "Transaction not found or failed"
}

// Wrong event in transaction
{
  "error": "No NFTBurnedForMeeting event found in transaction"
}

// Replay attack detected
{
  "error": "This burn transaction has already been used to create a meeting"
}

// Wrong auction
{
  "error": "Burn transaction is for a different auction"
}

// Not the winner
{
  "error": "Only the auction winner can burn NFT for access"
}
```

### Step 4: Join Meeting

**Frontend Action**:
```javascript
// After successful burn verification
const { meeting } = response;

// Option 1: Redirect to Jitsi meeting
window.location.href = meeting.url;

// Option 2: Embed Jitsi in iframe
const iframe = document.createElement('iframe');
iframe.src = meeting.url;
iframe.allow = "camera; microphone; fullscreen; display-capture";
iframe.style.width = '100%';
iframe.style.height = '100vh';
document.body.appendChild(iframe);

// Option 3: Use Jitsi External API
const domain = '8x8.vc';
const options = {
  roomName: meeting.roomId,
  jwt: meeting.token,
  parentNode: document.querySelector('#jitsi-container'),
  configOverwrite: {
    prejoinPageEnabled: false,
    startWithAudioMuted: false,
    startWithVideoMuted: false
  }
};

const api = new JitsiMeetExternalAPI(domain, options);
```

---

## Creator/Host Flow

### Step 1: Check Meeting Status

**Purpose**: Check if meeting has been created (winner burned NFT) or still waiting

**Endpoint**: `POST /api/meetings/access-creator`

**Request**:
```javascript
POST /api/meetings/access-creator
Headers: {
  'Authorization': 'Bearer <jwt_token>',
  'Content-Type': 'application/json'
}
Body: {
  "auctionId": 123
}
```

**Response - Meeting Exists**:
```json
{
  "success": true,
  "meeting": {
    "roomId": "auction-123-1697123456789",
    "url": "https://8x8.vc/meeting-app/auction-123-1697123456789?jwt=eyJhbGci...",
    "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InZwYWFzLW1hZ2ljLWNvb2tpZS0xMjM0In0...",
    "expiresAt": "2025-10-15T12:00:00.000Z",
    "duration": 60,
    "role": "moderator"
  },
  "meetingExists": true,
  "message": "Meeting is ready. You can join now!",
  "winnerInfo": {
    "wallet": "0xWinner...",
    "name": "Jane Smith",
    "hasBurned": true
  }
}
```

**Response - Meeting Not Created Yet**:
```json
{
  "success": false,
  "meetingExists": false,
  "message": "Meeting will be created when winner burns NFT to access",
  "winnerInfo": {
    "wallet": "0xWinner...",
    "name": "Jane Smith",
    "hasBurned": false
  },
  "nftTokenId": 456
}
```

**Possible Errors**:
```json
// Not the creator
{
  "error": "Only the auction creator can access this endpoint"
}

// Auction not found
{
  "error": "Auction not found"
}

// Auction not ended
{
  "error": "Auction has not ended yet"
}
```

### Step 2: Wait for Winner (If Meeting Not Created)

**Frontend Implementation**:
```javascript
// Poll every 10 seconds to check if meeting created
async function waitForMeeting(auctionId, token) {
  const checkMeeting = async () => {
    const response = await fetch('/api/meetings/access-creator', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ auctionId })
    });

    const data = await response.json();

    if (data.success && data.meetingExists) {
      // Meeting created! Join now
      window.location.href = data.meeting.url;
    } else {
      // Still waiting, show status to user
      updateUI({
        status: 'Waiting for winner to burn NFT...',
        winnerName: data.winnerInfo.name,
        winnerWallet: data.winnerInfo.wallet
      });

      // Check again in 10 seconds
      setTimeout(checkMeeting, 10000);
    }
  };

  checkMeeting();
}

// Or use WebSocket for real-time updates (see WebSocket section)
```

### Step 3: Join Meeting

**Frontend Action** (same as winner):
```javascript
// After meeting exists
const { meeting } = response;

// Redirect to Jitsi meeting
window.location.href = meeting.url;

// Or embed in iframe
// Or use Jitsi External API (see Winner Step 4)
```

---

## Complete API Reference

### 1. GET /api/auctions/:auctionId
**Purpose**: Get auction details and status

**Authentication**: Optional (public endpoint, but returns more data if authenticated)

**Request**:
```javascript
GET /api/auctions/123
Headers: {
  'Authorization': 'Bearer <jwt_token>' // Optional
}
```

**Response**:
```json
{
  "success": true,
  "auction": {
    "id": 123,
    "title": "30 Min Strategy Session",
    "description": "Discuss your business strategy",
    "creator_para_id": "para-creator-123",
    "creator_wallet": "0xCreator...",
    "creator_name": "John Doe",
    "auth_type": "email",
    "oauth_method": "google",
    "meeting_duration": 60,
    "nft_token_id": 456,
    "jitsi_room_id": null,
    "auto_ended": true,
    "created_at": "2025-10-14T10:00:00.000Z",

    // Blockchain data
    "reservePrice": "0.1",
    "highestBid": "0.5",
    "highestBidder": "0xWinner...",
    "startBlock": 12345,
    "endBlock": 12445,
    "ended": true,
    "meetingScheduled": false,
    "sellerName": "John Doe",
    "eventName": "Strategy Session",
    "eventDate": "2025-10-20",
    "eventStartTime": "14:00",
    "eventEndTime": "15:00",
    "profilePicture": "ipfs://..."
  }
}
```

### 2. POST /api/meetings/access-winner
**Purpose**: Check if winner needs to burn NFT or can access meeting

**Authentication**: Required (JWT token)

**Authorization**: Must be the auction winner

**Request**:
```javascript
POST /api/meetings/access-winner
Headers: {
  'Authorization': 'Bearer <jwt_token>',
  'Content-Type': 'application/json'
}
Body: {
  "auctionId": 123
}
```

**Success Responses**:

**Case 1: Burn Required**
```json
{
  "requiresBurn": true,
  "nftTokenId": 456,
  "meetingExists": false,
  "contractAddress": "0x9171Cf8E1d3c7EBf7bf8866CcD2c8C58512A3Be8",
  "ownsNFT": true,
  "message": "You must burn your NFT to access the meeting"
}
```

**Case 2: Meeting Already Created**
```json
{
  "requiresBurn": false,
  "meetingExists": true,
  "meeting": {
    "roomId": "auction-123-1697123456789",
    "url": "https://8x8.vc/meeting-app/auction-123-1697123456789?jwt=eyJhbGci...",
    "token": "eyJhbGci...",
    "expiresAt": "2025-10-15T12:00:00.000Z",
    "duration": 60,
    "role": "participant"
  },
  "message": "Meeting already created, you can join now"
}
```

**Error Responses**:
```json
// 401 Unauthorized
{
  "error": "Access token required"
}

// 403 Forbidden
{
  "error": "Only the auction winner can access this endpoint"
}

// 404 Not Found
{
  "error": "Auction not found"
}

// 400 Bad Request
{
  "error": "Auction has not ended yet"
}

// 404 Not Found
{
  "error": "NFT not minted for this auction"
}

// 400 Bad Request
{
  "error": "You do not own the NFT for this auction"
}
```

### 3. POST /api/meetings/burn-nft-access
**Purpose**: Verify NFT burn transaction and create meeting

**Authentication**: Required (JWT token)

**Authorization**: Must be the auction winner

**Request**:
```javascript
POST /api/meetings/burn-nft-access
Headers: {
  'Authorization': 'Bearer <jwt_token>',
  'Content-Type': 'application/json'
}
Body: {
  "auctionId": 123,
  "burnTransactionHash": "0xabc123def456..."
}
```

**Success Response**:
```json
{
  "success": true,
  "meeting": {
    "roomId": "auction-123-1697123456789",
    "url": "https://8x8.vc/meeting-app/auction-123-1697123456789?jwt=eyJhbGci...",
    "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InZwYWFzLW1hZ2ljLWNvb2tpZS0xMjM0In0.eyJhdWQiOiJqaXRzaSIsImlzcyI6ImNoYXQiLCJzdWIiOiJtZWV0aW5nLWFwcCIsInJvb20iOiIqIiwiZXhwIjoxNzI5MDAwMDAwLCJuYmYiOjE3Mjg5OTk5OTAsImNvbnRleHQiOnsidXNlciI6eyJpZCI6InBhcmEtd2lubmVyLTEyMyIsIm5hbWUiOiJKYW5lIFNtaXRoIiwiZW1haWwiOiJqYW5lQGV4YW1wbGUuY29tIiwibW9kZXJhdG9yIjoiZmFsc2UiLCJhdmF0YXIiOiIifSwiZmVhdHVyZXMiOnsibGl2ZXN0cmVhbWluZyI6ImZhbHNlIiwicmVjb3JkaW5nIjoiZmFsc2UiLCJ0cmFuc2NyaXB0aW9uIjoiZmFsc2UiLCJvdXRib3VuZC1jYWxsIjoiZmFsc2UifX19.signature...",
    "expiresAt": "2025-10-15T12:00:00.000Z",
    "duration": 60,
    "role": "participant"
  },
  "message": "Meeting created successfully. You can now join!",
  "nftBurned": true,
  "burnTransactionHash": "0xabc123def456...",
  "blockNumber": 12500
}
```

**Error Responses**:
```json
// 400 Bad Request - Missing fields
{
  "error": "auctionId and burnTransactionHash are required"
}

// 403 Forbidden
{
  "error": "Only the auction winner can burn NFT for access"
}

// 404 Not Found
{
  "error": "Auction not found"
}

// 400 Bad Request
{
  "error": "Transaction not found or failed"
}

// 400 Bad Request
{
  "error": "No NFTBurnedForMeeting event found in transaction"
}

// 409 Conflict - Replay attack
{
  "error": "This burn transaction has already been used to create a meeting"
}

// 400 Bad Request
{
  "error": "Burn transaction auction ID does not match requested auction"
}

// 400 Bad Request
{
  "error": "Burn transaction burner does not match your wallet"
}

// 400 Bad Request
{
  "error": "Burn transaction NFT token ID does not match auction NFT"
}

// 500 Internal Server Error
{
  "error": "Failed to create meeting",
  "message": "Internal server error"
}
```

### 4. POST /api/meetings/access-creator
**Purpose**: Get creator access to meeting (or wait status)

**Authentication**: Required (JWT token)

**Authorization**: Must be the auction creator

**Request**:
```javascript
POST /api/meetings/access-creator
Headers: {
  'Authorization': 'Bearer <jwt_token>',
  'Content-Type': 'application/json'
}
Body: {
  "auctionId": 123
}
```

**Success Response - Meeting Exists**:
```json
{
  "success": true,
  "meetingExists": true,
  "meeting": {
    "roomId": "auction-123-1697123456789",
    "url": "https://8x8.vc/meeting-app/auction-123-1697123456789?jwt=eyJhbGci...",
    "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InZwYWFzLW1hZ2ljLWNvb2tpZS0xMjM0In0.eyJhdWQiOiJqaXRzaSIsImlzcyI6ImNoYXQiLCJzdWIiOiJtZWV0aW5nLWFwcCIsInJvb20iOiIqIiwiZXhwIjoxNzI5MDAwMDAwLCJuYmYiOjE3Mjg5OTk5OTAsImNvbnRleHQiOnsidXNlciI6eyJpZCI6InBhcmEtY3JlYXRvci0xMjMiLCJuYW1lIjoiSm9obiBEb2UiLCJlbWFpbCI6ImpvaG5AZXhhbXBsZS5jb20iLCJtb2RlcmF0b3IiOiJ0cnVlIiwiYXZhdGFyIjoiIn0sImZlYXR1cmVzIjp7ImxpdmVzdHJlYW1pbmciOiJ0cnVlIiwicmVjb3JkaW5nIjoidHJ1ZSIsInRyYW5zY3JpcHRpb24iOiJmYWxzZSIsIm91dGJvdW5kLWNhbGwiOiJmYWxzZSJ9fX0.signature...",
    "expiresAt": "2025-10-15T12:00:00.000Z",
    "duration": 60,
    "role": "moderator"
  },
  "message": "Meeting is ready. You can join now!",
  "winnerInfo": {
    "wallet": "0xWinner...",
    "name": "Jane Smith",
    "para_user_id": "para-winner-123",
    "hasBurned": true
  }
}
```

**Success Response - Meeting Not Created**:
```json
{
  "success": false,
  "meetingExists": false,
  "message": "Meeting will be created when winner burns NFT to access",
  "winnerInfo": {
    "wallet": "0xWinner...",
    "name": "Jane Smith",
    "para_user_id": "para-winner-123",
    "hasBurned": false
  },
  "nftTokenId": 456,
  "auctionId": 123
}
```

**Error Responses**:
```json
// 403 Forbidden
{
  "error": "Only the auction creator can access this endpoint"
}

// 404 Not Found
{
  "error": "Auction not found"
}

// 400 Bad Request
{
  "error": "Auction has not ended yet"
}

// 500 Internal Server Error
{
  "error": "Failed to check creator access",
  "message": "Internal server error"
}
```

---

## Frontend Implementation Examples

### Complete Winner Flow (React/Next.js)

```javascript
// components/WinnerAccessFlow.jsx
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

export default function WinnerAccessFlow({ auctionId, userToken }) {
  const [status, setStatus] = useState('checking'); // checking, burn-required, burning, creating-meeting, ready, error
  const [meeting, setMeeting] = useState(null);
  const [error, setError] = useState(null);
  const [nftTokenId, setNftTokenId] = useState(null);

  // Step 1: Check access status
  useEffect(() => {
    checkAccessStatus();
  }, [auctionId]);

  const checkAccessStatus = async () => {
    try {
      setStatus('checking');

      const response = await fetch('/api/meetings/access-winner', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ auctionId })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to check access');
      }

      if (data.meetingExists) {
        // Meeting already created, can join immediately
        setMeeting(data.meeting);
        setStatus('ready');
      } else if (data.requiresBurn) {
        // Need to burn NFT first
        setNftTokenId(data.nftTokenId);
        setStatus('burn-required');
      }
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  };

  // Step 2: Burn NFT
  const burnNFT = async () => {
    try {
      setStatus('burning');

      // Connect to wallet
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // Contract instance
      const contractAddress = "0x9171Cf8E1d3c7EBf7bf8866CcD2c8C58512A3Be8";
      const contractABI = [...]; // Import your ABI
      const contract = new ethers.Contract(contractAddress, contractABI, signer);

      // Burn NFT
      const tx = await contract.burnNFTForAccess(nftTokenId);
      console.log('Burn transaction:', tx.hash);

      // Wait for confirmation
      const receipt = await tx.wait();
      console.log('Burn confirmed!', receipt);

      // Step 3: Verify burn and create meeting
      await verifyBurnAndCreateMeeting(tx.hash);

    } catch (err) {
      console.error('Burn failed:', err);
      setError(err.message);
      setStatus('error');
    }
  };

  // Step 3: Verify burn and create meeting
  const verifyBurnAndCreateMeeting = async (burnTxHash) => {
    try {
      setStatus('creating-meeting');

      const response = await fetch('/api/meetings/burn-nft-access', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          auctionId,
          burnTransactionHash: burnTxHash
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create meeting');
      }

      // Meeting created successfully!
      setMeeting(data.meeting);
      setStatus('ready');

    } catch (err) {
      console.error('Meeting creation failed:', err);
      setError(err.message);
      setStatus('error');
    }
  };

  // Step 4: Join meeting
  const joinMeeting = () => {
    if (meeting && meeting.url) {
      window.location.href = meeting.url;
    }
  };

  // Render UI based on status
  return (
    <div className="winner-access-container">
      {status === 'checking' && (
        <div className="status-checking">
          <h2>Checking your access...</h2>
          <p>Please wait while we verify your auction win.</p>
        </div>
      )}

      {status === 'burn-required' && (
        <div className="status-burn-required">
          <h2>🎉 Congratulations! You won the auction!</h2>
          <p>To access the meeting, you need to burn your NFT.</p>
          <p className="info">
            <strong>NFT Token ID:</strong> {nftTokenId}
          </p>
          <p className="warning">
            ⚠️ Once you burn your NFT, you'll get permanent access to the meeting.
            The NFT cannot be recovered after burning.
          </p>
          <button onClick={burnNFT} className="btn-primary">
            Burn NFT & Access Meeting
          </button>
        </div>
      )}

      {status === 'burning' && (
        <div className="status-burning">
          <h2>🔥 Burning NFT...</h2>
          <p>Please confirm the transaction in your wallet.</p>
          <p className="info">Waiting for blockchain confirmation...</p>
        </div>
      )}

      {status === 'creating-meeting' && (
        <div className="status-creating">
          <h2>🎬 Creating your meeting...</h2>
          <p>NFT burned successfully! Setting up your meeting room...</p>
        </div>
      )}

      {status === 'ready' && meeting && (
        <div className="status-ready">
          <h2>✅ Meeting Ready!</h2>
          <p>Your meeting room is ready. Click below to join.</p>
          <div className="meeting-info">
            <p><strong>Room ID:</strong> {meeting.roomId}</p>
            <p><strong>Duration:</strong> {meeting.duration} minutes</p>
            <p><strong>Expires:</strong> {new Date(meeting.expiresAt).toLocaleString()}</p>
            <p><strong>Role:</strong> {meeting.role}</p>
          </div>
          <button onClick={joinMeeting} className="btn-success btn-large">
            🚀 Join Meeting Now
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="status-error">
          <h2>❌ Error</h2>
          <p className="error-message">{error}</p>
          <button onClick={checkAccessStatus} className="btn-secondary">
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
```

### Complete Creator Flow (React/Next.js)

```javascript
// components/CreatorAccessFlow.jsx
import { useState, useEffect } from 'react';

export default function CreatorAccessFlow({ auctionId, userToken }) {
  const [status, setStatus] = useState('checking'); // checking, waiting, ready, error
  const [meeting, setMeeting] = useState(null);
  const [winnerInfo, setWinnerInfo] = useState(null);
  const [error, setError] = useState(null);
  const [pollInterval, setPollInterval] = useState(null);

  // Step 1: Check meeting status
  useEffect(() => {
    checkMeetingStatus();
  }, [auctionId]);

  const checkMeetingStatus = async () => {
    try {
      setStatus('checking');

      const response = await fetch('/api/meetings/access-creator', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ auctionId })
      });

      const data = await response.json();

      if (data.success && data.meetingExists) {
        // Meeting created! Can join now
        setMeeting(data.meeting);
        setWinnerInfo(data.winnerInfo);
        setStatus('ready');

        // Stop polling if it's running
        if (pollInterval) {
          clearInterval(pollInterval);
          setPollInterval(null);
        }
      } else {
        // Meeting not created yet, show waiting status
        setWinnerInfo(data.winnerInfo);
        setStatus('waiting');

        // Start polling if not already polling
        if (!pollInterval) {
          startPolling();
        }
      }
    } catch (err) {
      console.error('Error checking meeting status:', err);
      setError(err.message);
      setStatus('error');
    }
  };

  // Poll every 10 seconds to check if meeting created
  const startPolling = () => {
    const interval = setInterval(() => {
      checkMeetingStatus();
    }, 10000); // 10 seconds

    setPollInterval(interval);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [pollInterval]);

  // Join meeting
  const joinMeeting = () => {
    if (meeting && meeting.url) {
      window.location.href = meeting.url;
    }
  };

  // Render UI
  return (
    <div className="creator-access-container">
      {status === 'checking' && (
        <div className="status-checking">
          <h2>Checking meeting status...</h2>
          <p>Please wait...</p>
        </div>
      )}

      {status === 'waiting' && winnerInfo && (
        <div className="status-waiting">
          <h2>⏳ Waiting for Winner</h2>
          <p>Your auction ended successfully!</p>

          <div className="winner-info">
            <h3>Winner Details:</h3>
            <p><strong>Name:</strong> {winnerInfo.name}</p>
            <p><strong>Wallet:</strong> {winnerInfo.wallet}</p>
            <p className="status-badge">
              {winnerInfo.hasBurned ? '✅ NFT Burned' : '⏳ Waiting for NFT burn'}
            </p>
          </div>

          <div className="info-box">
            <p>
              The meeting will be created automatically when {winnerInfo.name} burns their NFT.
              You'll be able to join as soon as it's created.
            </p>
            <p className="note">
              🔄 We're checking every 10 seconds for updates...
            </p>
          </div>

          <button onClick={checkMeetingStatus} className="btn-secondary">
            Check Now
          </button>
        </div>
      )}

      {status === 'ready' && meeting && (
        <div className="status-ready">
          <h2>✅ Meeting Ready!</h2>
          <p>The winner has burned their NFT. Your meeting is ready!</p>

          <div className="winner-info">
            <h3>Meeting With:</h3>
            <p><strong>{winnerInfo?.name}</strong></p>
            <p className="wallet-short">{winnerInfo?.wallet}</p>
          </div>

          <div className="meeting-info">
            <p><strong>Room ID:</strong> {meeting.roomId}</p>
            <p><strong>Duration:</strong> {meeting.duration} minutes</p>
            <p><strong>Expires:</strong> {new Date(meeting.expiresAt).toLocaleString()}</p>
            <p><strong>Your Role:</strong> {meeting.role} (Host)</p>
          </div>

          <button onClick={joinMeeting} className="btn-success btn-large">
            🚀 Join Meeting as Host
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="status-error">
          <h2>❌ Error</h2>
          <p className="error-message">{error}</p>
          <button onClick={checkMeetingStatus} className="btn-secondary">
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
```

### Jitsi Meeting Embed (React)

```javascript
// components/JitsiMeeting.jsx
import { useEffect, useRef } from 'react';

export default function JitsiMeeting({ meetingUrl, meetingToken, roomId, onMeetingEnd }) {
  const containerRef = useRef(null);
  const apiRef = useRef(null);

  useEffect(() => {
    if (!roomId || !containerRef.current) return;

    // Load Jitsi External API script
    const script = document.createElement('script');
    script.src = 'https://8x8.vc/external_api.js';
    script.async = true;
    document.body.appendChild(script);

    script.onload = () => {
      // Initialize Jitsi
      const domain = '8x8.vc';
      const options = {
        roomName: roomId,
        jwt: meetingToken,
        parentNode: containerRef.current,
        width: '100%',
        height: '100vh',
        configOverwrite: {
          prejoinPageEnabled: false,
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          enableWelcomePage: false,
          enableClosePage: false
        },
        interfaceConfigOverwrite: {
          TOOLBAR_BUTTONS: [
            'microphone', 'camera', 'hangup', 'chat',
            'desktop', 'fullscreen', 'settings', 'raisehand',
            'videoquality', 'filmstrip', 'stats'
          ],
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false
        }
      };

      const api = new window.JitsiMeetExternalAPI(domain, options);
      apiRef.current = api;

      // Event listeners
      api.addEventListener('readyToClose', () => {
        if (onMeetingEnd) {
          onMeetingEnd();
        }
        api.dispose();
      });

      api.addEventListener('participantJoined', (participant) => {
        console.log('Participant joined:', participant);
      });

      api.addEventListener('participantLeft', (participant) => {
        console.log('Participant left:', participant);
      });
    };

    // Cleanup
    return () => {
      if (apiRef.current) {
        apiRef.current.dispose();
      }
    };
  }, [roomId, meetingToken]);

  return (
    <div className="jitsi-meeting-container">
      <div ref={containerRef} style={{ width: '100%', height: '100vh' }} />
    </div>
  );
}
```

---

## WebSocket Events

For real-time updates, implement WebSocket listeners:

### Backend (Already Implemented)

The backend should emit events when:
1. Auction ends (notify both creator and winner)
2. NFT burned (notify creator that meeting will be created)
3. Meeting created (notify both users to join)

### Frontend Implementation

```javascript
// hooks/useAuctionWebSocket.js
import { useEffect, useState } from 'react';
import io from 'socket.io-client';

export function useAuctionWebSocket(auctionId, userToken) {
  const [socket, setSocket] = useState(null);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    // Connect to WebSocket
    const socketConnection = io('http://localhost:3000', {
      auth: {
        token: userToken
      }
    });

    setSocket(socketConnection);

    // Join auction room
    socketConnection.emit('join-auction', { auctionId });

    // Listen for events
    socketConnection.on('auction-ended', (data) => {
      console.log('Auction ended:', data);
      setEvents(prev => [...prev, { type: 'auction-ended', data }]);
    });

    socketConnection.on('nft-burned', (data) => {
      console.log('NFT burned:', data);
      setEvents(prev => [...prev, { type: 'nft-burned', data }]);
    });

    socketConnection.on('meeting-created', (data) => {
      console.log('Meeting created:', data);
      setEvents(prev => [...prev, { type: 'meeting-created', data }]);
    });

    // Cleanup
    return () => {
      socketConnection.emit('leave-auction', { auctionId });
      socketConnection.disconnect();
    };
  }, [auctionId, userToken]);

  return { socket, events };
}
```

**Usage in Component**:
```javascript
// In WinnerAccessFlow or CreatorAccessFlow
const { events } = useAuctionWebSocket(auctionId, userToken);

useEffect(() => {
  const latestEvent = events[events.length - 1];

  if (latestEvent?.type === 'meeting-created') {
    // Refresh meeting status
    checkMeetingStatus();
  }
}, [events]);
```

---

## Error Handling

### Common Error Scenarios

#### 1. User Not Authenticated
```javascript
// Frontend error handling
try {
  const response = await fetch('/api/meetings/access-winner', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ auctionId })
  });

  if (response.status === 401) {
    // Redirect to login
    router.push('/login?redirect=' + encodeURIComponent(window.location.pathname));
    return;
  }

  if (response.status === 403) {
    // Not authorized (not the winner/creator)
    const data = await response.json();
    showError(data.error);
    return;
  }

  // Handle success...
} catch (error) {
  console.error('Request failed:', error);
  showError('Network error. Please try again.');
}
```

#### 2. NFT Burn Transaction Failed
```javascript
// Frontend error handling
try {
  const tx = await contract.burnNFTForAccess(nftTokenId);
  const receipt = await tx.wait();

  if (receipt.status !== 1) {
    throw new Error('Transaction failed on blockchain');
  }

  // Proceed to verify burn...
} catch (error) {
  if (error.code === 'ACTION_REJECTED') {
    showError('You rejected the transaction in your wallet');
  } else if (error.code === 'INSUFFICIENT_FUNDS') {
    showError('Insufficient funds for gas fees');
  } else {
    showError('Failed to burn NFT: ' + error.message);
  }
}
```

#### 3. Meeting Creation Failed
```javascript
// Backend already handles this, but frontend should catch
const response = await fetch('/api/meetings/burn-nft-access', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ auctionId, burnTransactionHash })
});

const data = await response.json();

if (!response.ok) {
  // Show specific error message from backend
  showError(data.error || 'Failed to create meeting');

  // If it's a replay attack, show different message
  if (data.error.includes('already been used')) {
    showError('This NFT has already been burned. Please check your meeting access.');
  }

  return;
}
```

#### 4. Network Errors
```javascript
// Retry logic with exponential backoff
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      return response;
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      // Wait before retry (exponential backoff)
      const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         AUCTION LIFECYCLE                                │
└─────────────────────────────────────────────────────────────────────────┘

Step 0: Auction Creation
├─ Frontend: Create auction via smart contract
├─ Backend: POST /api/auctions/created (record in DB)
└─ Status: Auction Active

Step 1: Bidding Phase
├─ Frontend: Place bids via smart contract
├─ Backend: Monitor blockchain events
└─ Status: Accepting bids until endBlock

Step 2: Auction Ends (Automatic)
├─ Backend Cron: Detects auction ended (currentBlock >= endBlock)
├─ Blockchain: contract.endAuction(auctionId) → NFT minted
├─ Database: UPDATE auctions SET nft_token_id=X, auto_ended=TRUE
└─ WebSocket: Emit 'auction-ended' to both users

                    ┌─────────────────────────────┐
                    │   AUCTION ENDED             │
                    │   NFT Minted to Winner      │
                    │   Meeting NOT Created Yet   │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
                    ▼                             ▼
        ┌───────────────────────┐     ┌──────────────────────┐
        │   WINNER FLOW         │     │   CREATOR FLOW       │
        └───────────────────────┘     └──────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                           WINNER FLOW                                    │
└─────────────────────────────────────────────────────────────────────────┘

Step W1: Check Access Status
├─ Frontend: POST /api/meetings/access-winner
│  └─ Body: { auctionId: 123 }
├─ Backend: Verify user is winner, check NFT ownership
└─ Response:
   ├─ If meeting exists: { requiresBurn: false, meeting: {...} }
   └─ If burn needed: { requiresBurn: true, nftTokenId: 456 }

Step W2: Burn NFT (if required)
├─ Frontend: contract.burnNFTForAccess(nftTokenId)
│  ├─ User confirms in wallet
│  ├─ Transaction submitted
│  └─ Wait for confirmation
├─ Blockchain: Emit NFTBurnedForMeeting event
├─ Transaction hash: 0xabc123...
└─ WebSocket: Emit 'nft-burned' to creator

Step W3: Verify Burn & Create Meeting
├─ Frontend: POST /api/meetings/burn-nft-access
│  └─ Body: { auctionId: 123, burnTransactionHash: "0xabc..." }
├─ Backend:
│  ├─ Get transaction receipt
│  ├─ Verify NFTBurnedForMeeting event
│  ├─ Check anti-replay (transaction_hash not used)
│  ├─ CREATE MEETING via JitsiService
│  │  ├─ Generate creator token (moderator role)
│  │  ├─ Generate winner token (participant role)
│  │  └─ Create Jitsi room
│  ├─ INSERT INTO meetings (room_id, creator_token, winner_token)
│  └─ INSERT INTO meeting_access_logs
└─ Response: { success: true, meeting: { url, token, ... } }

Step W4: Join Meeting
├─ Frontend: Redirect to meeting.url
└─ Jitsi: User joins with JWT token (participant role)

┌─────────────────────────────────────────────────────────────────────────┐
│                          CREATOR FLOW                                    │
└─────────────────────────────────────────────────────────────────────────┘

Step C1: Check Meeting Status
├─ Frontend: POST /api/meetings/access-creator
│  └─ Body: { auctionId: 123 }
├─ Backend: Verify user is creator, check meeting exists
└─ Response:
   ├─ If meeting exists: { success: true, meeting: {...} }
   └─ If waiting: { success: false, message: "Wait for winner..." }

Step C2a: If Meeting Exists → Join
├─ Frontend: Redirect to meeting.url
└─ Jitsi: User joins with JWT token (moderator role)

Step C2b: If Waiting → Poll/WebSocket
├─ Frontend: Poll every 10 seconds OR listen to WebSocket
├─ WebSocket Event: 'meeting-created' received
├─ Frontend: Call POST /api/meetings/access-creator again
└─ Response: { success: true, meeting: {...} } → Join!

┌─────────────────────────────────────────────────────────────────────────┐
│                        MEETING IN PROGRESS                               │
└─────────────────────────────────────────────────────────────────────────┘

Both Users in Jitsi Room
├─ Creator: Moderator role (can record, control settings)
├─ Winner: Participant role
├─ Duration: As specified in auction (e.g., 60 minutes)
└─ Expires: JWT token valid for meeting duration + 1 hour

Meeting Ends
├─ Users hang up
├─ Jitsi room closed
└─ Meeting record remains in database for history
```

---

## Summary of Endpoints & Flows

| **Role** | **Step** | **Action** | **Endpoint** | **Method** | **Auth** |
|----------|----------|------------|--------------|-----------|----------|
| **Winner** | 1 | Check access status | `/api/meetings/access-winner` | POST | JWT |
| **Winner** | 2 | Burn NFT | Smart Contract `burnNFTForAccess()` | - | Wallet |
| **Winner** | 3 | Verify burn & create meeting | `/api/meetings/burn-nft-access` | POST | JWT |
| **Winner** | 4 | Join meeting | Jitsi URL | GET | JWT in URL |
| **Creator** | 1 | Check meeting status | `/api/meetings/access-creator` | POST | JWT |
| **Creator** | 2 | Join meeting (if exists) | Jitsi URL | GET | JWT in URL |
| **Both** | - | Get auction details | `/api/auctions/:auctionId` | GET | Optional |

---

## Testing Checklist

### Winner Flow
- [ ] Can check access status before burning
- [ ] Receives correct NFT token ID
- [ ] Can burn NFT successfully via smart contract
- [ ] Burn transaction creates `NFTBurnedForMeeting` event
- [ ] Backend verifies burn correctly
- [ ] Meeting created with correct tokens
- [ ] Can join meeting with participant role
- [ ] Cannot reuse same burn transaction (replay protection)
- [ ] Error handling works for all edge cases

### Creator Flow
- [ ] Can check meeting status
- [ ] Sees waiting message if meeting not created
- [ ] Polling detects when meeting created
- [ ] Can join meeting with moderator role
- [ ] Has recording/livestream permissions
- [ ] Cannot access before winner burns NFT

### Both Flows
- [ ] JWT authentication works
- [ ] WebSocket notifications received
- [ ] Meeting expires at correct time
- [ ] Database records correct
- [ ] Error messages are clear

---

**Document Version**: 1.0
**Last Updated**: 2025-10-15
**Status**: Complete
**Next Steps**: Frontend integration & testing
