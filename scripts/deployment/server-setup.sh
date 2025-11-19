#!/bin/bash

# Server Initial Setup Script for Ubuntu 24.10
# Run this script on your DigitalOcean droplet as root

set -e

echo "🚀 Setting up Entangle Backend Server..."

# Update system
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install Node.js 20 (LTS)
echo "📦 Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt-get install -y nodejs

# Verify Node.js installation
node --version
npm --version

# Install PM2 globally
echo "📦 Installing PM2..."
npm install -g pm2

# Install Git
echo "📦 Installing Git..."
apt install -y git

# Install PostgreSQL
echo "🗄️ Installing PostgreSQL..."
apt install -y postgresql postgresql-contrib

# Start and enable PostgreSQL
systemctl start postgresql
systemctl enable postgresql

# Install Nginx
echo "🌐 Installing Nginx..."
apt install -y nginx

# Install UFW firewall
echo "🔒 Setting up firewall..."
ufw --force enable
ufw allow ssh
ufw allow 80
ufw allow 443
ufw allow 5009

# Install additional utilities
echo "🛠️ Installing utilities..."
apt install -y curl wget htop unzip

# Setup PostgreSQL database
echo "🗄️ Setting up database..."
sudo -u postgres psql << EOF
CREATE DATABASE entangle_meetings;
CREATE USER entangle_user WITH ENCRYPTED PASSWORD 'entangle_secure_password_2024';
GRANT ALL PRIVILEGES ON DATABASE entangle_meetings TO entangle_user;
ALTER USER entangle_user CREATEDB;
\q
EOF

# Clone repository (you'll need to update this with your actual repo)
echo "📂 Cloning repository..."
cd /var/www
# git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git entangle-backend

# For now, create the directory structure
mkdir -p entangle-backend/backend
cd entangle-backend

echo "📝 Repository cloning placeholder created at /var/www/entangle-backend"
echo "🔧 You need to manually clone your repository here or use the deployment script"

# Setup Nginx configuration
echo "🌐 Setting up Nginx..."
cat > /etc/nginx/sites-available/entangle-backend << 'EOF'
server {
    listen 80;
    server_name 209.38.123.139 _;

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
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    location /api/health {
        proxy_pass http://localhost:5009/api/health;
        access_log off;
    }
}
EOF

# Enable Nginx site
ln -sf /etc/nginx/sites-available/entangle-backend /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and restart Nginx
nginx -t
systemctl restart nginx
systemctl enable nginx

# Setup PM2 startup
echo "🔄 Setting up PM2 startup..."
pm2 startup

echo "✅ Server setup completed!"
echo ""
echo "📋 Next steps:"
echo "1. Clone your repository to /var/www/entangle-backend"
echo "2. Create .env.production file with your environment variables"
echo "3. Run database schema setup"
echo "4. Start your application with PM2"
echo ""
echo "🔧 Useful commands:"
echo "- Check Nginx status: systemctl status nginx"
echo "- Check PostgreSQL: systemctl status postgresql"
echo "- Test database: sudo -u postgres psql -d entangle_meetings"
echo "- View Nginx logs: tail -f /var/log/nginx/error.log"
echo ""
echo "🌐 Your server is ready at: http://209.38.123.139"
