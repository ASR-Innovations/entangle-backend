#!/bin/bash

# GCP Deployment Script for Entangle Backend
# Run this on your GCP VM after initial setup

set -e  # Exit on error

echo "🚀 Starting Entangle Backend Deployment on GCP"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. System Updates
echo -e "${YELLOW}📦 Updating system packages...${NC}"
sudo apt-get update
sudo apt-get upgrade -y

# 2. Install Node.js 20.x
echo -e "${YELLOW}📦 Installing Node.js 20.x...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Install PostgreSQL
echo -e "${YELLOW}🗄️ Installing PostgreSQL...${NC}"
sudo apt-get install -y postgresql postgresql-contrib

# 4. Install Nginx
echo -e "${YELLOW}🌐 Installing Nginx...${NC}"
sudo apt-get install -y nginx

# 5. Install PM2 globally
echo -e "${YELLOW}📦 Installing PM2...${NC}"
sudo npm install -g pm2

# 6. Install Git
echo -e "${YELLOW}📦 Installing Git...${NC}"
sudo apt-get install -y git

# 7. Setup PostgreSQL
echo -e "${YELLOW}🗄️ Setting up PostgreSQL...${NC}"
sudo -u postgres psql << EOF
-- Create database
CREATE DATABASE entangle_meetings;

-- Create user
CREATE USER entangle_user WITH PASSWORD 'entangle_gcp_2024';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE entangle_meetings TO entangle_user;

-- Connect to the database
\c entangle_meetings

-- Grant schema privileges
GRANT ALL PRIVILEGES ON SCHEMA public TO entangle_user;
EOF

echo -e "${GREEN}✅ PostgreSQL setup complete${NC}"

# 8. Create application directory
echo -e "${YELLOW}📁 Creating application directory...${NC}"
sudo mkdir -p /var/www/entangle-backend
sudo chown -R $USER:$USER /var/www/entangle-backend

# 9. Setup swap file (important for e2-micro with only 1GB RAM)
echo -e "${YELLOW}💾 Creating swap file for memory optimization...${NC}"
if [ ! -f /swapfile ]; then
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    echo -e "${GREEN}✅ 2GB Swap file created${NC}"
else
    echo -e "${GREEN}✅ Swap file already exists${NC}"
fi

# 10. Optimize system for low memory
echo -e "${YELLOW}⚙️ Optimizing system for low memory...${NC}"
sudo sysctl -w vm.swappiness=60
sudo sysctl -w vm.vfs_cache_pressure=50
echo 'vm.swappiness=60' | sudo tee -a /etc/sysctl.conf
echo 'vm.vfs_cache_pressure=50' | sudo tee -a /etc/sysctl.conf

# 11. Create environment file
echo -e "${YELLOW}🔐 Creating environment configuration...${NC}"
cat > /var/www/entangle-backend/.env << 'ENV'
NODE_ENV=production
PORT=5009
HOST=0.0.0.0

# Database
DATABASE_URL=postgresql://entangle_user:entangle_gcp_2024@localhost:5432/entangle_meetings
DB_HOST=localhost
DB_PORT=5432
DB_NAME=entangle_meetings
DB_USER=entangle_user
DB_PASSWORD=entangle_gcp_2024
REDIS_URL=redis://localhost:6379

# Frontend URLs
FRONTEND_URL=https://the-entangle.vercel.app,https://saigreen.cloud,http://localhost:3000

# Para Wallet
PARA_API_KEY=beta_fc50f3388ba41bad00adba9289d61aac
PARA_SECRET_API_KEY=sk_beta_a5e95b16664f8be149a10b9a44cb2cca
PARA_ENVIRONMENT=beta

