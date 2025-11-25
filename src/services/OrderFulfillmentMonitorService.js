const { ethers } = require('ethers');
const logger = require('../utils/logger');
const { getOrderService } = require('./OrderService');
const { getOrderSocketService } = require('./OrderSocketService');

/**
 * OrderFulfillmentMonitorService
 * 
 * Monitors blockchain for OrderFulfilled events from Seaport contract
 * and updates the database and broadcasts events via WebSocket.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */
class OrderFulfillmentMonitorService {
  constructor() {
    this.provider = null;
    this.wsProvider = null;
    this.seaportContract = null;
    this.isMonitoring = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 5000; // 5 seconds
    
    // Seaport configuration
    this.seaportContractAddress = process.env.SEAPORT_CONTRACT_ADDRESS || '0x0000000000000068F116a894984e2DB1123eB395'; // Seaport 1.6 on Arbitrum Sepolia
    this.chainId = parseInt(process.env.SEAPORT_CHAIN_ID || '421614'); // Arbitrum Sepolia chain ID
    this.rpcUrl = process.env.RPC_URL || process.env.ARBITRUM_SEPOLIA_URL || 'https://sepolia-rollup.arbitrum.io/rpc';
    this.wsRpcUrl = process.env.WS_RPC_URL || 'wss://arbitrum-sepolia.blockpi.network/v1/ws/public';
    
    // Services
    this.orderService = null;
    this.socketService = null;
  }

  /**
   * Initialize the monitoring service
   * Requirement: 6.1 - Listen for OrderFulfilled events
   */
  async initialize() {
    try {
      logger.info('🔍 Initializing OrderFulfillmentMonitorService...');

      // Initialize services
      this.orderService = getOrderService();
      await this.orderService.initialize();

      // Get socket service (should already be initialized)
      try {
        this.socketService = getOrderSocketService();
      } catch (error) {
        logger.warn('⚠️  OrderSocketService not initialized yet, will retry when needed');
      }

      // Initialize WebSocket provider for event listening
      await this.initializeWebSocketProvider();

      // Initialize HTTP provider for queries
      this.provider = new ethers.JsonRpcProvider(this.rpcUrl);

      logger.info('✅ OrderFulfillmentMonitorService initialized', {
        seaportContract: this.seaportContractAddress,
        chainId: this.chainId,
        wsRpcUrl: this.wsRpcUrl
      });

      return true;

    } catch (error) {
      logger.error('❌ Failed to initialize OrderFulfillmentMonitorService:', error);
      return false;
    }
  }

  /**
   * Initialize WebSocket provider with reconnection logic
   */
  async initializeWebSocketProvider() {
    try {
      // Create WebSocket provider
      this.wsProvider = new ethers.WebSocketProvider(this.wsRpcUrl);

      // Set up Seaport contract with WebSocket provider
      // Seaport OrderFulfilled event ABI
      const seaportABI = [
        'event OrderFulfilled(bytes32 orderHash, address indexed offerer, address indexed zone, address fulfiller, tuple(uint8 itemType, address token, uint256 identifier, uint256 amount)[] offer, tuple(uint8 itemType, address token, uint256 identifier, uint256 amount, address recipient)[] consideration)'
      ];

      this.seaportContract = new ethers.Contract(
        this.seaportContractAddress,
        seaportABI,
        this.wsProvider
      );

      // Handle WebSocket errors and reconnection using the websocket property
      if (this.wsProvider.websocket) {
        this.wsProvider.websocket.on('error', (error) => {
          logger.error('WebSocket error:', error);
          this.handleWebSocketError(error);
        });

        this.wsProvider.websocket.on('close', () => {
          logger.warn('WebSocket connection closed, attempting to reconnect...');
          this.handleWebSocketClose();
        });
      }

      logger.info('✅ WebSocket provider initialized');

    } catch (error) {
      logger.error('Failed to initialize WebSocket provider:', error);
      throw error;
    }
  }

  /**
   * Handle WebSocket errors
   */
  handleWebSocketError(error) {
    logger.error('WebSocket error occurred:', error);
    
    if (this.isMonitoring) {
      this.stop();
      this.scheduleReconnect();
    }
  }

