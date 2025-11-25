const logger = require('../utils/logger');

/**
 * OrderSocketService
 * Handles WebSocket real-time synchronization for orders
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */
class OrderSocketService {
  constructor(io) {
    this.io = io;
    this.orderNamespace = null;
    this.initialize();
  }

  /**
   * Initialize the order namespace and event handlers
   * Requirement: 4.4 - WebSocket authentication using JWT
   */
  initialize() {
    // Create a dedicated namespace for orders
    this.orderNamespace = this.io.of('/orders');

    // Apply authentication middleware
    const { authenticateSocket } = require('../middleware/auth');
    this.orderNamespace.use(authenticateSocket);

    // Handle connections
    this.orderNamespace.on('connection', (socket) => {
      logger.info('Order WebSocket client connected:', {
        socketId: socket.id,
        userId: socket.user?.paraUserId
      });

      // Handle joining NFT-specific rooms
      socket.on('join-nft', (data) => {
        this.handleJoinNFT(socket, data);
      });

      // Handle leaving NFT-specific rooms
      socket.on('leave-nft', (data) => {
        this.handleLeaveNFT(socket, data);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        logger.info('Order WebSocket client disconnected:', {
          socketId: socket.id,
          userId: socket.user?.paraUserId
        });
      });
    });

    logger.info('✅ OrderSocketService initialized with /orders namespace');
  }

  /**
   * Handle client joining an NFT-specific room
   * Requirement: 4.5 - Room-based broadcasting per NFT
   */
  handleJoinNFT(socket, data) {
    const { nftContract, tokenId } = data;

    if (!nftContract || !tokenId) {
      logger.warn('Invalid join-nft request:', { socketId: socket.id, data });
      return;
    }

    const roomName = this.getRoomName(nftContract, tokenId);
    socket.join(roomName);

    logger.info('Client joined NFT room:', {
      socketId: socket.id,
      userId: socket.user?.paraUserId,
      room: roomName
    });

    // Send confirmation
    socket.emit('joined-nft', {
      nftContract,
      tokenId,
      room: roomName
    });
  }

  /**
   * Handle client leaving an NFT-specific room
   * Requirement: 4.5 - Room-based broadcasting per NFT
   */
  handleLeaveNFT(socket, data) {
    const { nftContract, tokenId } = data;

    if (!nftContract || !tokenId) {
      logger.warn('Invalid leave-nft request:', { socketId: socket.id, data });
      return;
    }

    const roomName = this.getRoomName(nftContract, tokenId);
    socket.leave(roomName);

    logger.info('Client left NFT room:', {
      socketId: socket.id,
      userId: socket.user?.paraUserId,
      room: roomName
    });
  }

  /**
   * Generate room name for NFT-specific broadcasting
   * Requirement: 4.5 - Room-based broadcasting per NFT
   */
  getRoomName(nftContract, tokenId) {
    return `nft:${nftContract.toLowerCase()}:${tokenId}`;
  }

  /**
   * Broadcast order creation event
   * Requirement: 4.1 - Broadcast new orders to all connected clients
   */
  broadcastOrderCreated(orderData) {
    const { orderHash, orderType, tokenId, nftContract, maker, price, paymentToken } = orderData;

    const event = {
      orderHash,
      orderType,
      tokenId,
      nftContract,
      maker,
      price,
      paymentToken,
      timestamp: new Date().toISOString()
    };

    // Broadcast to NFT-specific room
    const roomName = this.getRoomName(nftContract, tokenId);
    this.orderNamespace.to(roomName).emit('order:created', event);

    // Also broadcast to general marketplace room
    this.orderNamespace.emit('marketplace:order:created', event);

    logger.info('📡 Broadcasted order:created event:', {
      orderHash,
      orderType,
      room: roomName
    });
  }

  /**
   * Broadcast order cancellation event
   * Requirement: 4.2 - Broadcast cancellations to all connected clients
   */
  broadcastOrderCancelled(orderData) {
    const { orderHash, orderType, tokenId, nftContract, maker } = orderData;

    const event = {
      orderHash,
      orderType,
      tokenId,
      nftContract,
      maker,
      timestamp: new Date().toISOString()
    };

    // Broadcast to NFT-specific room
    const roomName = this.getRoomName(nftContract, tokenId);
    this.orderNamespace.to(roomName).emit('order:cancelled', event);

    // Also broadcast to general marketplace room
    this.orderNamespace.emit('marketplace:order:cancelled', event);

    logger.info('📡 Broadcasted order:cancelled event:', {
      orderHash,
      orderType,
      room: roomName
    });
  }

  /**
   * Broadcast order fulfillment event
   * Requirement: 4.3 - Broadcast fulfillments to all connected clients
   */
  broadcastOrderFulfilled(orderData) {
    const { orderHash, orderType, tokenId, nftContract, maker, fulfiller, transactionHash } = orderData;

    const event = {
      orderHash,
      orderType,
      tokenId,
      nftContract,
      maker,
      fulfiller,
      transactionHash,
      timestamp: new Date().toISOString()
    };

    // Broadcast to NFT-specific room
    const roomName = this.getRoomName(nftContract, tokenId);
    this.orderNamespace.to(roomName).emit('order:fulfilled', event);

    // Also broadcast to general marketplace room
    this.orderNamespace.emit('marketplace:order:fulfilled', event);

    logger.info('📡 Broadcasted order:fulfilled event:', {
      orderHash,
      orderType,
      room: roomName,
      fulfiller
    });
  }

  /**
   * Get connected clients count for a specific NFT room
   */
  async getRoomClientCount(nftContract, tokenId) {
    const roomName = this.getRoomName(nftContract, tokenId);
    const sockets = await this.orderNamespace.in(roomName).fetchSockets();
    return sockets.length;
  }

  /**
   * Get total connected clients count
   */
  async getTotalClientCount() {
    const sockets = await this.orderNamespace.fetchSockets();
    return sockets.length;
  }
}

// Singleton instance
let orderSocketServiceInstance = null;

/**
 * Initialize the OrderSocketService singleton
 */
function initializeOrderSocketService(io) {
  if (!orderSocketServiceInstance) {
    orderSocketServiceInstance = new OrderSocketService(io);
  }
  return orderSocketServiceInstance;
}

/**
 * Get the OrderSocketService singleton instance
 */
function getOrderSocketService() {
  if (!orderSocketServiceInstance) {
    throw new Error('OrderSocketService not initialized. Call initializeOrderSocketService first.');
  }
  return orderSocketServiceInstance;
}

module.exports = {
  OrderSocketService,
  initializeOrderSocketService,
  getOrderSocketService
};
