# Deployment Guide - Entangle Backend

## 🖥️ Server Details
- **Server**: divisor-v0
- **Specs**: 2 GB Memory / 2 AMD vCPUs / 60 GB Disk
- **OS**: Ubuntu 24.10 x64
- **Region**: BLR1 (Bangalore)
- **Public IP**: 209.38.123.139
- **Private IP**: 10.122.0.2

## 🚀 Manual Deployment (One-time Setup)

### Step 1: Server Initial Setup

```bash
# SSH into your server
ssh root@209.38.123.139

# Update system
apt update && apt upgrade -y

# Install Node.js 20 (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt-get install -y nodejs

# Install PM2 for process management
npm install -g pm2

# Install Git
apt install -y git

# Install PostgreSQL
apt install -y postgresql postgresql-contrib

# Install Nginx (for reverse proxy)
apt install -y nginx

# Install UFW firewall
ufw enable
ufw allow ssh
ufw allow 80
ufw allow 443
ufw allow 5009  # Your backend port
```

### Step 2: Database Setup

```bash
# Switch to postgres user
sudo -u postgres psql

# In PostgreSQL shell:
CREATE DATABASE entangle_meetings;
CREATE USER entangle_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE entangle_meetings TO entangle_user;
\q

# Test connection
psql -h localhost -U entangle_user -d entangle_meetings
```

### Step 3: Application Deployment

```bash
# Clone your repository
cd /var/www
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git entangle-backend
cd entangle-backend/backend

# Install dependencies
npm install --production

# Create production environment file
cp .env.example .env.production

# Edit environment variables for production
nano .env.production
```

### Step 4: Environment Configuration

Create `/var/www/entangle-backend/backend/.env.production`:

```env
# Server Configuration
NODE_ENV=production
PORT=5009
HOST=0.0.0.0

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=entangle_meetings
DB_USER=entangle_user
DB_PASSWORD=your_secure_password

# Para API Configuration
PARA_API_KEY=your_para_api_key
PARA_ENVIRONMENT=beta

# Jitsi/JaaS Configuration
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

# Blockchain Configuration
CONTRACT_ADDRESS=0xceBD87246e91C7D70C82D5aE5C196a0028543933
RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
AVALANCHE_RPC=https://api.avax-test.network/ext/bc/C/rpc
PLATFORM_PRIVATE_KEY=your_platform_private_key

# Security
JWT_SECRET=your_super_secure_jwt_secret_here
```

### Step 5: Database Migration

```bash
# Run database schema setup
cd /var/www/entangle-backend/backend
psql -h localhost -U entangle_user -d entangle_meetings -f database/schema.sql
```

### Step 6: PM2 Process Management

Create PM2 ecosystem file:

```bash
# Create PM2 config
nano /var/www/entangle-backend/backend/ecosystem.config.js
```

```javascript
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
      PORT: 5009
    },
    env_file: './.env.production',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
```

### Step 7: Start Application

```bash
# Create logs directory
mkdir -p /var/www/entangle-backend/backend/logs

# Start with PM2
cd /var/www/entangle-backend/backend
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup

# Check status
pm2 status
pm2 logs entangle-backend
```

### Step 8: Nginx Reverse Proxy

```bash
# Create Nginx configuration
nano /etc/nginx/sites-available/entangle-backend
```

```nginx
server {
    listen 80;
    server_name 209.38.123.139;  # Your server IP or domain

    location / {
        proxy_pass http://localhost:5009;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
ln -s /etc/nginx/sites-available/entangle-backend /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default

# Test and restart Nginx
nginx -t
systemctl restart nginx
```

## 🔄 CI/CD Pipeline Setup

### Step 1: Create GitHub Actions Workflow

Create `.github/workflows/deploy.yml` in your repository:

```yaml
name: Deploy to DigitalOcean

on:
  push:
    branches: [ main, production ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v3
      
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '20'
        
    - name: Install dependencies
      run: |
        cd backend
        npm ci
        
    - name: Run tests
      run: |
        cd backend
        npm test
        
    - name: Deploy to server
      uses: appleboy/ssh-action@v0.1.5
      with:
        host: ${{ secrets.HOST }}
        username: ${{ secrets.USERNAME }}
        key: ${{ secrets.PRIVATE_KEY }}
        script: |
          cd /var/www/entangle-backend
          git pull origin main
          cd backend
          npm install --production
          pm2 restart entangle-backend
          pm2 save
```

### Step 2: Setup GitHub Secrets

In your GitHub repository, go to Settings > Secrets and Variables > Actions and add:

- `HOST`: 209.38.123.139
- `USERNAME`: root
- `PRIVATE_KEY`: Your SSH private key

### Step 3: SSH Key Setup

```bash
# Generate SSH key on your local machine
ssh-keygen -t ed25519 -C "deployment-key"

# Copy public key to server
ssh-copy-id root@209.38.123.139

# Add private key to GitHub secrets
```

## 🔍 Health Checks & Monitoring

### Basic Health Check Script

Create `/var/www/entangle-backend/backend/health-check.sh`:

```bash
#!/bin/bash

# Check if application is running
if curl -f http://localhost:5009/api/health > /dev/null 2>&1; then
    echo "✅ Application is healthy"
    exit 0
else
    echo "❌ Application is down, restarting..."
    pm2 restart entangle-backend
    sleep 10
    if curl -f http://localhost:5009/api/health > /dev/null 2>&1; then
        echo "✅ Application restarted successfully"
    else
        echo "❌ Application failed to restart"
        exit 1
    fi
fi
```

### Setup Cron for Health Checks

```bash
# Make script executable
chmod +x /var/www/entangle-backend/backend/health-check.sh

# Add to crontab
crontab -e

# Add this line for health check every 5 minutes
*/5 * * * * /var/www/entangle-backend/backend/health-check.sh >> /var/log/health-check.log 2>&1
```

## 🛡️ Security Hardening

```bash
# Disable root SSH login
nano /etc/ssh/sshd_config
# Set: PermitRootLogin no

# Create deployment user
adduser deploy
usermod -aG sudo deploy
su - deploy

# Setup SSH for deploy user
mkdir ~/.ssh
chmod 700 ~/.ssh
# Add your public key to ~/.ssh/authorized_keys

# Restart SSH
systemctl restart ssh
```

## 📊 Access Your Application

- **Backend API**: http://209.38.123.139/api/health
- **API Documentation**: http://209.38.123.139/api/docs (if implemented)
- **PM2 Monitoring**: `pm2 monit`
- **Logs**: `pm2 logs entangle-backend`

## 🔧 Useful Commands

```bash
# Check application status
pm2 status

# View logs
pm2 logs entangle-backend

# Restart application
pm2 restart entangle-backend

# Check Nginx status
systemctl status nginx

# Check database connection
psql -h localhost -U entangle_user -d entangle_meetings -c "SELECT 1;"

# Monitor server resources
htop
```

## 🚨 Troubleshooting

### Common Issues:

1. **Port already in use**: `sudo lsof -i :5009`
2. **Database connection failed**: Check PostgreSQL service and credentials
3. **PM2 not starting**: Check logs with `pm2 logs entangle-backend`
4. **Nginx errors**: Check `/var/log/nginx/error.log`

Your backend will automatically:
- ✅ Start on server boot (via PM2)
- ✅ Restart on crashes (via PM2)
- ✅ Run auction cron jobs
- ✅ Handle API requests
- ✅ Serve through Nginx reverse proxy
