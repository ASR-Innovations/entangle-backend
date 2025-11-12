# Vercel Deployment Guide

## ⚠️ Important Limitations

Your backend uses features that have limitations on Vercel's serverless platform:

1. **Socket.IO (WebSockets)** - Not supported in Vercel serverless functions
2. **Cron Jobs** - Need to be replaced with Vercel Cron or external services
3. **Persistent Connections** - Serverless functions are stateless

## Deployment Steps

### 1. Install Vercel CLI (if not already installed)

```bash
npm install -g vercel
```

### 2. Login to Vercel

```bash
vercel login
```

### 3. Deploy to Vercel

```bash
vercel
```

Follow the prompts:
- Set up and deploy? **Y**
- Which scope? Select your account
- Link to existing project? **N** (first time)
- Project name? **entagled-backend** (or your preferred name)
- Directory? **./** (current directory)
- Override settings? **N**

### 4. Configure Environment Variables

After deployment, add your environment variables in the Vercel dashboard:

1. Go to your project in Vercel dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add all variables from your `.env` file:

```
DATABASE_URL=your_database_url
ETH_WSS_ENDPOINT=your_eth_endpoint
PARA_API_KEY=your_para_key
JITSI_SECRET=your_jitsi_secret
JWT_SECRET=your_jwt_secret
FRONTEND_URL=https://the-entangle.vercel.app
```

### 5. Deploy to Production

```bash
vercel --prod
```

## Alternative: Better Hosting Options

Given your backend's requirements, consider these alternatives:

### 1. **Railway** (Recommended)
- Supports WebSockets
- Supports cron jobs
- Easy deployment from GitHub
- Free tier available

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

### 2. **Render**
- Full Node.js support
- WebSocket support
- Cron jobs support
- Free tier available

### 3. **Fly.io**
- Full Docker support
- WebSocket support
- Global deployment

## Handling Cron Jobs on Vercel

If you stick with Vercel, you'll need to:

1. Create a separate cron endpoint:
   - File: `api/cron/auction-check.js`
   
2. Configure Vercel Cron in `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/cron/auction-check",
    "schedule": "*/5 * * * *"
  }]
}
```

## Handling WebSockets

For WebSockets on Vercel, you'll need:

1. Use a separate WebSocket service (like Pusher, Ably, or Socket.IO hosted elsewhere)
2. Or deploy WebSocket server separately on Railway/Render

## Testing Your Deployment

After deployment, test your endpoints:

```bash
# Health check
curl https://your-app.vercel.app/health

# API health
curl https://your-app.vercel.app/api/health
```

## Troubleshooting

### Cold Starts
Serverless functions may have cold starts (1-3 seconds delay on first request)

### Timeout Issues
Vercel has a 60-second timeout for serverless functions (10s on free tier)

### Database Connections
Use connection pooling and close connections properly to avoid exhausting database connections

## Recommended Next Steps

1. **For quick testing**: Deploy to Vercel as-is (limited functionality)
2. **For production**: Use Railway or Render for full feature support
3. **Hybrid approach**: Use Vercel for API routes, separate service for WebSockets