  /**
   * Handle WebSocket connection close
   */
  handleWebSocketClose() {
    if (this.isMonitoring) {
      this.stop();
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error(`❌ Max reconnection attempts (${this.maxReconnectAttempts}) reached. Giving up.`);
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;

    logger.info(`⏳ Scheduling reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms...`);

    setTimeout(async () => {
      try {
        await this.initializeWebSocketProvider();
        await this.start();
        this.reconnectAttempts = 0; // Reset on successful reconnection
        logger.info('✅ Successfully reconnected to WebSocket');
      } catch (error) {
        logger.error('Failed to reconnect:', error);
        this.scheduleReconnect();
      }
    }, delay);
  }

  /**
   * Start monitoring for OrderFulfilled events
   * Requirement: 6.1 - Detect OrderFulfilled events
   */
  async start() {
    if (this.isMonitoring) {
      logger.warn('OrderFulfillmentMonitorService is already monitoring');
      return;
    }

    try {
      if (!this.seaportContract) {
        await this.initialize();
      }

      // Ensure socket service is available
      if (!this.socketService) {
        try {
          this.socketService = getOrderSocketService();
        } catch (error) {
          logger.warn('⚠️  OrderSocketService not available, events will not be broadcasted via WebSocket');
        }
      }

      logger.info('🚀 Starting OrderFulfillmentMonitorService...');
      logger.info(`📡 Listening for OrderFulfilled events on ${this.seaportContractAddress}`);

      // Listen for OrderFulfilled events
      this.seaportContract.on('OrderFulfilled', async (
        orderHash,
        offerer,
        zone,
        fulfiller,
        offer,
        consideration,
        event
      ) => {
        await this.handleOrderFulfilled({
          orderHash,
          offerer,
          zone,
          fulfiller,
          offer,
          consideration,
          event
        });
      });

      this.isMonitoring = true;
      logger.info('✅ OrderFulfillmentMonitorService started successfully');

    } catch (error) {
      logger.error('❌ Failed to start OrderFulfillmentMonitorService:', error);
      throw error;
    }
  }

  /**
   * Stop monitoring for events
   */
  stop() {
    if (!this.isMonitoring) {
      return;
    }

    try {
      logger.info('🛑 Stopping OrderFulfillmentMonitorService...');

      // Remove all listeners
      if (this.seaportContract) {
        this.seaportContract.removeAllListeners('OrderFulfilled');
      }

      // Close WebSocket provider
      if (this.wsProvider) {
        this.wsProvider.destroy();
        this.wsProvider = null;
      }

      this.isMonitoring = false;
      logger.info('✅ OrderFulfillmentMonitorService stopped');

    } catch (error) {
      logger.error('Error stopping OrderFulfillmentMonitorService:', error);
    }
  }

  /**
   * Handle OrderFulfilled event
   * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
   * 
   * @param {Object} eventData - Event data from blockchain
   */
  async handleOrderFulfilled(eventData) {
    const { orderHash, offerer, fulfiller, event } = eventData;

    try {
      logger.info('🎉 OrderFulfilled event detected:', {
        orderHash,
        offerer,
        fulfiller,
        blockNumber: event.log.blockNumber,
        transactionHash: event.log.transactionHash
      });

      // Get order from database
      const order = await this.orderService.getOrderByHash(orderHash);

      if (!order) {
        logger.warn('⚠️  Order not found in database:', { orderHash });
        return;
      }

      // Check if already fulfilled
      if (order.isFulfilled) {
        logger.info('ℹ️  Order already marked as fulfilled:', { orderHash });
        return;
      }

      // Prepare fulfillment data
      const fulfillmentData = {
        fulfiller: fulfiller,
        transactionHash: event.log.transactionHash,
        blockNumber: event.log.blockNumber,
        amountPaid: null, // Could be extracted from consideration items if needed
        platformFeePaid: null // Could be extracted from consideration items if needed
      };

      // Update order status in database (Requirement 6.2, 6.3, 6.4)
      logger.info('📝 Updating order status in database...');
      const result = await this.orderService.fulfillOrder(orderHash, fulfillmentData);

      if (result.success) {
        logger.info('✅ Order fulfillment recorded successfully:', {
          orderHash,
          fulfiller,
          transactionHash: event.log.transactionHash
        });

        // Broadcast fulfillment event via Socket.IO (Requirement 6.5)
        if (this.socketService) {
          this.broadcastFulfillmentEvent(result.order);
        } else {
          logger.warn('⚠️  Socket service not available, skipping WebSocket broadcast');
        }
      }

    } catch (error) {
      logger.error('❌ Error handling OrderFulfilled event:', {
        orderHash,
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Broadcast fulfillment event via WebSocket
   * Requirement: 6.5 - Broadcast fulfillment events
   * 
   * @param {Object} order - Fulfilled order
   */
  broadcastFulfillmentEvent(order) {
    try {
      if (!this.socketService) {
        logger.warn('Socket service not available for broadcasting');
        return;
      }

      const eventData = {
        orderHash: order.orderHash,
        orderType: order.orderType,
        tokenId: order.tokenId,
        nftContract: order.nftContract,
        maker: order.maker,
        fulfiller: order.fulfilledBy,
        transactionHash: order.fulfillmentTxHash,
        fulfilledAt: order.fulfilledAt
      };

      this.socketService.broadcastOrderFulfilled(eventData);

      logger.info('📡 Fulfillment event broadcasted via WebSocket:', {
        orderHash: order.orderHash,
        fulfiller: order.fulfilledBy
      });

    } catch (error) {
      logger.error('Error broadcasting fulfillment event:', error);
    }
  }

  /**
   * Get monitoring status
   */
  getStatus() {
    return {
      isMonitoring: this.isMonitoring,
      seaportContract: this.seaportContractAddress,
      chainId: this.chainId,
      wsRpcUrl: this.wsRpcUrl,
      reconnectAttempts: this.reconnectAttempts,
      hasWebSocketProvider: !!this.wsProvider,
      hasContract: !!this.seaportContract
    };
  }

  /**
   * Manual trigger for testing - process a specific transaction
   * 
   * @param {string} transactionHash - Transaction hash to process
   */
  async processTransaction(transactionHash) {
    try {
      logger.info('🔍 Manually processing transaction:', transactionHash);

      // Get transaction receipt
      const receipt = await this.provider.getTransactionReceipt(transactionHash);

      if (!receipt) {
        throw new Error('Transaction not found');
      }

      // Parse logs for OrderFulfilled events
      const iface = new ethers.Interface([
        'event OrderFulfilled(bytes32 orderHash, address indexed offerer, address indexed zone, address fulfiller, tuple(uint8 itemType, address token, uint256 identifier, uint256 amount)[] offer, tuple(uint8 itemType, address token, uint256 identifier, uint256 amount, address recipient)[] consideration)'
      ]);

      for (const log of receipt.logs) {
        if (log.address.toLowerCase() === this.seaportContractAddress.toLowerCase()) {
          try {
            const parsedLog = iface.parseLog(log);
            
            if (parsedLog && parsedLog.name === 'OrderFulfilled') {
              await this.handleOrderFulfilled({
                orderHash: parsedLog.args.orderHash,
                offerer: parsedLog.args.offerer,
                zone: parsedLog.args.zone,
                fulfiller: parsedLog.args.fulfiller,
                offer: parsedLog.args.offer,
                consideration: parsedLog.args.consideration,
                event: {
                  log: {
                    blockNumber: receipt.blockNumber,
                    transactionHash: receipt.hash
                  }
                }
              });
            }
          } catch (parseError) {
            // Not an OrderFulfilled event, skip
            continue;
          }
        }
      }

      logger.info('✅ Transaction processed successfully');

    } catch (error) {
      logger.error('Error processing transaction:', error);
      throw error;
    }
  }
}

// Singleton instance
let orderFulfillmentMonitorService = null;

function getOrderFulfillmentMonitorService() {
  if (!orderFulfillmentMonitorService) {
    orderFulfillmentMonitorService = new OrderFulfillmentMonitorService();
  }
  return orderFulfillmentMonitorService;
}

module.exports = {
  OrderFulfillmentMonitorService,
  getOrderFulfillmentMonitorService
};
