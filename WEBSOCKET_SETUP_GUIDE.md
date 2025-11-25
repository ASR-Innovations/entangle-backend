# WebSocket Setup Guide for Arbitrum Sepolia

## Problem

You're seeing this error in your console:
```
error: WebSocket error: Unexpected server response: 403
```

This happens because **public WebSocket endpoints for Arbitrum Sepolia have rate limits and restrictions**.

## Quick Fix: Disable WebSocket (Recommended for Development)

Your application works perfectly without WebSocket! WebSocket is only needed for real-time event monitoring, which is optional.

**Already applied in your `.env`:**
```bash
ENABLE_ORDER_MONITORING=false
```

✅ **Restart your server** and the errors will be gone.

---

## What You're Missing Without WebSocket

WebSocket provides real-time monitoring for:
- Seaport order fulfillment events
- Live blockchain event updates

**However**, your application still works perfectly because:
- ✅ HTTP RPC handles all transactions
- ✅ Cron jobs check for updates every 5 minutes
- ✅ All core functionality works normally

---

## Production Solution: Use Alchemy (Free Tier)

For production or if you need real-time monitoring, use Alchemy's free tier:

### Step 1: Get Alchemy API Key

1. Go to https://www.alchemy.com/
2. Sign up for a free account
3. Click "Create App"
4. Select:
   - **Chain**: Arbitrum
   - **Network**: Arbitrum Sepolia
5. Copy your API key

### Step 2: Update Your `.env`

```bash
# Blockchain - Arbitrum Sepolia Testnet
BLOCKCHAIN_NETWORK=ARBITRUM_SEPOLIA
ETH_WSS_ENDPOINT=wss://arb-sepolia.g.alchemy.com/v2/YOUR_API_KEY
ETH_HTTP_ENDPOINT=https://arb-sepolia.g.alchemy.com/v2/YOUR_API_KEY

# WebSocket Configuration
WS_RPC_URL=wss://arb-sepolia.g.alchemy.com/v2/YOUR_API_KEY
ENABLE_ORDER_MONITORING=true

# Primary RPC URL
RPC_URL=https://arb-sepolia.g.alchemy.com/v2/YOUR_API_KEY
```

### Step 3: Restart Server

```bash
npm restart
```

You should see:
```
✅ WebSocket provider initialized
✅ OrderFulfillmentMonitorService started successfully
```

---

## Alternative: Use Infura

Infura also offers free tier WebSocket access:

1. Go to https://infura.io/
2. Sign up and create a project
3. Select "Arbitrum Sepolia"
4. Copy your API key

Update `.env`:
```bash
ETH_WSS_ENDPOINT=wss://arbitrum-sepolia.infura.io/ws/v3/YOUR_API_KEY
ETH_HTTP_ENDPOINT=https://arbitrum-sepolia.infura.io/v3/YOUR_API_KEY
WS_RPC_URL=wss://arbitrum-sepolia.infura.io/ws/v3/YOUR_API_KEY
RPC_URL=https://arbitrum-sepolia.infura.io/v3/YOUR_API_KEY
ENABLE_ORDER_MONITORING=true
```

---

## Comparison: Free Tier Limits

| Provider | HTTP Requests | WebSocket | Compute Units |
|----------|---------------|-----------|---------------|
| **Alchemy** | Unlimited | Unlimited | 300M/month |
| **Infura** | 100k/day | Included | 100k/day |
| **Public RPC** | Limited | ❌ Restricted | N/A |

**Recommendation**: Use Alchemy for better limits and reliability.

---

## Testing Your WebSocket Connection

After configuring Alchemy/Infura, test with:

```bash
node verify-arbitrum-migration.js
```

You should see:
```
✅ WebSocket connected to Arbitrum Sepolia (Chain ID: 421614)
```

---

## Troubleshooting

### Still Getting 403 Errors?

1. **Check your API key** - Make sure it's correct and has no extra spaces
2. **Verify network** - Ensure you selected "Arbitrum Sepolia" not "Arbitrum One"
3. **Check rate limits** - Free tier has limits, but they're generous

### WebSocket Keeps Disconnecting?

This is normal! The service has automatic reconnection logic. As long as you see:
```
✅ Successfully reconnected to WebSocket
```

Everything is working fine.

### Do I Really Need WebSocket?

**For Development**: No, HTTP RPC is sufficient
**For Production**: Recommended for real-time updates, but not required

---

## Summary

✅ **Current Status**: WebSocket disabled, application working perfectly with HTTP RPC

**Next Steps** (optional):
1. Get free Alchemy API key
2. Update `.env` with Alchemy endpoints
3. Set `ENABLE_ORDER_MONITORING=true`
4. Restart server

**Questions?** Check the documentation:
- `ARBITRUM_SEPOLIA_MIGRATION.md` - Full migration guide
- `ARBITRUM_SEPOLIA_QUICK_REFERENCE.md` - Network details
