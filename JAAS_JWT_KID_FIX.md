# JaaS JWT "Missing Key ID (kid)" Fix

## Issue Description

**Error**: "Authentication failed - Sorry, you're not allowed to join this call. Possible reasons: Missing Key ID (kid)."

**Root Cause**: The JWT token generated for JaaS was missing the `kid` (Key ID) header parameter, which is **required by JaaS** for authentication, even when using HS256 algorithm.

## Problem Analysis

### What Was Happening

1. **Backend generates JWT token** with HS256 algorithm
2. **JWT header was missing `kid`**:
   ```json
   {
     "alg": "HS256",
     "typ": "JWT"
     // ❌ Missing "kid": "vpaas-magic-cookie-.../a521af"
   }
   ```
3. **JaaS rejects the token** because it can't identify which API key to use for verification

### Why It Happened

The code had this logic:
```javascript
// Line 145-150 (OLD CODE)
else {
  // Use HS256 for non-PEM format keys (fallback)
  const token = jwt.sign(payload, this.privateKey, {
    algorithm: 'HS256'  // ❌ No kid header!
  });
}
```

**The `kid` was only added for RS256 tokens** (line 138-140), but not for HS256.

## Fix Applied

### Updated Code (JitsiService.js:145-158)

**Before**:
```javascript
} else {
  // Use HS256 for non-PEM format keys (fallback)
  logger.warn('Private key is not in PEM format, using HS256 instead of RS256');
  const token = jwt.sign(payload, this.privateKey, {
    algorithm: 'HS256'  // ❌ Missing kid!
  });

  logger.info(`JWT token generated for ${userName} (${role}) in room ${roomName} using HS256`);
  return token;
}
```

**After**:
```javascript
} else {
  // Use HS256 for non-PEM format keys (JaaS API key)
  logger.info('Using HS256 with JaaS API key');
  const token = jwt.sign(payload, this.privateKey, {
    algorithm: 'HS256',
    header: {
      kid: this.kid,  // ✅ kid is REQUIRED for JaaS even with HS256!
      typ: 'JWT'
    }
  });

  logger.info(`JWT token generated for ${userName} (${role}) in room ${roomName} using HS256 with kid`);
  return token;
}
```

## JaaS JWT Requirements

### Required JWT Header
```json
{
  "alg": "HS256",           // ✅ Algorithm (HS256 or RS256)
  "typ": "JWT",             // ✅ Token type
  "kid": "vpaas-magic-cookie-.../a521af"  // ✅ Key ID (REQUIRED!)
}
```

### Required JWT Payload
```json
{
  "aud": "jitsi",
  "iss": "chat",
  "sub": "vpaas-magic-cookie-12e00659b2b144eebab8e26c218191dd",
  "room": "*",
  "exp": 1760554994,
  "nbf": 1760544184,
  "context": {
    "user": {
      "id": "email_amFvbnNhbmJhYnkx",
      "name": "jaonsanbaby11@gmail.com",
      "email": "jaonsanbaby11@gmail.com",
      "moderator": "false",  // ✅ STRING not boolean
      "avatar": ""
    },
    "features": {
      "livestreaming": "false",   // ✅ STRING not boolean
      "recording": "false",       // ✅ STRING not boolean
      "transcription": "false",
      "outbound-call": "false"
    }
  },
  "iat": 1760544194
}
```

## Environment Variables

Your current `.env` configuration is correct:

```bash
JITSI_DOMAIN=8x8.vc
JITSI_APP_ID=vpaas-magic-cookie-12e00659b2b144eebab8e26c218191dd
JITSI_PRIVATE_KEY=MIIEvAIBADANBgkqhkiG9w0...  # Your API Secret
JITSI_KID=vpaas-magic-cookie-12e00659b2b144eebab8e26c218191dd/a521af
JAAS_SUB=vpaas-magic-cookie-12e00659b2b144eebab8e26c218191dd
```

✅ All required variables are set!

