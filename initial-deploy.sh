#!/bin/bash

# Initial Deployment Script for Entangle Backend
# This script sets up the server and clones the private repository

set -e

SERVER_IP="209.38.123.139"
SERVER_USER="root"
REPO_URL="https://github.com/cybertronprime/entagledBackend.git"
APP_DIR="/var/www/entangle-backend"

echo "🚀 Initial Entangle Backend Deployment Setup..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Check if GitHub token is provided
if [ -z "$GITHUB_TOKEN" ]; then
    print_error "GitHub token is required for private repository access"
    print_status "Please set GITHUB_TOKEN environment variable:"
    print_status "export GITHUB_TOKEN=your_github_personal_access_token"
    print_status "Get token from: https://github.com/settings/tokens"
    exit 1
fi

print_status "Setting up server and deploying application..."

# Execute setup on server
ssh $SERVER_USER@$SERVER_IP << EOF
    set -e
    
    echo "📦 Updating system..."
    apt update
    
    echo "📦 Installing Node.js 20..."
    if ! command -v node &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        apt-get install -y nodejs
    fi
    
    echo "📦 Installing PM2..."
    if ! command -v pm2 &> /dev/null; then
        npm install -g pm2
    fi
    
    echo "📦 Installing Git..."
    if ! command -v git &> /dev/null; then
        apt install -y git
    fi
    
    echo "🗄️ Installing PostgreSQL..."
    if ! systemctl is-active --quiet postgresql; then
        apt install -y postgresql postgresql-contrib
        systemctl start postgresql
        systemctl enable postgresql
        
        # Setup database
        sudo -u postgres psql << SQL
CREATE DATABASE entangle_meetings;
CREATE USER entangle_user WITH ENCRYPTED PASSWORD 'entangle_secure_2024';
GRANT ALL PRIVILEGES ON DATABASE entangle_meetings TO entangle_user;
ALTER USER entangle_user CREATEDB;
\q
SQL
    fi
    
    echo "🌐 Installing Nginx..."
    if ! command -v nginx &> /dev/null; then
        apt install -y nginx
        systemctl enable nginx
    fi
    
    echo "🔒 Setting up firewall..."
    if ! ufw status | grep -q "Status: active"; then
        ufw --force enable
        ufw allow ssh
        ufw allow 80
        ufw allow 443
        ufw allow 5009
    fi
    
    echo "📂 Creating application directory..."
    mkdir -p $APP_DIR
    cd $APP_DIR
    
    # Remove existing repo if any
    if [ -d ".git" ]; then
        echo "🗑️ Removing existing repository..."
        rm -rf .git
        rm -rf *
    fi
    
    echo "📂 Cloning private repository..."
    git clone https://$GITHUB_TOKEN@github.com/cybertronprime/entagledBackend.git .
    
    echo "📦 Installing dependencies..."
    cd backend
    npm install --production
    
    echo "📄 Creating production environment file..."
    cat > .env.production << 'ENV'
# Server Configuration
NODE_ENV=production
PORT=5009
HOST=0.0.0.0

# Database Configuration  
DB_HOST=localhost
DB_PORT=5432
DB_NAME=entangle_meetings
DB_USER=entangle_user
DB_PASSWORD=entangle_secure_2024

# CORS Configuration
FRONTEND_URL=https://the-entangle.vercel.app

# Para API Configuration (UPDATE THESE)
PARA_API_KEY=your_para_api_key_here
PARA_ENVIRONMENT=beta