# Jitsi Configuration
JITSI_DOMAIN=8x8.vc
JITSI_APP_ID=vpaas-magic-cookie-12e00659b2b144eebab8e26c218191dd
JITSI_KID=vpaas-magic-cookie-12e00659b2b144eebab8e26c218191dd/a521af
JITSI_PRIVATE_KEY=MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCSwCiEVtUgGrq56iVMafL+737z3FtWCi53hdd856ZJZJFbhoZQf5o2KWc/ovKVjQNEjPvCFPCoI90+x/zwjcYIOmh0QVurDSWC9VtTEBA4fS10HWc+dBRzTJmfOlkRVls1mMEl2HqPmB1Tur40g58swOTw7k3YmnKSfGCE3escccUZwUYw8LHZOgYchWWbESffULgYOu1wHGr8H/Rcn9bKNtP16luXUAU9Y/xurJKqF+x+gAXxnJ5xvYUmRLRtk7/dLLbKJVeoF/3fguRhElA3XfQUOe74cWglTafXGDhu0KxIDwfFaDAzbTr2p2G3SMnzXO6Su3wPzA7j8L8LCPrtAgMBAAECggEALxcmaUEL5t9s59ew3FJrPU9Q56PgUz21J3l1aolTHN3+nuYOF6q6q4KhtRPuz/qN/+NVrjPV/b50cn7uNarozx8fAZ8vcTYowVtGUOMosVfJzCbbSHkrTsxXx3aLujqBzjMUV7adrZJcZs/X1TYfT9ceIAn4RPdaqJLszfYASgHi9nDbcKKrTteyc26mHjhN4pfUkDT0p0VBIBTNjQyatPFzJNDAjwoS1eZieGnZecr6mdXSPksWEZU3YKbNW4iEXGtwRC2jVZxdJ59hBuG1kOlwOyrx2Q/kJAEqvBUEwqVPvTYlQIioHKMC/cMZtrDp3IwOIVJpmVsb1yAjPzZU6QKBgQDWzgA2n0Hu6MZaxRsqqsFw35MmgThHHFucXK4T8+2LAxhWLAf0iM2slLBgBNyyCMFyoVEjX74UFTOsQf0AHNCL930ZTu4TVbNjztOZNa5kYzZEJNEzDciofTRC8b1gXmXzInoQuovCVvX/px9l/j4EFCeT20A0UHdgN15ASknqVwKBgQCu5P27oTCZra6xagz9Z8Xdk6WfUheZ7qUF+EKyvMMMlKXIL/HeuHyHc+FBbAYMjhlKEANHs9Dm91cS4sr0V4IHgLNU7zPEV9mmHd+106+6z/SL3wKENmc+KR40pqRiLx3VVVN+FRZp8zc66WXbOSTdhMNuLUk819a5mkndr8ICWwKBgDbRaaKG8BedVgmSJcW0wBsjI3V/IrKbHRIBYPd8l9GTH6HWKM2SIBL7+yr18rCIpX2wh3lklKihZIeAa6WctOgTZ9yOlRlgFKDTBpMh7Ph3jUDEuJKz4NKG6VBwSukODiyHTul4AfS9ppfwuYWY5ZC66ALGwFLZei2W07nKe6SPAoGAO8JAtHDCQ3BmBXbgE2H26Nv/Nm39ZHp3Zo/KcnovB0hvUPSY52oQGtRMfmcjtfyDxZutEz3svk57MRfPEygnZNrj67yD6q29z5Xbj6xSGjneLEC6AmT4Z/PyvzjFaEsDHZa3HZik/PS+xWFkjUB8STiI8keFA8YYN3jxjk70sosCgYAChUM60AIT1fmgNDTFA1o3gXJ5xQeWRtmTXKvEImKbHRmbplChpT8zwa7uBX85jYj+TV+WfdBUMcvLOXD3im0W5M1doZffL1AogwGnTwNZi7qjE9aWJg/QgK7/tA4uNrTyn7dgQo9CLkTWMzT57mb3DxNkFw4xpuDu0w2Rl7Hbbw==
JAAS_SUB=vpaas-magic-cookie-12e00659b2b144eebab8e26c218191dd

# Blockchain
CONTRACT_ADDRESS=0x6fD65aE833C9679cBC571581CE0f5Cd73D565796
AUCTION_CONTRACT_ADDRESS=0x9171Cf8E1d3c7EBf7bf8866CcD2c8C58512A3Be8
PLATFORM_PRIVATE_KEY=0xce06951142ff8262ac34d4d8b1b7f8b21bedae438f34394064564cd94ab1e8f7
PRIVATE_KEY=ce06951142ff8262ac34d4d8b1b7f8b21bedae438f34394064564cd94ab1e8f7
RPC_URL=https://avax-fuji.g.alchemy.com/v2/Yo4enHB113igpnycl13On
AVALANCHE_URL=https://avax-fuji.g.alchemy.com/v2/Yo4enHB113igpnycl13On
FUJI_URL=https://avax-fuji.g.alchemy.com/v2/Yo4enHB113igpnycl13On
ETH_HTTP_ENDPOINT=https://avax-fuji.g.alchemy.com/v2/Yo4enHB113igpnycl13On
ETH_WSS_ENDPOINT=wss://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY

# JWT
JWT_SECRET=your-super-secret-jwt-key-min-32-chars-gcp-2024

# Lit Protocol
LIT_ACTION_IPFS_CID=your-lit-action-ipfs-cid
LIT_PKP_PUBLIC_KEY=0x...
LIT_NETWORK=serrano
ENV

echo -e "${YELLOW}⚠️  Environment file created at /var/www/entangle-backend/.env${NC}"

# 12. Setup Nginx configuration
echo -e "${YELLOW}🌐 Configuring Nginx...${NC}"
sudo tee /etc/nginx/sites-available/entangle-backend << 'NGINX' > /dev/null
# Rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

# Upstream backend
upstream entangle_backend {
    server localhost:5009;
    keepalive 64;
}

server {
    listen 80;
    server_name saigreen.cloud www.saigreen.cloud;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name saigreen.cloud www.saigreen.cloud;
    
    # SSL will be configured by Certbot
    # ssl_certificate /etc/letsencrypt/live/saigreen.cloud/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/saigreen.cloud/privkey.pem;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    
    # CORS headers
    add_header 'Access-Control-Allow-Origin' '$http_origin' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
    add_header 'Access-Control-Allow-Credentials' 'true' always;
    
    # Rate limiting
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        
        # Handle preflight requests
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }
        
        proxy_pass http://entangle_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffering
        proxy_buffering off;
    }
    
    # Health check endpoint
    location /health {
        proxy_pass http://entangle_backend;
        access_log off;
    }
    
    # Static files cache
    location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 10240;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml+rss;
    gzip_disable "MSIE [1-6]\.";
}
NGINX

# Enable the site
sudo ln -sf /etc/nginx/sites-available/entangle-backend /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

echo -e "${GREEN}✅ Deployment script complete!${NC}"
echo -e "${YELLOW}📝 Next steps:${NC}"
echo "1. Clone your repository to /var/www/entangle-backend"
echo "2. Install dependencies: cd /var/www/entangle-backend && npm install --production"
echo "3. Edit .env file with your actual API keys if needed"
echo "4. Run database migrations"
echo "5. Start the application with PM2: pm2 start Ecosystem.gcp.config"
echo "6. Setup SSL with Certbot: sudo certbot --nginx -d saigreen.cloud"
echo "7. Configure your domain DNS to point to this server"