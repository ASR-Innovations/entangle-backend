#!/bin/bash
# Quick fix for production database configuration

echo "🔧 Fixing production database configuration..."

# Stop the application
pm2 stop entangle-backend

# Verify environment variables in ecosystem.config.js
echo "📋 Checking ecosystem.config.js..."
cat ecosystem.config.js | grep -A 3 "DB_"

# Alternative: Set environment variables directly in PM2
echo "🔑 Setting database credentials in PM2..."
pm2 set entangle-backend:DB_HOST localhost
pm2 set entangle-backend:DB_PORT 5432
pm2 set entangle-backend:DB_NAME entangle_meetings
pm2 set entangle-backend:DB_USER entangle_user
pm2 set entangle-backend:DB_PASSWORD entangle_secure_2024

# Restart with fresh environment
echo "🔄 Restarting application..."
pm2 delete entangle-backend
pm2 start ecosystem.config.js
pm2 save

echo "⏳ Waiting for application to start..."
sleep 5

# Test the health endpoint
echo "🏥 Testing health endpoint..."
curl -s http://localhost:5009/health | head -20

echo ""
echo "✅ Done! Test the API again."

