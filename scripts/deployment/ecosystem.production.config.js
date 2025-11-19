module.exports = {
  apps: [{
    name: 'entangle-backend',
    script: './src/server.js',
    instances: 1, // Single instance for 2GB RAM server
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    node_args: '--max_old_space_size=1024',
    
    // Environment configuration
    env: {
      NODE_ENV: 'production',
      PORT: 5009,
      HOST: '0.0.0.0'
    },
    
    // Load environment variables from production file
    env_file: './.env.production',
    
    // Logging configuration
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Advanced PM2 features
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000,
    
    // Graceful shutdown
    kill_timeout: 5000,
    
    // Health monitoring
    health_check_grace_period: 3000,
    
    // Performance monitoring
    pmx: true,
    
    // Source map support for better error tracking
    source_map_support: true,
    
    // Merge logs
    merge_logs: true,
    
    // Cron restart (restart every day at 3 AM to clear memory)
    cron_restart: '0 3 * * *',
    
    // Additional environment variables specific to production
    env_production: {
      NODE_ENV: 'production',
      PORT: 5009,
      HOST: '0.0.0.0',
      // Add any production-specific overrides here
    }
  }],

  // Deployment configuration for PM2
  deploy: {
    production: {
      user: 'root',
      host: '209.38.123.139',
      ref: 'origin/main',
      repo: 'https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git',
      path: '/var/www/entangle-backend',
      'pre-deploy-local': '',
      'post-deploy': 'cd backend && npm install --production && pm2 reload ecosystem.production.config.js --env production',
      'pre-setup': ''
    }
  }
};
