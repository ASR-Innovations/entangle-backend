# Deployment Guide

## Server Setup

### Server Details
- **Server**: divisor-v0
- **Specs**: 2 GB Memory / 2 AMD vCPUs / 60 GB Disk
- **OS**: Ubuntu 24.10 x64
- **Public IP**: 209.38.123.139

### Initial Setup

```bash
# SSH into server
ssh root@209.38.123.139

# Update system
apt update && apt upgrade -y

# Install Node.js 20 (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt-get install -y nodejs

# Install PM2, Git, PostgreSQL, Nginx
npm install -g pm2
apt install -y git postgresql postgresql-contrib nginx

# Setup firewall
ufw enable
ufw allow ssh
ufw allow 80
ufw allow 443
ufw allow 5009
```

### Database Setup

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE entangle_meetings;
CREATE USER entangle_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE entangle_meetings TO entangle_user;
\q
```

### Application Deployment

```bash
# Clone repository
cd /var/www
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git entangle-backend
cd entangle-backend/backend

# Install dependencies
npm install --production

# Create production environment file
cp .env.example .env.production
```

### Environment Configuration

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
[Your private key here]
-----END PRIVATE KEY-----"

# Blockchain Configuration
CONTRACT_ADDRESS=0xceBD87246e91C7D70C82D5aE5C196a0028543933
RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
PLATFORM_PRIVATE_KEY=your_platform_private_key

# Security
JWT_SECRET=your_super_secure_jwt_secret_here
```

### PM2 Process Management

Create `ecosystem.config.js`:

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

Start application:

```bash
# Create logs directory
mkdir -p logs

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Nginx Reverse Proxy

Create `/etc/nginx/sites-available/entangle-backend`:

```nginx
server {
    listen 80;
    server_name 209.38.123.139;

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

Enable site:

```bash
ln -s /etc/nginx/sites-available/entangle-backend /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
```

## CI/CD Pipeline

Create `.github/workflows/deploy.yml`:

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

## Health Monitoring

Create health check script:

```bash
#!/bin/bash
# health-check.sh

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

Add to crontab:

```bash
chmod +x health-check.sh
crontab -e
# Add: */5 * * * * /var/www/entangle-backend/backend/health-check.sh >> /var/log/health-check.log 2>&1
```

## Useful Commands

```bash
# Check application status
pm2 status
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

## Troubleshooting

### Common Issues:

1. **Port already in use**: `sudo lsof -i :5009`
2. **Database connection failed**: Check PostgreSQL service and credentials
3. **PM2 not starting**: Check logs with `pm2 logs entangle-backend`
4. **Nginx errors**: Check `/var/log/nginx/error.log`