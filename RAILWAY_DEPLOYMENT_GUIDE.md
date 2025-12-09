# 🚂 Railway Deployment Guide for Entangle Backend

**Complete step-by-step guide for deploying your backend with PostgreSQL and cron jobs**

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Step 1: Create Railway Account](#step-1-create-railway-account)
3. [Step 2: Create New Project](#step-2-create-new-project)
4. [Step 3: Add PostgreSQL Database](#step-3-add-postgresql-database)
5. [Step 4: Deploy Backend Service](#step-4-deploy-backend-service)
6. [Step 5: Configure Environment Variables](#step-5-configure-environment-variables)
7. [Step 6: Verify Deployment](#step-6-verify-deployment)
8. [Step 7: Get Your Backend URL](#step-7-get-your-backend-url)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

✅ **What you need:**
- GitHub account (to connect your repository)
- Railway account (free tier available)
- Your `.env` file values ready
- This backend code pushed to GitHub

---

## Step 1: Create Railway Account

1. Go to [Railway.app](https://railway.app)
2. Click **"Start a New Project"**
3. Sign up with GitHub (recommended)
4. Authorize Railway to access your repositories

---

## Step 2: Create New Project

1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Choose your repository: `entagledBackend` (or whatever you named it)
4. Railway will automatically detect it's a Node.js project

---

## Step 3: Add PostgreSQL Database

### 3.1 Add Database Service

1. In your Railway project dashboard
2. Click **"+ New"** button
3. Select **"Database"**
4. Choose **"PostgreSQL"**
5. Railway will automatically create and provision the database

### 3.2 Get Database Connection Details

Railway automatically creates these environment variables:
- `DATABASE_URL` - Full PostgreSQL connection string
- `PGHOST` - Database host
- `PGPORT` - Database port (usually 5432)
- `PGUSER` - Database username
- `PGPASSWORD` - Database password
- `PGDATABASE` - Database name

**You don't need to manually set these!** Railway provides them automatically.

### 3.3 Initialize Database Schema

After deployment, you'll need to run the schema migration:

**Option A: Using Railway CLI** (recommended)
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Link to your project
railway link

# Run schema migration
railway run psql $DATABASE_URL -f database/schema.sql
```

**Option B: Using Web Interface**
1. Go to your PostgreSQL service in Railway
2. Click **"Data"** tab
3. Click **"Query"**
4. Copy and paste contents of `database/schema.sql`
5. Click **"Execute"**

---

## Step 4: Deploy Backend Service

Railway will automatically:
1. ✅ Detect `package.json`
2. ✅ Install dependencies (`npm install`)
3. ✅ Run your start command (`npm start`)
4. ✅ Expose your service on a public URL

**Configuration is already done in `railway.json`:**
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 300,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

---

## Step 5: Configure Environment Variables

### 5.1 In Railway Dashboard

1. Go to your **Backend Service** (not the database)
2. Click **"Variables"** tab
3. Click **"+ New Variable"**
4. Add each variable below:

### 5.2 Required Environment Variables

#### **Server Configuration**
```bash
NODE_ENV=production
PORT=5009
FRONTEND_URL=https://your-frontend-url.vercel.app
```

#### **Database (AUTO-PROVIDED by Railway)**
```bash
# Railway automatically provides DATABASE_URL
# You don't need to set this manually!
```

#### **Blockchain - Ethereum Sepolia**
```bash
BLOCKCHAIN_NETWORK=SEPOLIA
ETH_WSS_ENDPOINT=wss://ethereum-sepolia-rpc.publicnode.com
ETH_HTTP_ENDPOINT=https://ethereum-sepolia-rpc.publicnode.com
RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
CONTRACT_ADDRESS=0x6783A0B48f44dd244A96e01c435CB5315C2AA5Af
PLATFORM_PRIVATE_KEY=your_private_key_here
AUCTION_CONTRACT_ADDRESS=0x6783A0B48f44dd244A96e01c435CB5315C2AA5Af
```

⚠️ **IMPORTANT:** Replace `your_private_key_here` with your actual private key

#### **JWT Secret**
```bash
JWT_SECRET=your-super-secret-jwt-key-min-32-chars-production-use-strong-random-string
```

💡 **Generate a strong JWT secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### **Para Wallet API**
```bash
PARA_API_KEY=beta_fc50f3388ba41bad00adba9289d61aac
PARA_SECRET_API_KEY=sk_beta_a5e95b16664f8be149a10b9a44cb2cca
PARA_ENVIRONMENT=beta
```

#### **Jitsi Configuration**
```bash
JITSI_DOMAIN=8x8.vc
JITSI_APP_ID=vpaas-magic-cookie-12e00659b2b144eebab8e26c218191dd
JITSI_SECRET=your-jitsi-jwt-secret
JITSIPUBLIKKEY=your_jitsi_public_key
JITSI_PRIVATE_KEY=your_jitsi_private_key
JITSI_KID=vpaas-magic-cookie-12e00659b2b144eebab8e26c218191dd/a521af
JAAS_SUB=vpaas-magic-cookie-12e00659b2b144eebab8e26c218191dd
```

#### **Seaport Configuration**
```bash
SEAPORT_CONTRACT_ADDRESS=0x0000000000000068F116a894984e2DB1123eB395
SEAPORT_CHAIN_ID=11155111
WS_RPC_URL=wss://ethereum-sepolia-rpc.publicnode.com
ENABLE_ORDER_MONITORING=true
```

#### **Cron Configuration**
```bash
ORDER_CLEANUP_CRON_SCHEDULE=*/5 * * * *
```

#### **Platform Fee Configuration**
```bash
PLATFORM_FEE_BASIS_POINTS=250
```

### 5.3 Copy from Your `.env` File

You can copy most values from your local `.env` file, **EXCEPT**:
- ❌ Don't copy `DATABASE_URL` (Railway provides this)
- ❌ Don't use `localhost` URLs
- ✅ Use production URLs for frontend

---

## Step 6: Verify Deployment

### 6.1 Check Deployment Status

1. Go to **"Deployments"** tab
2. Wait for build to complete (usually 2-5 minutes)
3. Status should show: **✅ Success**

### 6.2 Check Logs

1. Click on your deployment
2. View **"Deploy Logs"** for build process
3. View **"Runtime Logs"** to see:
   ```
   ✅ Database connected successfully
   ✅ Contract service initialized
   🤖 STARTING AUCTION CRON SERVICE
   🌐 Network: SEPOLIA (12 sec/block)
   🟢 Auction cron job started successfully!
   ```

### 6.3 Test Health Endpoint

Your backend will be available at:
```
https://your-project-name.up.railway.app
```

Test the health endpoint:
```bash
curl https://your-project-name.up.railway.app/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-12-08T...",
  "services": {
    "database": "configured",
    "blockchain": "configured",
    "para": "configured",
    "jitsi": "configured"
  }
}
```

---

## Step 7: Get Your Backend URL

### 7.1 Find Your Backend URL

1. Go to your Railway project
2. Click on your **Backend Service**
3. Go to **"Settings"** tab
4. Look for **"Domains"** section
5. Your URL will be: `https://your-project-name.up.railway.app`

### 7.2 Generate Custom Domain (Optional)

If you want a custom domain:

1. In **"Settings"** → **"Domains"**
2. Click **"Generate Domain"**
3. You'll get: `https://your-custom-name.up.railway.app`

Or add your own domain:
1. Click **"Custom Domain"**
2. Enter your domain (e.g., `api.yourdomain.com`)
3. Follow DNS configuration instructions

### 7.3 Update Frontend

Update your frontend `.env` file with the Railway URL:
```bash
NEXT_PUBLIC_API_URL=https://your-project-name.up.railway.app
```

---

## Step 8: Database Management

### 8.1 View Database Data

**Using Railway Dashboard:**
1. Go to PostgreSQL service
2. Click **"Data"** tab
3. Browse tables: `auctions`, `users`, `meetings`, etc.

**Using Railway CLI:**
```bash
# Connect to database
railway connect postgres

# Or run queries
railway run psql $DATABASE_URL -c "SELECT * FROM auctions LIMIT 5;"
```

### 8.2 Database Backups

Railway automatically backs up your database. To manually backup:

```bash
# Export database
railway run pg_dump $DATABASE_URL > backup.sql

# Restore database
railway run psql $DATABASE_URL < backup.sql
```

---

## Step 9: Cron Job Configuration

### ✅ Cron Jobs Work Automatically on Railway!

Your cron jobs will run automatically because Railway supports long-running processes.

**What runs automatically:**
1. **Auction Cron Job** - Every 10 seconds
   - Checks for ended auctions
   - Updates auction data from blockchain
   - Ends auctions automatically

2. **Order Cleanup Cron** - Every 5 minutes
   - Cleans up expired Seaport orders

**Verify Cron Jobs are Running:**

Check logs for:
```
🚀 CRON JOB TRIGGERED at 2025-12-08T...
🔍 CHECKING FOR ENDED AUCTIONS (OPTIMIZED)...
✅ CRON JOB COMPLETED in XXXms
```

---

## 📊 Quick Reference

### Your Railway Setup Summary:

```
┌─────────────────────────────────────┐
│   Railway Project                   │
├─────────────────────────────────────┤
│                                     │
│  📦 Backend Service                 │
│  ├─ Node.js + Express               │
│  ├─ Cron Jobs (auto-running)        │
│  └─ URL: your-name.up.railway.app   │
│                                     │
│  🗄️  PostgreSQL Database            │
│  ├─ Auto-provisioned                │
│  ├─ Auto-backed up                  │
│  └─ Connected via DATABASE_URL      │
│                                     │
└─────────────────────────────────────┘
```

### Environment Variables Checklist:

- [ ] `NODE_ENV=production`
- [ ] `PORT=5009`
- [ ] `FRONTEND_URL=your-frontend-url`
- [ ] `BLOCKCHAIN_NETWORK=SEPOLIA`
- [ ] `RPC_URL=https://ethereum-sepolia-rpc.publicnode.com`
- [ ] `CONTRACT_ADDRESS=0x6783A0B48f44dd244A96e01c435CB5315C2AA5Af`
- [ ] `PLATFORM_PRIVATE_KEY=your_key`
- [ ] `JWT_SECRET=your_secret`
- [ ] `PARA_API_KEY=your_key`
- [ ] `PARA_SECRET_API_KEY=your_key`
- [ ] `JITSI_*` variables (all of them)
- [ ] `SEAPORT_CONTRACT_ADDRESS=0x0000000000000068F116a894984e2DB1123eB395`

---

## 🔧 Troubleshooting

### Issue: "Database connection failed"

**Solution:**
```bash
# Check if DATABASE_URL is set
railway variables

# Restart the service
railway restart
```

### Issue: "Cron job not running"

**Check logs:**
```bash
railway logs

# Look for:
# "🤖 STARTING AUCTION CRON SERVICE"
# "🟢 Auction cron job started successfully!"
```

If not found, check:
1. ✅ `src/server.js` starts the cron service
2. ✅ No errors in deployment logs
3. ✅ Service is running (not crashed)

### Issue: "Port already in use"

**Don't set PORT manually!**
Railway automatically assigns ports. Just use:
```javascript
const PORT = process.env.PORT || 5009;
```

### Issue: "Health check failing"

**Check:**
1. `/health` endpoint exists and responds
2. Health check timeout is set: `300` seconds (in `railway.json`)
3. Service has finished starting up

**Fix:**
```bash
# Check health endpoint
curl https://your-url.up.railway.app/health

# Check logs
railway logs
```

### Issue: "Blockchain RPC errors"

**Verify:**
1. `RPC_URL` is set correctly
2. Using free public RPC (no API key needed)
3. Network is SEPOLIA

**Recommended RPC URLs:**
```bash
https://ethereum-sepolia-rpc.publicnode.com
https://rpc.sepolia.org
https://rpc2.sepolia.org
```

---

## 💰 Railway Pricing

### Free Tier:
- ✅ $5 free credit per month
- ✅ Enough for hobby projects
- ✅ Cron jobs included
- ✅ Database included

### Hobby Plan ($5/month):
- ✅ $5 credit + usage-based
- ✅ Better for production
- ✅ No sleep (always running)

**Your estimated cost:**
- Backend service: ~$2-3/month
- PostgreSQL: ~$1-2/month
- **Total: ~$3-5/month** (fits in free tier!)

---

## 📱 Railway Mobile App

**Monitor your deployment:**
1. Download Railway app (iOS/Android)
2. Log in with same account
3. View logs, metrics, and status on the go

---

## 🎯 Final Checklist

Before going live:

- [ ] ✅ Database created and schema migrated
- [ ] ✅ All environment variables set
- [ ] ✅ Health endpoint responding
- [ ] ✅ Cron jobs running (check logs)
- [ ] ✅ Backend URL obtained
- [ ] ✅ Frontend updated with backend URL
- [ ] ✅ Test auction creation works
- [ ] ✅ Test auction ending works
- [ ] ✅ Monitor logs for 24 hours

---

## 📚 Useful Commands

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to project
railway link

# View logs
railway logs

# Run database query
railway run psql $DATABASE_URL -c "SELECT COUNT(*) FROM auctions;"

# Connect to database
railway connect postgres

# Restart service
railway restart

# View environment variables
railway variables

# Add environment variable
railway variables set KEY=value
```

---

## 🆘 Getting Help

**Railway Support:**
- [Railway Documentation](https://docs.railway.app)
- [Railway Discord](https://discord.gg/railway)
- [Railway Help Center](https://help.railway.app)

**Common Issues:**
- Database connection: Check `DATABASE_URL` is auto-set
- Cron jobs: Check logs for "STARTING AUCTION CRON SERVICE"
- Build fails: Check `package.json` has correct scripts

---

## 🎉 Success!

Once deployed, your backend will:
- ✅ Run 24/7 on Railway
- ✅ Auto-restart if it crashes
- ✅ Run cron jobs automatically
- ✅ Scale automatically
- ✅ Have automatic database backups

**Your backend URL:**
```
https://your-project-name.up.railway.app
```

**API Endpoints:**
```
https://your-project-name.up.railway.app/health
https://your-project-name.up.railway.app/api/auctions
https://your-project-name.up.railway.app/api/auth
```

---

**Created by:** Claude Code
**Last Updated:** December 8, 2025
**Status:** Ready for Railway Deployment ✅
