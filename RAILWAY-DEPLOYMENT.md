# Railway Deployment Guide

## Quick Deploy

1. **Connect GitHub repo** to Railway
2. **Add PostgreSQL** service from Railway dashboard
3. **Set environment variables** (see below)
4. **Deploy**

## Environment Variables (Required)

Set these in Railway dashboard → Variables:

```
NODE_ENV=production
PORT=5009
FRONTEND_URL=https://your-frontend.com

# Database (auto-set by Railway PostgreSQL)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Blockchain
RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
CONTRACT_ADDRESS=0x6783A0B48f44dd244A96e01c435CB5315C2AA5Af
PLATFORM_PRIVATE_KEY=your-key

# Para Wallet
PARA_API_KEY=your-key
PARA_SECRET_API_KEY=your-key
PARA_ENVIRONMENT=beta

# JWT
JWT_SECRET=your-secret-min-32-chars

# Jitsi
JITSI_DOMAIN=8x8.vc
JITSI_APP_ID=your-app-id
JITSI_KID=your-kid
JITSI_PRIVATE_KEY=your-private-key
JAAS_SUB=your-subject
```

## What Starts Automatically

- ✅ Express server on PORT 5009
- ✅ Auction cron job (every 10 seconds)
- ✅ Order cleanup cron (every 5 minutes)
- ✅ Order fulfillment monitor
- ✅ Database connection with retry logic

## Health Check

`GET /health` - Returns server status
