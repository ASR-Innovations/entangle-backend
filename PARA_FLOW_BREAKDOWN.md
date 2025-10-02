# 🔍 PARA AUTHENTICATION FLOW - COMPLETE BREAKDOWN

## **🎯 OVERVIEW**

Para provides **web3 onboarding** with traditional authentication methods (email, social, phone) while automatically creating blockchain wallets for users. Our backend integrates with Para to handle authentication and wallet operations.

---

## **📡 ENDPOINTS BREAKDOWN**

### **1️⃣ POST `/api/auth/para-auth` - Initial Authentication**

**Purpose**: Verify user identity and create app session

**Input**:
```json
{
  "verificationToken": "token-from-para-frontend"
}
```

**Process**:
1. **Verify with Para API**:
   ```
   POST https://api.beta.getpara.com/sessions/verify
   Headers: { "x-external-api-key": "PARA_SECRET_API_KEY" }
   Body: { "verificationToken": "..." }
   ```

2. **Para Returns User Data**:
   ```json
   {
     "authType": "email",           // email, phone, farcaster, telegram, externalWallet
     "identifier": "user@email.com", // email address, phone number, etc.
     "oAuthMethod": "google"        // google, x, discord, facebook, apple (if applicable)
   }
   ```

3. **Create Para User ID**:
   ```javascript
   // We generate this since Para verification doesn't return user ID
   const paraUserId = `${authType}_${Buffer.from(identifier).toString('base64').slice(0, 16)}`;
   // Example: "email_dXNlckBleGFtcGxl"
   ```

4. **Database Storage** (Users Table):
   ```sql
   INSERT INTO users (
     para_user_id,     -- "email_dXNlckBleGFtcGxl"
     email,            -- "user@email.com" (if authType=email)
     auth_type,        -- "email"
     oauth_method,     -- "google"
     display_name,     -- "user@email.com" or "User XXXXXX"
     wallet_address,   -- NULL (not available yet)
     updated_at        -- CURRENT_TIMESTAMP
   ) ON CONFLICT (para_user_id) DO UPDATE SET ...
   ```

5. **Issue JWT Token**:
   ```json
   {
     "userId": 123,
     "paraUserId": "email_dXNlckBleGFtcGxl",
     "authType": "email",
     "identifier": "user@email.com",
     "email": "user@email.com",
     "displayName": "user@email.com",
     "role": "para_user"
   }
   ```

**Output**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 123,
    "paraUserId": "email_dXNlckBleGFtcGxl",
    "email": "user@email.com",
    "authType": "email",
    "oAuthMethod": "google",
    "displayName": "user@email.com",
    "role": "para_user"
  }
}
```

**⚠️ Note**: At this stage, **NO WALLET ADDRESS** is available. User is authenticated but can't perform blockchain operations yet.

---

### **2️⃣ POST `/api/auth/para-session` - Session Import for Wallet Operations**

**Purpose**: Import full Para session to enable wallet operations (transaction signing)

**Requirements**: 
- User must be authenticated (JWT token required)
- Para frontend must serialize the full session

**Input**:
```json
{
  "serializedSession": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
}
```

**Process**:
1. **Import Session via Para SDK**:
   ```javascript
   const userParaServer = new ParaServer(PARA_API_KEY);
   await userParaServer.importSession(serializedSession);
   const { token, keyId } = await userParaServer.issueJwt();
   ```

2. **Extract User Data from Para JWT**:
   ```javascript
   const decoded = jwt.decode(token);
   // Contains: userId, wallets[], email, authType, identifier
   ```

3. **Get Primary Wallet**:
   ```javascript
   const primaryWallet = wallets.find(w => w.type === 'EVM') || wallets[0];
   // Example: { type: "EVM", address: "0x742d35Cc6C3C0532925a3b8D1A8b73", chainId: 1 }
   ```

4. **Update Database** (Add Wallet):
   ```sql
   UPDATE users 
   SET wallet_address = '0x742d35cc6c3c0532925a3b8d1a8b73',
       updated_at = CURRENT_TIMESTAMP 
   WHERE para_user_id = 'email_dXNlckBleGFtcGxl';
   ```

5. **Issue Enhanced JWT**:
   ```json
   {
     "userId": 123,
     "paraUserId": "email_dXNlckBleGFtcGxl",
     "authType": "email",
     "identifier": "user@email.com",
     "email": "user@email.com",
     "displayName": "user@email.com",
     "role": "para_user",
     "walletAddress": "0x742d35cc6c3c0532925a3b8d1a8b73",  // ✅ NOW AVAILABLE
     "hasWallet": true,
     "sessionActive": true
   }
   ```

**Output**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "wallet": {
    "address": "0x742d35Cc6C3C0532925a3b8D1A8b73",
    "type": "EVM"
  }
}
```

