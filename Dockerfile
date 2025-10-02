# Entangle Backend Dockerfile
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install PM2 globally
RUN npm install -g pm2

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Create logs directory
RUN mkdir -p logs

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S entangle -u 1001

# Change ownership
RUN chown -R entangle:nodejs /app
USER entangle

# Expose port
EXPOSE 5009

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5009/api/health || exit 1

# Start application with PM2
CMD ["pm2-runtime", "start", "ecosystem.production.config.js", "--env", "production"]
