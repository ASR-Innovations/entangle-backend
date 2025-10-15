# Endpoint to Database Table Mapping

## 🎯 **Detailed Endpoint Analysis with Table Connections**

### **AUTHENTICATION ENDPOINTS**

#### **`POST /api/auth/para-auth`**
- **Database Connection**: ✅ **YES**
- **Tables Used**: `users`, `para_sessions`
- **Data Flow**:
  ```
  Input: { verificationToken, walletAddress }
  ↓
  users table: INSERT/UPDATE
  - para_user_id (from Para API)
  - wallet_address (from input)
  - email (from Para API)
  - auth_type (from Para API)
  - display_name (from Para API)
  - profile_image (from Para API)
  ↓
  para_sessions table: INSERT
  - para_user_id
  - session_data (JWT payload)
  - expires_at (7 days)
  ```

#### **`POST /api/auth/import-session`**
- **Database Connection**: ✅ **YES**
- **Tables Used**: `users`, `para_sessions`
- **Data Flow**:
  ```
  Input: { session }
  ↓
  users table: UPDATE
  - wallet_address (from session)
  - updated_at (current timestamp)
  ↓
  para_sessions table: INSERT/UPDATE
  - para_user_id
  - session_data (full session)
  - expires_at (session expiry)
  ```

---

### **AUCTION ENDPOINTS**

#### **`POST /api/auctions/created`**
- **Database Connection**: ✅ **YES**
- **Tables Used**: `auctions`
- **Data Flow**:
  ```
  Input: { title, description, duration, reservePrice, meetingDuration, creatorWallet, transactionHash }
  ↓
  auctions table: INSERT
  - id (from blockchain or increment)
  - contract_address (from contract service)
  - creator_para_id (from JWT)
  - creator_wallet (from input)
  - title (from input)
  - description (from input)
  - metadata_ipfs (generated)
  - meeting_duration (from input)
  - created_at (current timestamp)
  ```

#### **`GET /api/auctions/active`**
- **Database Connection**: ✅ **YES**
- **Tables Used**: `auctions`, `users`
- **Data Flow**:
  ```
  Query: SELECT a.*, u.display_name, u.auth_type, u.oauth_method
  FROM auctions a
  JOIN users u ON a.creator_para_id = u.para_user_id
  WHERE a.auto_ended = false
  ```

#### **`GET /api/auctions/user/created`**
- **Database Connection**: ✅ **YES**
- **Tables Used**: `auctions`, `meetings`
- **Data Flow**:
  ```
  Query: SELECT a.*, CASE WHEN m.id IS NOT NULL THEN true ELSE false END as has_meeting
  FROM auctions a
  LEFT JOIN meetings m ON a.id = m.auction_id
  WHERE a.creator_para_id = $1
  ```

#### **`GET /api/auctions/:auctionId`**
- **Database Connection**: ✅ **YES**
- **Tables Used**: `auctions`, `users`
- **Data Flow**:
  ```
  Query: SELECT a.*, u.display_name, u.auth_type, u.oauth_method
  FROM auctions a
  JOIN users u ON a.creator_para_id = u.para_user_id
  WHERE a.id = $1
  ```

#### **`POST /api/auctions/:auctionId/bid`** ⚠️ **SHOULD BE CONNECTED**
- **Database Connection**: ❌ **NO** (Should be YES)
- **Tables Needed**: `meeting_access_logs`
- **Recommended Data Flow**:
  ```
  Input: { amount, bidderWallet }
  ↓
  meeting_access_logs table: INSERT
  - auction_id (from params)
  - user_para_id (from JWT)
  - wallet_address (from JWT)
  - access_method ('bid_placed')
  - accessed_at (current timestamp)
  ```

#### **`POST /api/auctions/:auctionId/end`** ⚠️ **SHOULD BE CONNECTED**
- **Database Connection**: ❌ **NO** (Should be YES)
- **Tables Needed**: `auctions`
- **Recommended Data Flow**:
  ```
  Input: None
  ↓
  auctions table: UPDATE
  - auto_ended = true
  - ended_at = current timestamp
  WHERE id = auctionId
  ```

#### **`POST /api/auctions/:auctionId/cancel`** ⚠️ **SHOULD BE CONNECTED**
- **Database Connection**: ❌ **NO** (Should be YES)
- **Tables Needed**: `auctions`
- **Recommended Data Flow**:
  ```
  Input: None
  ↓
  auctions table: UPDATE
  - auto_ended = true
  - cancelled_at = current timestamp
  WHERE id = auctionId
  ```