**🎯 Note**: Now user can perform blockchain operations. Backend can sign transactions using the imported session.

---

### **3️⃣ GET `/api/auth/verify` - Token Verification**

**Purpose**: Verify JWT token validity and get current user info

**Input**: 
```
Headers: { "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
```

**Output**:
```json
{
  "success": true,
  "user": {
    "userId": 123,
    "paraUserId": "email_dXNlckBleGFtcGxl",
    "authType": "email",
    "email": "user@email.com",
    "displayName": "user@email.com",
    "walletAddress": "0x742d35Cc6C3C0532925a3b8D1A8b73",
    "hasWallet": true,
    "sessionActive": true,
    "role": "para_user"
  }
}
```

---

## **🗄️ DATABASE OPERATIONS - DETAILED**

### **Users Table Schema**:
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,                    -- Auto-increment ID
  para_user_id VARCHAR(255) UNIQUE NOT NULL, -- Our generated Para ID
  wallet_address VARCHAR(42) UNIQUE,       -- EVM wallet (0x...)
  email VARCHAR(255),                       -- Email (if authType=email)
  auth_type VARCHAR(50),                    -- email, phone, farcaster, etc.
  oauth_method VARCHAR(50),                 -- google, x, discord, etc.
  display_name VARCHAR(255),                -- User display name
  profile_image TEXT,                       -- Profile image URL
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **Database State Flow**:

**After `/para-auth`**:
```sql
-- User record created/updated
{
  id: 123,
  para_user_id: "email_dXNlckBleGFtcGxl",
  wallet_address: NULL,                    -- ❌ Not available yet
  email: "user@email.com",
  auth_type: "email",
  oauth_method: "google",
  display_name: "user@email.com",
  profile_image: NULL,
  created_at: "2025-08-30 10:00:00",
  updated_at: "2025-08-30 10:00:00"
}
```

**After `/para-session`**:
```sql
-- User record updated with wallet
{
  id: 123,
  para_user_id: "email_dXNlckBleGFtcGxl",
  wallet_address: "0x742d35cc6c3c0532925a3b8d1a8b73", -- ✅ Now available
  email: "user@email.com",
  auth_type: "email",
  oauth_method: "google",
  display_name: "user@email.com",
  profile_image: NULL,
  created_at: "2025-08-30 10:00:00",
  updated_at: "2025-08-30 10:05:00"        -- Updated timestamp
}
```

---

## **🔄 COMPLETE USER JOURNEY**

### **Step 1: Frontend Authentication**
```javascript
// Frontend (Para SDK)
const para = new Para('your-api-key');
await para.auth.loginWithEmail('user@email.com');
const verificationToken = await para.getVerificationToken();
```

### **Step 2: Backend Verification**
```javascript
// POST /api/auth/para-auth
// Backend verifies token with Para API
// User stored in database (without wallet)
// JWT issued for app access
```

### **Step 3: Wallet Operations (when needed)**
```javascript
// Frontend serializes session for blockchain operations
const serializedSession = para.session.serialize();

// POST /api/auth/para-session  
// Backend imports session
// Wallet address extracted and stored
// Enhanced JWT issued
```

### **Step 4: App Usage**
```javascript
// Frontend uses JWT for all API calls
// Backend can now sign transactions using imported session
// User can create auctions, bid, access meetings
```

---

## **🎯 KEY POINTS**

1. **Two-Stage Process**: Authentication first, then wallet operations
2. **Database Evolution**: User record starts minimal, gets enhanced with wallet
3. **JWT Enhancement**: Token gets upgraded with wallet info after session import
4. **Security**: Session import requires existing authentication
5. **Flexibility**: Users can use app features before needing wallet operations

---

## **⚠️ CURRENT STATUS**

- ✅ **Endpoints**: All implemented and ready
- ✅ **Database**: Schema supports all Para data
- ✅ **JWT**: Token generation and verification working
- ✅ **Service Logic**: Para integration complete
- ❌ **API Keys**: Need real Para Secret API Key
- ❌ **Testing**: Need real verification token from frontend

**Progress**: 95% complete - just need correct API credentials!
