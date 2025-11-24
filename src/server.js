const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const { setupDatabase } = require('./config/database');
const { getContractService } = require('./services/ContractService');
const { getJitsiService } = require('./services/JitsiService');
const { initializeLitService } = require('./services/LitService');
const authRoutes = require('./routes/auth');
const auctionRoutes = require('./routes/auctions');
const contractRoutes = require('./routes/contract');
const meetingRoutes = require('./routes/meetings');
const { authenticateSocket } = require('./middleware/auth');
const logger = require('./utils/logger');

const app = express();
const server = http.createServer(app);
// CORS configuration for multiple origins
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001', 
  'https://the-entangle.vercel.app',
  process.env.FRONTEND_URL
].filter(Boolean); // Remove any undefined values

const io = socketIO(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

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
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/auctions', auctionRoutes);
app.use('/api/contract', contractRoutes);
app.use('/api/meetings', require('./routes/meetings'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/orders', require('./routes/orders'));

// Error handling middleware (must be after all routes)
// Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
app.use(notFoundHandler);
app.use(errorHandler);

// Socket.IO for real-time updates
io.use(authenticateSocket);
io.on('connection', (socket) => {
  logger.info('Client connected:', socket.id);
  
  socket.on('join-auction', (auctionId) => {
    socket.join(`auction-${auctionId}`);
    logger.info(`Socket ${socket.id} joined auction ${auctionId}`);
  });
  
  socket.on('leave-auction', (auctionId) => {
    socket.leave(`auction-${auctionId}`);
  });
  
  socket.on('disconnect', () => {
    logger.info('Client disconnected:', socket.id);
  });
});

// Initialize Order WebSocket Service
// Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
const { initializeOrderSocketService } = require('./services/OrderSocketService');
initializeOrderSocketService(io);

async function startServer() {
  try {
    logger.info('🚀 Starting server initialization...');
    
    // Validate Seaport configuration
    logger.info('🔧 Step 0: Validating Seaport configuration...');
    const { validateAndLogConfig } = require('./config/seaportConfig');
    validateAndLogConfig();
    logger.info('✅ Seaport configuration validated');
    
    // Initialize database
    logger.info('📊 Step 1: Connecting to database...');
    await setupDatabase();
    logger.info('✅ Database connected successfully');
    
    // Initialize Contract Service
    logger.info('📝 Step 2: Initializing contract service...');
    const contractService = getContractService();
    const contractInitialized = await contractService.initialize();
    if (contractInitialized) {
      logger.info('✅ Contract service initialized');
    } else {
      logger.warn('⚠️  Contract service initialization failed - continuing without blockchain features');
    }
    
    // Start auction cron service
    logger.info('⏰ Step 3: Starting auction cron service...');
    const { getAuctionCronService } = require('./services/AuctionCronService');
    const auctionCron = getAuctionCronService();
    auctionCron.start();
    logger.info('✅ Auction cron service started');
    
    // Start order cleanup cron service
    logger.info('🧹 Step 3.1: Starting order cleanup cron service...');
    const { getOrderCleanupCronService } = require('./services/OrderCleanupCronService');
    const orderCleanupCron = getOrderCleanupCronService();
    orderCleanupCron.start();
    logger.info('✅ Order cleanup cron service started');
    
    // Start order fulfillment monitor service
    logger.info('🔍 Step 3.2: Starting order fulfillment monitor service...');
    const enableOrderMonitoring = process.env.ENABLE_ORDER_MONITORING !== 'false';
    if (enableOrderMonitoring) {
      const { getOrderFulfillmentMonitorService } = require('./services/OrderFulfillmentMonitorService');
      const orderMonitor = getOrderFulfillmentMonitorService();
      const monitorInitialized = await orderMonitor.initialize();
      if (monitorInitialized) {
        await orderMonitor.start();
        logger.info('✅ Order fulfillment monitor service started');
      } else {
        logger.warn('⚠️  Order fulfillment monitor service initialization failed - continuing without blockchain monitoring');
      }
    } else {
      logger.info('ℹ️  Order fulfillment monitoring disabled via ENABLE_ORDER_MONITORING env var');
    }
    
    // Initialize Jitsi service
    logger.info('📹 Step 4: Initializing Jitsi service...');
    getJitsiService();
    logger.info('✅ Jitsi service ready');
    
    const PORT = process.env.PORT || 5000;
    logger.info(`🌐 Step 5: Starting HTTP server on port ${PORT}...`);
    server.listen(PORT, () => {
      logger.info(`✅ Server running on port ${PORT}`);
      logger.info('🎉 Para integration backend initialized successfully');
      logger.info(`📡 Health check available at: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    logger.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

startServer();

module.exports = { app, io };
