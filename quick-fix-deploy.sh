#!/bin/bash

# Quick Fix Deployment Script
# Run this to fix the server deployment manually

SERVER_IP="209.38.123.139"
GITHUB_TOKEN="$1"

if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ Usage: ./quick-fix-deploy.sh YOUR_GITHUB_TOKEN"
    exit 1
fi

echo "🔧 QUICK FIX DEPLOYMENT"
echo "======================="

ssh root@$SERVER_IP << EOF
    echo "📂 Checking current directory structure..."
    cd /var/www/entangle-backend
    ls -la
    
    echo "🔍 Current repository structure:"
    find . -maxdepth 2 -type d
    
    echo "📦 Installing dependencies from correct location..."
    if [ -d "backend" ]; then
        echo "✅ Found backend directory"
        cd backend
    else
        echo "📂 Backend directory not found, checking if we're in a Node.js project..."
        if [ -f "package.json" ]; then
            echo "✅ Found package.json in current directory"
        else
            echo "❌ No package.json found. Checking if files are in root..."
            if [ -f "src/server.js" ]; then
                echo "✅ Found src/server.js in root"
            else
                echo "🔍 Listing all files to debug:"
                find . -name "package.json"
                find . -name "server.js"
            fi
        fi
    fi
    
    echo "📦 Running npm install..."
    npm install --production
    
    echo "📄 Creating production environment file..."
    cat > .env.production << 'ENV_FILE'
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

# Para API Configuration (UPDATE WITH REAL VALUES)
PARA_API_KEY=your_para_api_key_here
PARA_ENVIRONMENT=beta

# Jitsi Configuration (YOUR REAL CREDENTIALS)
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

# Blockchain Configuration (UPDATE WITH REAL VALUES)
CONTRACT_ADDRESS=0xceBD87246e91C7D70C82D5aE5C196a0028543933
RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
AVALANCHE_RPC=https://api.avax-test.network/ext/bc/C/rpc
PLATFORM_PRIVATE_KEY=your_platform_private_key_here

# Security
JWT_SECRET=super_secure_jwt_secret_production_2024_$(date +%s)
ENV_FILE
    
    echo "🗄️ Setting up database schema..."
    if [ -f "database/schema.sql" ]; then
        echo "✅ Found database schema"
        PGPASSWORD=entangle_secure_2024 psql -h localhost -U entangle_user -d entangle_meetings -f database/schema.sql
    else
        echo "⚠️ Database schema not found, checking other locations..."
        find . -name "schema.sql"
    fi
    
    echo "📁 Creating logs directory..."
    mkdir -p logs
    
    echo "🔄 Setting up PM2 ecosystem file..."
    cat > ecosystem.config.js << 'ECOSYSTEM'
module.exports = {
  apps: [{
    name: 'entangle-backend',
    script: './src/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 5009,
      HOST: '0.0.0.0'
    },
    env_file: './.env.production',
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
ECOSYSTEM
    
    echo "🚀 Starting application with PM2..."
    pm2 delete entangle-backend 2>/dev/null || true
    pm2 start ecosystem.config.js
    pm2 save
    
    echo "🌐 Setting up Nginx..."
    cat > /etc/nginx/sites-available/entangle-backend << 'NGINX'
server {
    listen 80;
    server_name 209.38.123.139 _;

    # CORS headers
    add_header 'Access-Control-Allow-Origin' 'https://the-entangle.vercel.app' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
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
        echo "✅ APPLICATION IS RUNNING!"
        echo "🌐 Backend API: http://209.38.123.139/api/health"
    else
        echo "⚠️ Health check failed, checking logs..."
        pm2 logs entangle-backend --lines 10
    fi
    
    echo "📊 PM2 Status:"
    pm2 status
    
    echo "🎉 Deployment completed!"
EOF
