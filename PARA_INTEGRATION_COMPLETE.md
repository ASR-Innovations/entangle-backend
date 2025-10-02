# Para Integration - Complete Implementation

## 🎯 **INTEGRATION FLOW**

### **Step 1: Basic Authentication (Verification Token)**
```javascript
// Frontend Code
const para = new Para("beta_fc50f3388ba41bad00adba9289d61aac");
await para.auth.loginWithEmail("user@example.com");

// Get verification token
const verificationToken = await para.getVerificationToken();

// Send to backend
const response = await fetch("/api/auth/para-auth", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ verificationToken })
});

const { token, user } = await response.json();
// Now user is authenticated but can't perform wallet operations
```

**Backend Response:**
```json
{
  "success": true,
  "token": "jwt_token_here",
  "user": {
    "id": 1,
    "paraUserId": "email_cm9oaXQucmFqc3Vy",
    "email": "user@example.com",
    "authType": "email",
    "displayName": "user@example.com",
    "hasWallet": false,
    "role": "para_user"
  },
  "note": "Basic authentication complete. Use /import-session for wallet operations."
}
```

### **Step 2: Full Session Import (Wallet Access)**
```javascript
// Frontend Code (after Step 1)
const session = await para.exportSession();

// Send to backend
const response = await fetch("/api/auth/import-session", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ session })
});

const { token, user, wallet } = await response.json();
// Now user can perform wallet operations
```

**Backend Response:**
```json
{
  "success": true,
  "token": "enhanced_jwt_token_here",
  "user": {
    "id": 1,
    "paraUserId": "248ec087-1738-4f4a-ac03-9db5f7dc786c",
    "email": "user@example.com",
    "authType": "email",
    "displayName": "user@example.com",
    "walletAddress": "0x161d026cd7855bc783506183546c968cd96b4896",
    "hasWallet": true,
    "role": "para_user"
  },
  "wallet": {
    "address": "0x161d026cd7855bc783506183546c968cd96b4896",
    "type": "EVM"
  },
  "note": "Full session imported. User can perform wallet operations."
}
```

## 🗄️ **DATABASE STORAGE**

**YES, we store user data in database for future use:**

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  para_user_id VARCHAR(255) UNIQUE NOT NULL,
  wallet_address VARCHAR(42),
  email VARCHAR(255),
  auth_type VARCHAR(50) NOT NULL,
  oauth_method VARCHAR(50),
  display_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Data stored:**
- Para User ID (for future reference)
- Wallet Address (from full session import)
- Email & Auth Type
- OAuth Method (if used)
- Display Name
- Timestamps

## 🔄 **COMPLETE SYSTEM FLOW**

### **Frontend Integration (Your Part):**

1. **Initialize Para SDK:**
```javascript
const para = new Para("beta_fc50f3388ba41bad00adba9289d61aac");
```

2. **User Login:**
```javascript
await para.auth.loginWithEmail("rohit.rajsurya10@gmail.com");
```

3. **Basic Auth (API calls only):**
```javascript
const verificationToken = await para.getVerificationToken();
const authResponse = await fetch("/api/auth/para-auth", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ verificationToken })
});
```

4. **Full Session (Wallet operations):**
```javascript
const session = await para.exportSession();
const sessionResponse = await fetch("/api/auth/import-session", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ session })
});
```

### **Backend (Already Implemented):**

1. **Receives verification token**
2. **Calls Para API:** `POST https://api.beta.getpara.com/sessions/verify`
3. **Stores user in database**
4. **Returns JWT token**
5. **For full session: imports session via Para Server SDK**
6. **Extracts wallet info and updates database**

## 🛠️ **API ENDPOINTS**

### **GET /api/auth/para-status**
Returns configuration and integration instructions

### **POST /api/auth/para-auth**
- **Input:** `{ verificationToken }`
- **Output:** Basic authentication, no wallet access
- **Database:** Stores user with basic info

### **POST /api/auth/import-session**
- **Input:** `{ session }`
- **Output:** Full authentication with wallet access
- **Database:** Updates user with wallet info

### **GET /api/auth/verify**
- **Input:** Authorization header with JWT
- **Output:** Current user info

## 🎯 **WHAT'S READY FOR YOU**

✅ **Backend Para Integration:** Complete  
✅ **Real Para API Calls:** Working  
✅ **Database Storage:** Implemented  
✅ **JWT Authentication:** Ready  
✅ **Wallet Verification:** Working  
✅ **Session Management:** Complete  

## 🚀 **TEST WITH YOUR DATA**

You can test immediately with your authenticated Para session:

```bash
# In browser console (where you're logged into Para):
const verificationToken = await para.getVerificationToken();
console.log("Token:", verificationToken);

# Then test backend:
curl -X POST http://localhost:5009/api/auth/para-auth \
  -H "Content-Type: application/json" \
  -d '{"verificationToken": "PASTE_YOUR_TOKEN_HERE"}'
```

This will make a **REAL call** to Para API and authenticate you properly!

## 📝 **KEY POINTS**

1. **Two-Step Process:** Basic auth first, then full session for wallet access
2. **Database Storage:** All user data saved for future reference
3. **Real API Calls:** Backend actually calls Para's verification endpoints
4. **JWT Tokens:** Standard authentication for your app
5. **Wallet Integration:** Full wallet access after session import

The backend is **100% ready** and properly integrated with Para's official APIs!
