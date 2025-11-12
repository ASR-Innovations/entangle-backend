// Vercel serverless function entry point
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const authRoutes = require('../src/routes/auth');
const auctionRoutes = require('../src/routes/auctions');
const contractRoutes = require('../src/routes/contract');
const meetingRoutes = require('../src/routes/meetings');
const adminRoutes = require('../src/routes/admin');
const logger = require('../src/utils/logger');

const app = express();

// CORS configuration for multiple origins
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001', 
  'https://the-entangle.vercel.app',
  process.env.FRONTEND_URL
].filter(Boolean);

// Middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false,
}));
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    services: {
      database: process.env.DATABASE_URL ? 'configured' : 'demo mode',
      blockchain: process.env.ETH_WSS_ENDPOINT ? 'configured' : 'demo mode',
      para: process.env.PARA_API_KEY ? 'configured' : 'demo mode',
      jitsi: process.env.JITSI_SECRET ? 'configured' : 'demo mode'
    }
  });
});

// API Health endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production'
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/auctions', auctionRoutes);
app.use('/api/contract', contractRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/admin', adminRoutes);

// Initialize services on cold start
let initialized = false;
app.use(async (req, res, next) => {
  if (!initialized) {
    try {
      const { setupDatabase } = require('../src/config/database');
      await setupDatabase();
      initialized = true;
      logger.info('Services initialized for serverless function');
    } catch (error) {
      logger.error('Failed to initialize services:', error);
    }
  }
  next();
});

module.exports = app;