---

### **MEETING ENDPOINTS**

#### **`POST /api/meetings/create-simple`**
- **Database Connection**: ✅ **YES**
- **Tables Used**: `meetings`, `users`
- **Data Flow**:
  ```
  Input: { guestUserId, meetingName, duration }
  ↓
  meetings table: INSERT
  - auction_id (NULL for simple meetings)
  - jitsi_room_id (generated)
  - jitsi_room_config (JSON config)
  - creator_access_token (Jitsi token)
  - winner_access_token (Jitsi token)
  - room_url (Jitsi URL)
  - scheduled_at (current timestamp)
  - expires_at (duration from now)
  ```

#### **`POST /api/meetings/create-gated`**
- **Database Connection**: ✅ **YES**
- **Tables Used**: `meetings`, `lit_gate_passes`
- **Data Flow**:
  ```
  Input: { nftContract, nftTokenId, meetingName, duration, windowStart, windowEnd }
  ↓
  meetings table: INSERT
  - auction_id (NULL for gated meetings)
  - jitsi_room_id (generated)
  - jitsi_room_config (NFT gating config)
  - creator_access_token (Jitsi token)
  - winner_access_token (Jitsi token)
  - room_url (Jitsi URL)
  ↓
  lit_gate_passes table: INSERT
  - nonce (generated)
  - user_para_id (from JWT)
  - wallet_address (from JWT)
  - auction_id (NULL for gated meetings)
  - payload_hash (NFT verification hash)
  - signature (NFT verification signature)
  - expires_at (windowEnd)
  ```

#### **`POST /api/meetings/join-gated/:roomId`**
- **Database Connection**: ✅ **YES**
- **Tables Used**: `meeting_access_logs`, `lit_gate_passes`
- **Data Flow**:
  ```
  Input: { burnTransactionHash }
  ↓
  meeting_access_logs table: INSERT
  - auction_id (from meeting)
  - user_para_id (from JWT)
  - wallet_address (from JWT)
  - nft_token_id (from NFT burn)
  - transaction_hash (burnTransactionHash)
  - access_method ('nft_burn_lit')
  - accessed_at (current timestamp)
  ↓
  lit_gate_passes table: UPDATE
  - used = true
  WHERE nonce = (from verification)
  ```

#### **`GET /api/meetings/:roomId`**
- **Database Connection**: ✅ **YES**
- **Tables Used**: `meetings`
- **Data Flow**:
  ```
  Query: SELECT * FROM meetings WHERE jitsi_room_id = $1
  ```

#### **`GET /api/meetings/`**
- **Database Connection**: ✅ **YES**
- **Tables Used**: `meetings`, `auctions`, `users`
- **Data Flow**:
  ```
  Query: SELECT m.*, a.title, a.creator_para_id, u.display_name
  FROM meetings m
  LEFT JOIN auctions a ON m.auction_id = a.id
  LEFT JOIN users u ON a.creator_para_id = u.para_user_id
  WHERE a.creator_para_id = $1
  ```

---

### **CONTRACT ENDPOINTS**

#### **`GET /api/contract/stats`** ⚠️ **SHOULD BE CONNECTED**
- **Database Connection**: ❌ **NO** (Should be YES)
- **Tables Needed**: `auctions`, `meetings`, `meeting_access_logs`
- **Recommended Data Flow**:
  ```
  Query: SELECT 
    COUNT(*) as total_auctions,
    SUM(CASE WHEN auto_ended = false THEN 1 ELSE 0 END) as active_auctions,
    COUNT(DISTINCT creator_para_id) as unique_creators
  FROM auctions
  ```

#### **`GET /api/contract/auctions`** ⚠️ **SHOULD BE CONNECTED**
- **Database Connection**: ❌ **NO** (Should be YES)
- **Tables Needed**: `auctions`
- **Recommended Data Flow**:
  ```
  Query: SELECT * FROM auctions ORDER BY created_at DESC
  (Combine with blockchain data for full picture)
  ```

#### **`GET /api/contract/dashboard/user/:address`** ⚠️ **SHOULD BE CONNECTED**
- **Database Connection**: ❌ **NO** (Should be YES)
- **Tables Needed**: `auctions`, `meetings`, `meeting_access_logs`
- **Recommended Data Flow**:
  ```
  Query: SELECT 
    a.*, m.jitsi_room_id, mal.access_method
  FROM auctions a
  LEFT JOIN meetings m ON a.id = m.auction_id
  LEFT JOIN meeting_access_logs mal ON a.id = mal.auction_id
  WHERE a.creator_wallet = $1 OR mal.wallet_address = $1
  ```

