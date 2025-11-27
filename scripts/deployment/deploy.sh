#!/bin/bash

# Entangle Backend Deployment Script
# Usage: ./deploy.sh [production|staging]

set -e  # Exit on any error

ENVIRONMENT=${1:-production}
SERVER_IP="209.38.123.139"
SERVER_USER="root"
APP_DIR="/var/www/entangle-backend"

echo "🚀 Deploying Entangle Backend to $ENVIRONMENT environment..."

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if SSH key is available
if ! ssh -o BatchMode=yes -o ConnectTimeout=5 $SERVER_USER@$SERVER_IP exit 2>/dev/null; then
    print_error "Cannot connect to server. Please check SSH keys and server connectivity."
    exit 1
fi

print_status "Connected to server successfully"

# Deploy via SSH
ssh $SERVER_USER@$SERVER_IP << EOF
    set -e
    
    echo "📂 Navigating to application directory..."
    cd $APP_DIR || {
        echo "❌ Application directory not found at $APP_DIR"
        exit 1
    }
    
    echo "📦 Creating backup..."
    if [ -d "backend" ]; then
        cp -r backend backend-backup-\$(date +%Y%m%d-%H%M%S) || echo "⚠️ Backup creation failed"
    fi
    
    echo "⬇️ Pulling latest changes from Git..."
    git fetch origin
    git reset --hard origin/main
    
    echo "📦 Installing production dependencies..."
    cd backend
    npm install --production --silent
    
    echo "🔄 Restarting application with PM2..."
    if pm2 describe entangle-backend > /dev/null 2>&1; then
        pm2 restart entangle-backend
    else
        echo "🆕 Starting application for the first time..."
        pm2 start ecosystem.production.config.js --env production
    fi
    
    pm2 save
    
    echo "⏳ Waiting for application to start..."
    sleep 5
    
    echo "🏥 Performing health check..."
    if curl -f http://localhost:5009/api/health > /dev/null 2>&1; then
        echo "✅ Health check passed"
    else
        echo "⚠️ Health check failed - checking logs..."
        pm2 logs entangle-backend --lines 5
    fi
    
    echo "📊 PM2 Status:"
    pm2 status
    
    echo "🎉 Deployment completed successfully!"
EOF

if [ $? -eq 0 ]; then
    print_success "Deployment completed successfully!"
    print_status "Backend API available at: http://$SERVER_IP/api/health"
    print_status "To view logs: ssh $SERVER_USER@$SERVER_IP 'pm2 logs entangle-backend'"
    print_status "To check status: ssh $SERVER_USER@$SERVER_IP 'pm2 status'"
else
    print_error "Deployment failed!"
    exit 1
fi
