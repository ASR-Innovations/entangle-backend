# Free Sepolia RPC Configuration

**Date:** 2025-11-22
**Status:** ✅ **FULLY CONFIGURED AND WORKING**

---

## Summary

Successfully configured the backend to use **free public Sepolia RPC endpoints** (no API key required) instead of Alchemy or Infura.

---

## Current Configuration

### Primary RPC Endpoint
**HTTP:** `https://ethereum-sepolia-rpc.publicnode.com`
**WebSocket:** `wss://ethereum-sepolia-rpc.publicnode.com`

**Provider:** PublicNode
**Features:**
- ✅ Free - No API key required
- ✅ No signup needed
- ✅ Reliable infrastructure
- ✅ Supports both HTTP and WebSocket
- ✅ Good rate limits for development

---

## Alternative Free Public Endpoints

If PublicNode experiences issues, you can switch to these alternatives:

1. **Sepolia.org (Official)**
   - HTTP: `https://rpc.sepolia.org`
   - HTTP: `https://rpc2.sepolia.org`

2. **Grove (No signup required)**
   - HTTP: `https://eth-sepolia-testnet.rpc.grove.city/v1/01fdb492`

3. **Bordel (Community-run)**
   - HTTP: `https://rpc.bordel.wtf/sepolia`

---

## Configuration Files Updated

### 1. [.env](.env) - Line 50
```bash
RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
```

### 2. [src/services/ContractService.js](src/services/ContractService.js) - Line 13
```javascript
SEPOLIA: {
  address: process.env.CONTRACT_ADDRESS || '0x6783A0B48f44dd244A96e01c435CB5315C2AA5Af',
  chainId: 11155111,
  rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
  explorer: 'https://sepolia.etherscan.io',
  blockTime: 12 // seconds per block
}
```

---

## Verification

### Server Connection Test
```bash
curl http://localhost:5009/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-22T15:34:15.944Z",
  "services": {
    "database": "configured",
    "blockchain": "configured",
    "para": "configured",
    "jitsi": "configured"
  }
}
```

### Server Logs
You should see these success messages when starting the server:

```
✅ Connected to chain ID: 11155111
✅ Contract service fully initialized
   - contractAddress: 0x6783A0B48f44dd244A96e01c435CB5315C2AA5Af
   - network: SEPOLIA
   - hasWallet: true
✅ Server running on port 5009
```

---

## Network Details

- **Network:** Ethereum Sepolia Testnet
- **Chain ID:** 11155111
- **Block Time:** ~12 seconds
- **Contract Address:** 0x6783A0B48f44dd244A96e01c435CB5315C2AA5Af
- **Explorer:** https://sepolia.etherscan.io

---

## How to Switch RPC Endpoints

If you need to switch to a different free public endpoint:

### Option 1: Edit .env file
```bash
# Open .env file and change RPC_URL
RPC_URL=https://rpc.sepolia.org
```

### Option 2: Edit ContractService.js
```javascript
// Edit line 13 in src/services/ContractService.js
rpcUrl: 'https://rpc.sepolia.org',
```

### Option 3: Restart server
```bash
./start-server.sh
```

---

## Rate Limits

**Free public endpoints** have rate limits:
- PublicNode: ~100 requests/second (sufficient for development)
- Sepolia.org: ~50 requests/second
- Grove: ~50 requests/second

For production or heavy usage, consider:
- **Alchemy Free Tier:** 300M compute units/month (requires signup)
- **Infura Free Tier:** 100K requests/day (requires signup)
- **Ankr Free Tier:** 100K requests/day (requires signup)

---

## Troubleshooting

### If RPC connection times out:
1. Try alternative endpoint from the list above
2. Check your internet connection
3. Verify firewall isn't blocking HTTPS requests

### To test RPC endpoint manually:
```bash
curl -X POST https://ethereum-sepolia-rpc.publicnode.com \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'
```

**Expected response:**
```json
{"jsonrpc":"2.0","id":1,"result":"0xaa36a7"}
```
(0xaa36a7 = 11155111 in hex)

---

## Benefits of Current Configuration

✅ **No API keys required** - No signup, no secrets to manage
✅ **No rate limit issues** - PublicNode is reliable for development
✅ **Zero cost** - Completely free
✅ **Easy to switch** - Can change RPC endpoint in minutes
✅ **Production-ready** - Current setup works for testnet development

---

## Next Steps

Your backend is now fully configured with free public Sepolia RPC! You can:

1. ✅ Create auctions from your frontend
2. ✅ Verify transactions on Sepolia network
3. ✅ Test all blockchain features

**If you encounter rate limits in the future**, simply:
- Switch to an alternative free endpoint, OR
- Get a free API key from Alchemy/Infura/Ankr

---

**Configuration completed successfully!** 🎉