## Testing

### Step 1: Restart Backend
```bash
# Stop the backend
pkill -f "node.*server" || true

# Start backend
npm start
```

### Step 2: Test Meeting Creation

Try burning the NFT again:
```bash
# The burn was already successful, you just need to regenerate the meeting
# Call the burn-nft-access endpoint with the same transaction
```

### Step 3: Check Logs

You should see:
```
✅ Transaction verified: sent by 0x0CB9D7...
🔍 Parsing transaction logs for NFTBurned event...
✅ Valid NFT burn event verified!
🎬 Creating meeting for auction 56...
Using HS256 with JaaS API key                    // ✅ New log
JWT token generated for ... using HS256 with kid  // ✅ New log
✅ Meeting created and access granted
```

### Step 4: Decode New JWT Token

The new JWT token will have:
```json
{
  "alg": "HS256",
  "typ": "JWT",
  "kid": "vpaas-magic-cookie-12e00659b2b144eebab8e26c218191dd/a521af"  // ✅ Now present!
}
```

### Step 5: Join Meeting

Click "Join meeting" button → Should work without authentication error!

## Expected Behavior

### ✅ Before Fix
1. NFT burns successfully ✅
2. Meeting created ✅
3. JWT token generated ✅
4. Token missing `kid` header ❌
5. JaaS rejects token → "Missing Key ID (kid)" ❌

### ✅ After Fix
1. NFT burns successfully ✅
2. Meeting created ✅
3. JWT token generated with `kid` ✅
4. JaaS accepts token ✅
5. User joins meeting successfully ✅

## Troubleshooting

### If You Still Get Authentication Error

1. **Check JWT Token**:
   ```bash
   # Decode your JWT token at https://jwt.io
   # Verify the header has "kid" field
   ```

2. **Verify Environment Variables**:
   ```bash
   grep -E "JITSI_|JAAS_" .env
   ```

3. **Check Backend Logs**:
   ```bash
   tail -f logs/combined.log | grep -i "jwt\|jitsi\|kid"
   ```

4. **Regenerate Meeting**:
   If you're using the old meeting URL with the old token, you need to create a new meeting:
   - Option A: Burn a different NFT (new auction)
   - Option B: Call the endpoint again with the same burn transaction (it will reject due to replay protection)
   - Option C: Manually delete the `meeting_access_logs` record for that transaction and try again

### Clear Old Meeting (for testing)

If you want to test with auction 56 again:

```sql
-- Connect to database
DELETE FROM meeting_access_logs WHERE auction_id = 56;
DELETE FROM meetings WHERE auction_id = 56;
```

Then call `/api/meetings/burn-nft-access` again with the same burn transaction hash.

## Key Differences: HS256 vs RS256

### HS256 (What you're using)
- **Algorithm**: HMAC with SHA-256
- **Key Type**: Symmetric (same secret for signing and verifying)
- **Your Private Key**: API Secret from JaaS dashboard
- **Requires `kid`**: ✅ YES (even though it's symmetric)

### RS256 (Alternative)
- **Algorithm**: RSA with SHA-256
- **Key Type**: Asymmetric (private key for signing, public key for verifying)
- **Your Private Key**: Would be PEM format starting with `-----BEGIN PRIVATE KEY-----`
- **Requires `kid`**: ✅ YES

**Both algorithms require `kid` for JaaS!**

## Files Modified

1. **`src/services/JitsiService.js`** (lines 145-158)
   - Added `kid` to HS256 JWT header
   - Added `typ: 'JWT'` to header
   - Updated logging messages

## References

- **JaaS Documentation**: https://developer.8x8.com/jaas/docs
- **JWT.io Debugger**: https://jwt.io (use to decode and verify tokens)
- **Your JaaS Dashboard**: https://jaas.8x8.vc/#/

---

**Fix Status**: ✅ COMPLETE
**Date**: 2025-10-15
**Action Required**: Restart backend and test meeting join