#### **`GET /api/contract/dashboard/host/:address`** ⚠️ **SHOULD BE CONNECTED**
- **Database Connection**: ❌ **NO** (Should be YES)
- **Tables Needed**: `auctions`, `meetings`
- **Recommended Data Flow**:
  ```
  Query: SELECT a.*, m.jitsi_room_id, m.created_at as meeting_created
  FROM auctions a
  LEFT JOIN meetings m ON a.id = m.auction_id
  WHERE a.creator_wallet = $1
  ```

---

### **ADMIN ENDPOINTS**

#### **`GET /api/admin/db-stats`**
- **Database Connection**: ✅ **YES**
- **Tables Used**: `users`, `auctions`, `meetings`, `para_sessions`
- **Data Flow**:
  ```
  Query: SELECT COUNT(*) FROM users, auctions, meetings, para_sessions
  ```

#### **`GET /api/admin/users`**
- **Database Connection**: ✅ **YES**
- **Tables Used**: `users`
- **Data Flow**:
  ```
  Query: SELECT id, para_user_id, wallet_address, email, auth_type, display_name, created_at
  FROM users ORDER BY created_at DESC
  ```

---

## 📊 **SUMMARY TABLE**

| Endpoint | Current DB Status | Should Connect | Tables Needed | Priority |
|----------|-------------------|------------------|---------------|----------|
| `/api/auth/para-auth` | ✅ Connected | ✅ YES | `users`, `para_sessions` | High |
| `/api/auth/import-session` | ✅ Connected | ✅ YES | `users`, `para_sessions` | High |
| `/api/auctions/created` | ✅ Connected | ✅ YES | `auctions` | High |
| `/api/auctions/active` | ✅ Connected | ✅ YES | `auctions`, `users` | High |
| `/api/auctions/user/created` | ✅ Connected | ✅ YES | `auctions`, `meetings` | High |
| `/api/auctions/:auctionId` | ✅ Connected | ✅ YES | `auctions`, `users` | High |
| `/api/auctions/:auctionId/bid` | ❌ Not Connected | ⚠️ **SHOULD BE** | `meeting_access_logs` | **HIGH** |
| `/api/auctions/:auctionId/end` | ❌ Not Connected | ⚠️ **SHOULD BE** | `auctions` | **HIGH** |
| `/api/auctions/:auctionId/cancel` | ❌ Not Connected | ⚠️ **SHOULD BE** | `auctions` | **HIGH** |
| `/api/meetings/create-simple` | ✅ Connected | ✅ YES | `meetings`, `users` | High |
| `/api/meetings/create-gated` | ✅ Connected | ✅ YES | `meetings`, `lit_gate_passes` | High |
| `/api/meetings/join-gated/:roomId` | ✅ Connected | ✅ YES | `meeting_access_logs`, `lit_gate_passes` | High |
| `/api/meetings/:roomId` | ✅ Connected | ✅ YES | `meetings` | High |
| `/api/meetings/` | ✅ Connected | ✅ YES | `meetings`, `auctions`, `users` | High |
| `/api/contract/stats` | ❌ Not Connected | ⚠️ **SHOULD BE** | `auctions`, `meetings` | Medium |
| `/api/contract/auctions` | ❌ Not Connected | ⚠️ **SHOULD BE** | `auctions` | Medium |
| `/api/contract/dashboard/user/:address` | ❌ Not Connected | ⚠️ **SHOULD BE** | `auctions`, `meetings`, `meeting_access_logs` | Medium |
| `/api/contract/dashboard/host/:address` | ❌ Not Connected | ⚠️ **SHOULD BE** | `auctions`, `meetings` | Medium |
| `/api/admin/db-stats` | ✅ Connected | ✅ YES | All tables | High |
| `/api/admin/users` | ✅ Connected | ✅ YES | `users` | High |

## 🎯 **IMMEDIATE ACTION ITEMS**

### **High Priority (Fix Now)**
1. **Auction bid/end/cancel** - Add database logging
2. **Contract stats** - Add database caching
3. **Dashboard endpoints** - Add database analytics

### **Medium Priority**
4. **Contract auctions** - Use database as primary source
5. **Additional logging** - Enhanced analytics