# Jitsi Configuration
JITSI_DOMAIN=8x8.vc
JITSI_APP_ID=vpaas-magic-cookie-12e00659b2b144eebab8e26c218191dd
JITSI_KID=vpaas-magic-cookie-12e00659b2b144eebab8e26c218191dd/a521af
JITSI_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCSwCiEVtUgGrq5
6iVMafL+737z3FtWCi53hdd856ZJZJFbhoZQf5o2KWc/ovKVjQNEjPvCFPCoI90+
x/zwjcYIOmh0QVurDSWC9VtTEBA4fS10HWc+dBRzTJmfOlkRVls1mMEl2HqPmB1T
ur40g58swOTw7k3YmnKSfGCE3escccUZwUYw8LHZOgYchWWbESffULgYOu1wHGr8
H/Rcn9bKNtP16luXUAU9Y/xurJKqF+x+gAXxnJ5xvYUmRLRtk7/dLLbKJVeoF/3f
guRhElA3XfQUOe74cWglTafXGDhu0KxIDwfFaDAzbTr2p2G3SMnzXO6Su3wPzA7j
8L8LCPrtAgMBAAECggEALxcmaUEL5t9s59ew3FJrPU9Q56PgUz21J3l1aolTHN3+
nuYOF6q6q4KhtRPuz/qN/+NVrjPV/b50cn7uNarozx8fAZ8vcTYowVtGUOMosVfJ
zCbbSHkrTsxXx3aLujqBzjMUV7adrZJcZs/X1TYfT9ceIAn4RPdaqJLszfYASgHi
9nDbcKKrTteyc26mHjhN4pfUkDT0p0VBIBTNjQyatPFzJNDAjwoS1eZieGnZecr6
mdXSPksWEZU3YKbNW4iEXGtwRC2jVZxdJ59hBuG1kOlwOyrx2Q/kJAEqvBUEwqVP
vTYlQIioHKMC/cMZtrDp3IwOIVJpmVsb1yAjPzZU6QKBgQDWzgA2n0Hu6MZaxRsq
qsFw35MmgThHHFucXK4T8+2LAxhWLAf0iM2slLBgBNyyCMFyoVEjX74UFTOsQf0A
HNCL930ZTu4TVbNjztOZNa5kYzZEJNEzDciofTRC8b1gXmXzInoQuovCVvX/px9l
/j4EFCeT20A0UHdgN15ASknqVwKBgQCu5P27oTCZra6xagz9Z8Xdk6WfUheZ7qUF
+EKyvMMMlKXIL/HeuHyHc+FBbAYMjhlKEANHs9Dm91cS4sr0V4IHgLNU7zPEV9mm
Hd+106+6z/SL3wKENmc+KR40pqRiLx3VVVN+FRZp8zc66WXbOSTdhMNuLUk819a5
mkndr8ICWwKBgDbRaaKG8BedVgmSJcW0wBsjI3V/IrKbHRIBYPd8l9GTH6HWKM2S
IBL7+yr18rCIpX2wh3lklKihZIeAa6WctOgTZ9yOlRlgFKDTBpMh7Ph3jUDEuJKz
4NKG6VBwSukODiyHTul4AfS9ppfwuYWY5ZC66ALGwFLZei2W07nKe6SPAoGAO8JA
tHDCQ3BmBXbgE2H26Nv/Nm39ZHp3Zo/KcnovB0hvUPSY52oQGtRMfmcjtfyDxZut
Ez3svk57MRfPEygnZNrj67yD6q29z5Xbj6xSGjneLEC6AmT4Z/PyvzjFaEsDHZa3
HZik/PS+xWFkjUB8STiI8keFA8YYN3jxjk70sosCgYAChUM60AIT1fmgNDTFA1o3
gXJ5xQeWRtmTXKvEImKbHRmbplChpT8zwa7uBX85jYj+TV+WfdBUMcvLOXD3im0W
5M1doZffL1AogwGnTwNZi7qjE9aWJg/QgK7/tA4uNrTyn7dgQo9CLkTWMzT57mb3
DxNkFw4xpuDu0w2Rl7Hbbw==
-----END PRIVATE KEY-----"

# Blockchain Configuration (UPDATE THESE)
CONTRACT_ADDRESS=0xceBD87246e91C7D70C82D5aE5C196a0028543933
RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
AVALANCHE_RPC=https://api.avax-test.network/ext/bc/C/rpc
PLATFORM_PRIVATE_KEY=your_platform_private_key_here

# Security
JWT_SECRET=super_secure_jwt_secret_production_2024
ENV
    
    echo "🗄️ Setting up database schema..."
    if [ -f "database/schema.sql" ]; then
        PGPASSWORD=entangle_secure_2024 psql -h localhost -U entangle_user -d entangle_meetings -f database/schema.sql
    fi
    
    echo "📁 Creating logs directory..."
    mkdir -p logs
    
    echo "🔄 Starting application with PM2..."
    if pm2 describe entangle-backend > /dev/null 2>&1; then
        pm2 delete entangle-backend
    fi
    
    pm2 start ecosystem.production.config.js --env production
    pm2 save
    pm2 startup
    
    echo "🌐 Setting up Nginx..."
    cat > /etc/nginx/sites-available/entangle-backend << 'NGINX'
server {
    listen 80;
    server_name 209.38.123.139 _;

    # Add CORS headers
    add_header 'Access-Control-Allow-Origin' 'https://the-entangle.vercel.app' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
    add_header 'Access-Control-Expose-Headers' 'Content-Length,Content-Range' always;
    add_header 'Access-Control-Allow-Credentials' 'true' always;

    # Handle preflight requests
    if (\$request_method = 'OPTIONS') {
        add_header 'Access-Control-Allow-Origin' 'https://the-entangle.vercel.app' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
        add_header 'Access-Control-Max-Age' 1728000;
        add_header 'Content-Type' 'text/plain; charset=utf-8';
        add_header 'Content-Length' 0;
        return 204;
    }

    location / {
        proxy_pass http://localhost:5009;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    location /api/health {
        proxy_pass http://localhost:5009/api/health;
        access_log off;
    }
}
NGINX
    
    ln -sf /etc/nginx/sites-available/entangle-backend /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    nginx -t
    systemctl restart nginx
    
    echo "⏳ Waiting for application to start..."
    sleep 10
    
    echo "🏥 Health check..."
    if curl -f http://localhost:5009/api/health > /dev/null 2>&1; then
        echo "✅ Application is healthy!"
    else
        echo "⚠️ Health check failed - checking logs..."
        pm2 logs entangle-backend --lines 10
    fi
    
    echo "📊 PM2 Status:"
    pm2 status
    
    echo "🎉 Initial deployment completed!"
    echo "🌐 Backend API: http://209.38.123.139/api/health"
    echo "🔧 To deploy updates: Push to GitHub main branch"
EOF

if [ $? -eq 0 ]; then
    print_success "Initial deployment completed successfully!"
    print_status "Backend API: http://$SERVER_IP/api/health"
    print_status "Frontend can now connect from: https://the-entangle.vercel.app"
    print_status ""
    print_status "Next steps:"
    print_status "1. Update environment variables in .env.production on server"
    print_status "2. Set up GitHub Actions secrets for automated deployments"
    print_status "3. Push code to main branch for automatic updates"
else
    print_error "Initial deployment failed!"
    exit 1
fi
EOF
