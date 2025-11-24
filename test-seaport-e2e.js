/**
 * End-to-End Test for Seaport Orderbook Backend Integration
 * 
 * Tests complete order lifecycle flows:
 * - Order creation flow
 * - Order fulfillment flow
 * - Order cancellation flow
 * - Real-time synchronization across multiple clients
 * - Cron job execution
 * 
 * Requirements: All
 */

const { ethers } = require('ethers');
const io = require('socket.io-client');
const axios = require('axios');
const logger = require('./src/utils/logger');
const { pool } = require('./src/config/database');

// Test configuration
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5000';
const WS_URL = process.env.TEST_WS_URL || 'http://localhost:5000';

// Test data
const TEST_NFT_CONTRACT = '0x1234567890123456789012345678901234567890';
const TEST_TOKEN_ID = '999';
const TEST_PAYMENT_TOKEN = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';

// Mock JWT token for testing (you'll need to generate a real one)
let TEST_JWT_TOKEN = null;

// Test wallet
let testWallet = null;
let testWallet2 = null;

/**
 * Setup test environment
 */
async function setup() {
  logger.info('🔧 Setting up test environment...');
  
  // Create test wallets
  testWallet = ethers.Wallet.createRandom();
  testWallet2 = ethers.Wallet.createRandom();
  
  logger.info('Test wallets created:', {
    wallet1: testWallet.address,
    wallet2: testWallet2.address
  });
  
  // Create test users in database
  try {
    await pool.query(`
      INSERT INTO users (para_user_id, wallet_address, display_name, created_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (para_user_id) DO NOTHING
    `, ['test-user-1', testWallet.address.toLowerCase(), 'Test User 1']);
    
    await pool.query(`
      INSERT INTO users (para_user_id, wallet_address, display_name, created_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (para_user_id) DO NOTHING
    `, ['test-user-2', testWallet2.address.toLowerCase(), 'Test User 2']);
    
    logger.info('✅ Test users created in database');
  } catch (error) {
    logger.warn('Test users may already exist:', error.message);
  }
  
  // Generate mock JWT tokens (in real scenario, get from auth endpoint)
  TEST_JWT_TOKEN = generateMockJWT('test-user-1', testWallet.address);
  
  logger.info('✅ Test environment setup complete');
}

/**
 * Cleanup test environment
 */
async function cleanup() {
  logger.info('🧹 Cleaning up test environment...');
  
  try {
    // Delete test orders
    await pool.query(`
      DELETE FROM seaport_orders 
      WHERE nft_contract = $1 AND token_id = $2
    `, [TEST_NFT_CONTRACT, TEST_TOKEN_ID]);
    
    logger.info('✅ Test data cleaned up');
  } catch (error) {
    logger.error('Cleanup error:', error);
  }
}

/**
 * Generate JWT token for testing
 */
function generateMockJWT(paraUserId, walletAddress) {
  const jwt = require('jsonwebtoken');
  const payload = {
    paraUserId,
    walletAddress: walletAddress.toLowerCase(),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
  };
  
  // Use JWT_SECRET from environment or a test secret
  const secret = process.env.JWT_SECRET || 'test-secret-key-for-e2e-tests';
  return jwt.sign(payload, secret);
}

/**
 * Create a test order with proper Seaport structure
 */
function createTestOrder(orderType, maker, tokenId) {
  const startTime = Math.floor(Date.now() / 1000);
  const endTime = startTime + 86400; // 24 hours from now
  
  const orderComponents = {
    offerer: maker,
    zone: ethers.ZeroAddress,
    offer: orderType === 'listing' ? [
      {
        itemType: 2, // ERC721
        token: TEST_NFT_CONTRACT,
        identifierOrCriteria: tokenId,
        startAmount: '1',
        endAmount: '1'
      }
    ] : [
      {
        itemType: 1, // ERC20
        token: TEST_PAYMENT_TOKEN,
        identifierOrCriteria: '0',
        startAmount: ethers.parseEther('1.0').toString(),
        endAmount: ethers.parseEther('1.0').toString()
      }
    ],
    consideration: orderType === 'listing' ? [
      {
        itemType: 1, // ERC20
        token: TEST_PAYMENT_TOKEN,
        identifierOrCriteria: '0',
        startAmount: ethers.parseEther('0.975').toString(),
        endAmount: ethers.parseEther('0.975').toString(),
        recipient: maker
      },
      {
        itemType: 1, // ERC20 - Platform fee
        token: TEST_PAYMENT_TOKEN,
        identifierOrCriteria: '0',
        startAmount: ethers.parseEther('0.025').toString(),
        endAmount: ethers.parseEther('0.025').toString(),
        recipient: process.env.PLATFORM_FEE_RECIPIENT || ethers.ZeroAddress
      }
    ] : [
      {
        itemType: 2, // ERC721
        token: TEST_NFT_CONTRACT,
        identifierOrCriteria: tokenId,
        startAmount: '1',
        endAmount: '1',
        recipient: maker
      }
    ],
    orderType: 0, // FULL_OPEN
    startTime: startTime.toString(),
    endTime: endTime.toString(),
    zoneHash: ethers.ZeroHash,
    salt: ethers.hexlify(ethers.randomBytes(32)),
    conduitKey: ethers.ZeroHash,
    counter: '0'
  };
  
  return orderComponents;
}

/**
 * Sign order using EIP-712
 */
async function signOrder(wallet, orderComponents) {
  const domain = {
    name: 'Seaport',
    version: '1.5',
    chainId: parseInt(process.env.SEAPORT_CHAIN_ID || '43113'),
    verifyingContract: process.env.SEAPORT_CONTRACT_ADDRESS || '0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC'
  };
  
  const types = {
    OrderComponents: [
      { name: 'offerer', type: 'address' },
      { name: 'zone', type: 'address' },
      { name: 'offer', type: 'OfferItem[]' },
      { name: 'consideration', type: 'ConsiderationItem[]' },
      { name: 'orderType', type: 'uint8' },
      { name: 'startTime', type: 'uint256' },
      { name: 'endTime', type: 'uint256' },
      { name: 'zoneHash', type: 'bytes32' },
      { name: 'salt', type: 'uint256' },
      { name: 'conduitKey', type: 'bytes32' },
      { name: 'counter', type: 'uint256' }
    ],
    OfferItem: [
      { name: 'itemType', type: 'uint8' },
      { name: 'token', type: 'address' },
      { name: 'identifierOrCriteria', type: 'uint256' },
      { name: 'startAmount', type: 'uint256' },
      { name: 'endAmount', type: 'uint256' }
    ],
    ConsiderationItem: [
      { name: 'itemType', type: 'uint8' },
      { name: 'token', type: 'address' },
      { name: 'identifierOrCriteria', type: 'uint256' },
      { name: 'startAmount', type: 'uint256' },
      { name: 'endAmount', type: 'uint256' },
      { name: 'recipient', type: 'address' }
    ]
  };
  
  const signature = await wallet.signTypedData(domain, types, orderComponents);
  return signature;
}

/**
 * Calculate order hash
 */
function calculateOrderHash(orderComponents) {
  const domain = {
    name: 'Seaport',
    version: '1.5',
    chainId: parseInt(process.env.SEAPORT_CHAIN_ID || '43113'),
    verifyingContract: process.env.SEAPORT_CONTRACT_ADDRESS || '0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC'
  };
  
  const types = {
    OrderComponents: [
      { name: 'offerer', type: 'address' },
      { name: 'zone', type: 'address' },
      { name: 'offer', type: 'OfferItem[]' },
      { name: 'consideration', type: 'ConsiderationItem[]' },
      { name: 'orderType', type: 'uint8' },
      { name: 'startTime', type: 'uint256' },
      { name: 'endTime', type: 'uint256' },
      { name: 'zoneHash', type: 'bytes32' },
      { name: 'salt', type: 'uint256' },
      { name: 'conduitKey', type: 'bytes32' },
      { name: 'counter', type: 'uint256' }
    ],
    OfferItem: [
      { name: 'itemType', type: 'uint8' },
      { name: 'token', type: 'address' },
      { name: 'identifierOrCriteria', type: 'uint256' },
      { name: 'startAmount', type: 'uint256' },
      { name: 'endAmount', type: 'uint256' }
    ],
    ConsiderationItem: [
      { name: 'itemType', type: 'uint8' },
      { name: 'token', type: 'address' },
      { name: 'identifierOrCriteria', type: 'uint256' },
      { name: 'startAmount', type: 'uint256' },
      { name: 'endAmount', type: 'uint256' },
      { name: 'recipient', type: 'address' }
    ]
  };
  
  return ethers.TypedDataEncoder.hash(domain, types, orderComponents);
}

/**
 * TEST 1: Complete Order Creation Flow
 * Requirements: 1.1, 2.1-2.7, 3.1, 4.1, 8.1
 */
async function testOrderCreationFlow() {
  logger.info('\n' + '='.repeat(80));
  logger.info('TEST 1: Complete Order Creation Flow');
  logger.info('='.repeat(80));
  
  try {
    // Create order components
    const orderComponents = createTestOrder('listing', testWallet.address, TEST_TOKEN_ID);
    
    // Sign order
    const signature = await signOrder(testWallet, orderComponents);
    const orderHash = calculateOrderHash(orderComponents);
    
    logger.info('📝 Created and signed order:', {
      orderHash: orderHash.substring(0, 10) + '...',
      maker: testWallet.address
    });
    
    // Prepare order data
    const orderData = {
      orderHash,
      orderType: 'listing',
      nftContract: TEST_NFT_CONTRACT,
      tokenId: TEST_TOKEN_ID,
      maker: testWallet.address,
      paymentToken: TEST_PAYMENT_TOKEN,
      price: ethers.parseEther('1.0').toString(),
      priceDecimal: '1.0',
      platformFeeAmount: ethers.parseEther('0.025').toString(),
      platformFeeRecipient: process.env.PLATFORM_FEE_RECIPIENT || ethers.ZeroAddress,
      startTime: parseInt(orderComponents.startTime),
      endTime: parseInt(orderComponents.endTime),
      orderComponents,
      signature
    };
    
    // Create order via API
    logger.info('📤 Sending order creation request...');
    const response = await axios.post(
      `${BASE_URL}/api/orders/listings/create`,
      orderData,
      {
        headers: {
          'Authorization': `Bearer ${TEST_JWT_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response.data.success) {
      logger.info('✅ Order created successfully:', {
        orderHash: response.data.order.orderHash.substring(0, 10) + '...',
        orderType: response.data.order.orderType,
        isActive: response.data.order.isActive
      });
      
      // Verify order in database
      const dbOrder = await pool.query(
        'SELECT * FROM seaport_orders WHERE order_hash = $1',
        [orderHash]
      );
      
      if (dbOrder.rows.length > 0) {
        logger.info('✅ Order verified in database');
        
        // Verify order event logged
        const event = await pool.query(
          'SELECT * FROM order_events WHERE order_hash = $1 AND event_type = $2',
          [orderHash, 'order:created']
        );
        
        if (event.rows.length > 0) {
          logger.info('✅ Order creation event logged');
        } else {
          logger.error('❌ Order creation event not logged');
          return false;
        }
      } else {
        logger.error('❌ Order not found in database');
        return false;
      }
      
      return { success: true, orderHash };
    } else {
      logger.error('❌ Order creation failed:', response.data);
      return false;
    }
    
  } catch (error) {
    logger.error('❌ Test failed:', error.response?.data || error.message);
    return false;
  }
}

/**
 * TEST 2: Complete Order Cancellation Flow
 * Requirements: 5.1-5.5, 4.2, 8.2
 */
async function testOrderCancellationFlow(orderHash) {
  logger.info('\n' + '='.repeat(80));
  logger.info('TEST 2: Complete Order Cancellation Flow');
  logger.info('='.repeat(80));
  
  try {
    logger.info('🗑️  Cancelling order:', orderHash.substring(0, 10) + '...');
    
    // Cancel order via API
    const response = await axios.delete(
      `${BASE_URL}/api/orders/${orderHash}/cancel`,
      {
        headers: {
          'Authorization': `Bearer ${TEST_JWT_TOKEN}`,
          'Content-Type': 'application/json'
        },
        data: {
          reason: 'E2E test cancellation'
        }
      }
    );
    
    if (response.data.success) {
      logger.info('✅ Order cancelled successfully:', {
        orderHash: response.data.order.orderHash.substring(0, 10) + '...',
        isCancelled: response.data.order.isCancelled,
        isActive: response.data.order.isActive
      });
      
      // Verify order status in database
      const dbOrder = await pool.query(
        'SELECT * FROM seaport_orders WHERE order_hash = $1',
        [orderHash]
      );
      
      if (dbOrder.rows.length > 0) {
        const order = dbOrder.rows[0];
        if (order.is_cancelled && !order.is_active) {
          logger.info('✅ Order status verified in database');
        } else {
          logger.error('❌ Order status incorrect in database');
          return false;
        }
        
        // Verify cancellation record
        const cancellation = await pool.query(
          'SELECT * FROM order_cancellations WHERE order_hash = $1',
          [orderHash]
        );
        
        if (cancellation.rows.length > 0) {
          logger.info('✅ Cancellation record created');
        } else {
          logger.error('❌ Cancellation record not found');
          return false;
        }
        
        // Verify cancellation event logged
        const event = await pool.query(
          'SELECT * FROM order_events WHERE order_hash = $1 AND event_type = $2',
          [orderHash, 'order:cancelled']
        );
        
        if (event.rows.length > 0) {
          logger.info('✅ Order cancellation event logged');
        } else {
          logger.error('❌ Order cancellation event not logged');
          return false;
        }
      } else {
        logger.error('❌ Order not found in database');
        return false;
      }
      
      return true;
    } else {
      logger.error('❌ Order cancellation failed:', response.data);
      return false;
    }
    
  } catch (error) {
    logger.error('❌ Test failed:', error.response?.data || error.message);
    return false;
  }
}

/**
 * TEST 3: Complete Order Fulfillment Flow
 * Requirements: 6.1-6.5, 4.3, 8.3
 */
async function testOrderFulfillmentFlow() {
  logger.info('\n' + '='.repeat(80));
  logger.info('TEST 3: Complete Order Fulfillment Flow');
  logger.info('='.repeat(80));
  
  try {
    // Create a new order for fulfillment test
    const orderComponents = createTestOrder('listing', testWallet.address, TEST_TOKEN_ID + '1');
    const signature = await signOrder(testWallet, orderComponents);
    const orderHash = calculateOrderHash(orderComponents);
    
    logger.info('📝 Creating order for fulfillment test...');
    
    const orderData = {
      orderHash,
      orderType: 'listing',
      nftContract: TEST_NFT_CONTRACT,
      tokenId: TEST_TOKEN_ID + '1',
      maker: testWallet.address,
      paymentToken: TEST_PAYMENT_TOKEN,
      price: ethers.parseEther('1.0').toString(),
      priceDecimal: '1.0',
      platformFeeAmount: ethers.parseEther('0.025').toString(),
      platformFeeRecipient: process.env.PLATFORM_FEE_RECIPIENT || ethers.ZeroAddress,
      startTime: parseInt(orderComponents.startTime),
      endTime: parseInt(orderComponents.endTime),
      orderComponents,
      signature
    };
    
    await axios.post(
      `${BASE_URL}/api/orders/listings/create`,
      orderData,
      {
        headers: {
          'Authorization': `Bearer ${TEST_JWT_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    logger.info('✅ Order created for fulfillment test');
    
    // Simulate order fulfillment
    logger.info('✅ Simulating order fulfillment...');
    
    const fulfillmentData = {
      fulfiller: testWallet2.address,
      transactionHash: ethers.hexlify(ethers.randomBytes(32)),
      blockNumber: 12345678,
      amountPaid: ethers.parseEther('1.0').toString(),
      platformFeePaid: ethers.parseEther('0.025').toString()
    };
    
    const response = await axios.post(
      `${BASE_URL}/api/orders/${orderHash}/fulfill`,
      fulfillmentData,
      {
        headers: {
          'Authorization': `Bearer ${TEST_JWT_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response.data.success) {
      logger.info('✅ Order fulfillment recorded:', {
        orderHash: response.data.order.orderHash.substring(0, 10) + '...',
        isFulfilled: response.data.order.isFulfilled,
        fulfilledBy: response.data.order.fulfilledBy
      });
      
      // Verify order status in database
      const dbOrder = await pool.query(
        'SELECT * FROM seaport_orders WHERE order_hash = $1',
        [orderHash]
      );
      
      if (dbOrder.rows.length > 0) {
        const order = dbOrder.rows[0];
        if (order.is_fulfilled && !order.is_active) {
          logger.info('✅ Order status verified in database');
        } else {
          logger.error('❌ Order status incorrect in database');
          return false;
        }
        
        // Verify fulfillment record
        const fulfillment = await pool.query(
          'SELECT * FROM order_fulfillments WHERE order_hash = $1',
          [orderHash]
        );
        
        if (fulfillment.rows.length > 0) {
          logger.info('✅ Fulfillment record created');
        } else {
          logger.error('❌ Fulfillment record not found');
          return false;
        }
        
        // Verify fulfillment event logged
        const event = await pool.query(
          'SELECT * FROM order_events WHERE order_hash = $1 AND event_type = $2',
          [orderHash, 'order:fulfilled']
        );
        
        if (event.rows.length > 0) {
          logger.info('✅ Order fulfillment event logged');
        } else {
          logger.error('❌ Order fulfillment event not logged');
          return false;
        }
      } else {
        logger.error('❌ Order not found in database');
        return false;
      }
      
      return true;
    } else {
      logger.error('❌ Order fulfillment failed:', response.data);
      return false;
    }
    
  } catch (error) {
    logger.error('❌ Test failed:', error.response?.data || error.message);
    return false;
  }
}

/**
 * TEST 4: Real-time Synchronization Across Multiple Clients
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */
async function testRealtimeSynchronization() {
  logger.info('\n' + '='.repeat(80));
  logger.info('TEST 4: Real-time Synchronization Across Multiple Clients');
  logger.info('='.repeat(80));
  
  return new Promise(async (resolve) => {
    try {
      const eventsReceived = {
        client1: { created: false, cancelled: false },
        client2: { created: false, cancelled: false }
      };
      
      // Create two WebSocket clients
      logger.info('🔌 Connecting WebSocket clients...');
      
      const client1 = io(`${WS_URL}/orders`, {
        auth: { token: TEST_JWT_TOKEN },
        transports: ['websocket']
      });
      
      const client2 = io(`${WS_URL}/orders`, {
        auth: { token: TEST_JWT_TOKEN },
        transports: ['websocket']
      });
      
      // Wait for connections
      await Promise.all([
        new Promise(resolve => client1.on('connect', resolve)),
        new Promise(resolve => client2.on('connect', resolve))
      ]);
      
      logger.info('✅ Both clients connected');
      
      // Join NFT room
      client1.emit('join-nft', {
        nftContract: TEST_NFT_CONTRACT,
        tokenId: TEST_TOKEN_ID + '2'
      });
      
      client2.emit('join-nft', {
        nftContract: TEST_NFT_CONTRACT,
        tokenId: TEST_TOKEN_ID + '2'
      });
      
      // Wait for room join confirmations
      await Promise.all([
        new Promise(resolve => client1.on('joined-nft', resolve)),
        new Promise(resolve => client2.on('joined-nft', resolve))
      ]);
      
      logger.info('✅ Both clients joined NFT room');
      
      // Set up event listeners
      client1.on('order:created', (data) => {
        logger.info('📡 Client 1 received order:created event:', data.orderHash.substring(0, 10) + '...');
        eventsReceived.client1.created = true;
      });
      
      client2.on('order:created', (data) => {
        logger.info('📡 Client 2 received order:created event:', data.orderHash.substring(0, 10) + '...');
        eventsReceived.client2.created = true;
      });
      
      client1.on('order:cancelled', (data) => {
        logger.info('📡 Client 1 received order:cancelled event:', data.orderHash.substring(0, 10) + '...');
        eventsReceived.client1.cancelled = true;
      });
      
      client2.on('order:cancelled', (data) => {
        logger.info('📡 Client 2 received order:cancelled event:', data.orderHash.substring(0, 10) + '...');
        eventsReceived.client2.cancelled = true;
      });
      
      // Create an order
      logger.info('📝 Creating order to test real-time sync...');
      
      const orderComponents = createTestOrder('listing', testWallet.address, TEST_TOKEN_ID + '2');
      const signature = await signOrder(testWallet, orderComponents);
      const orderHash = calculateOrderHash(orderComponents);
      
      const orderData = {
        orderHash,
        orderType: 'listing',
        nftContract: TEST_NFT_CONTRACT,
        tokenId: TEST_TOKEN_ID + '2',
        maker: testWallet.address,
        paymentToken: TEST_PAYMENT_TOKEN,
        price: ethers.parseEther('1.0').toString(),
        priceDecimal: '1.0',
        platformFeeAmount: ethers.parseEther('0.025').toString(),
        platformFeeRecipient: process.env.PLATFORM_FEE_RECIPIENT || ethers.ZeroAddress,
        startTime: parseInt(orderComponents.startTime),
        endTime: parseInt(orderComponents.endTime),
        orderComponents,
        signature
      };
      
      await axios.post(
        `${BASE_URL}/api/orders/listings/create`,
        orderData,
        {
          headers: {
            'Authorization': `Bearer ${TEST_JWT_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      // Wait for events to be received
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Cancel the order
      logger.info('🗑️  Cancelling order to test real-time sync...');
      
      await axios.delete(
        `${BASE_URL}/api/orders/${orderHash}/cancel`,
        {
          headers: {
            'Authorization': `Bearer ${TEST_JWT_TOKEN}`,
            'Content-Type': 'application/json'
          },
          data: { reason: 'E2E test' }
        }
      );
      
      // Wait for events to be received
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verify all events were received
      const allEventsReceived = 
        eventsReceived.client1.created &&
        eventsReceived.client1.cancelled &&
        eventsReceived.client2.created &&
        eventsReceived.client2.cancelled;
      
      if (allEventsReceived) {
        logger.info('✅ All real-time events received by both clients');
      } else {
        logger.error('❌ Some events were not received:', eventsReceived);
      }
      
      // Cleanup
      client1.disconnect();
      client2.disconnect();
      
      resolve(allEventsReceived);
      
    } catch (error) {
      logger.error('❌ Test failed:', error.message);
      resolve(false);
    }
  });
}

/**
 * TEST 5: Cron Job Execution
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */
async function testCronJobExecution() {
  logger.info('\n' + '='.repeat(80));
  logger.info('TEST 5: Cron Job Execution');
  logger.info('='.repeat(80));
  
  try {
    // Create an expired order
    logger.info('📝 Creating expired order for cron test...');
    
    const pastTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
    const orderComponents = createTestOrder('listing', testWallet.address, TEST_TOKEN_ID + '3');
    orderComponents.startTime = (pastTime - 7200).toString(); // 2 hours ago
    orderComponents.endTime = pastTime.toString(); // 1 hour ago (expired)
    
    const signature = await signOrder(testWallet, orderComponents);
    const orderHash = calculateOrderHash(orderComponents);
    
    // Insert directly into database (bypassing validation)
    await pool.query(`
      INSERT INTO seaport_orders (
        order_hash, order_type, nft_contract, token_id, maker,
        payment_token, price, price_decimal, start_time, end_time,
        expires_at, order_components, signature, is_active, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true, CURRENT_TIMESTAMP)
    `, [
      orderHash,
      'listing',
      TEST_NFT_CONTRACT,
      TEST_TOKEN_ID + '3',
      testWallet.address,
      TEST_PAYMENT_TOKEN,
      ethers.parseEther('1.0').toString(),
      '1.0',
      parseInt(orderComponents.startTime),
      parseInt(orderComponents.endTime),
      new Date(parseInt(orderComponents.endTime) * 1000),
      JSON.stringify(orderComponents),
      signature
    ]);
    
    logger.info('✅ Expired order created in database');
    
    // Verify order is active before cleanup
    const beforeCleanup = await pool.query(
      'SELECT is_active FROM seaport_orders WHERE order_hash = $1',
      [orderHash]
    );
    
    if (beforeCleanup.rows[0].is_active) {
      logger.info('✅ Order is active before cleanup');
    } else {
      logger.error('❌ Order should be active before cleanup');
      return false;
    }
    
    // Trigger cron job manually
    logger.info('⏰ Triggering order cleanup cron job...');
    
    const { getOrderCleanupCronService } = require('./src/services/OrderCleanupCronService');
    const cronService = getOrderCleanupCronService();
    const result = await cronService.triggerManually();
    
    logger.info('📊 Cleanup result:', {
      cleanedUp: result.cleanedUp,
      activeListings: result.activeListings,
      activeOffers: result.activeOffers
    });
    
    // Verify order is now inactive
    const afterCleanup = await pool.query(
      'SELECT is_active FROM seaport_orders WHERE order_hash = $1',
      [orderHash]
    );
    
    if (!afterCleanup.rows[0].is_active) {
      logger.info('✅ Order is inactive after cleanup');
    } else {
      logger.error('❌ Order should be inactive after cleanup');
      return false;
    }
    
    // Verify cleanup event was logged
    const event = await pool.query(
      'SELECT * FROM order_events WHERE order_hash = $1 AND event_type = $2',
      [orderHash, 'order:expired']
    );
    
    if (event.rows.length > 0) {
      logger.info('✅ Order expiration event logged');
    } else {
      logger.error('❌ Order expiration event not logged');
      return false;
    }
    
    return true;
    
  } catch (error) {
    logger.error('❌ Test failed:', error.message);
    return false;
  }
}

/**
 * Main test runner
 */
async function runE2ETests() {
  logger.info('\n' + '█'.repeat(80));
  logger.info('🧪 SEAPORT ORDERBOOK END-TO-END TESTS');
  logger.info('█'.repeat(80));
  
  const results = {
    orderCreation: false,
    orderCancellation: false,
    orderFulfillment: false,
    realtimeSync: false,
    cronJob: false
  };
  
  let createdOrderHash = null;
  
  try {
    // Setup
    await setup();
    
    // Test 1: Order Creation Flow
    const creationResult = await testOrderCreationFlow();
    if (creationResult && creationResult.success) {
      results.orderCreation = true;
      createdOrderHash = creationResult.orderHash;
    }
    
    // Test 2: Order Cancellation Flow (using order from Test 1)
    if (createdOrderHash) {
      results.orderCancellation = await testOrderCancellationFlow(createdOrderHash);
    } else {
      logger.warn('⚠️  Skipping cancellation test - no order created');
    }
    
    // Test 3: Order Fulfillment Flow
    results.orderFulfillment = await testOrderFulfillmentFlow();
    
    // Test 4: Real-time Synchronization
    results.realtimeSync = await testRealtimeSynchronization();
    
    // Test 5: Cron Job Execution
    results.cronJob = await testCronJobExecution();
    
    // Cleanup
    await cleanup();
    
    // Print summary
    logger.info('\n' + '█'.repeat(80));
    logger.info('📊 TEST SUMMARY');
    logger.info('█'.repeat(80));
    
    const tests = [
      { name: 'Order Creation Flow', result: results.orderCreation },
      { name: 'Order Cancellation Flow', result: results.orderCancellation },
      { name: 'Order Fulfillment Flow', result: results.orderFulfillment },
      { name: 'Real-time Synchronization', result: results.realtimeSync },
      { name: 'Cron Job Execution', result: results.cronJob }
    ];
    
    tests.forEach(test => {
      const status = test.result ? '✅ PASS' : '❌ FAIL';
      logger.info(`${status} - ${test.name}`);
    });
    
    const passedTests = tests.filter(t => t.result).length;
    const totalTests = tests.length;
    
    logger.info('\n' + '─'.repeat(80));
    logger.info(`TOTAL: ${passedTests}/${totalTests} tests passed`);
    logger.info('─'.repeat(80));
    
    if (passedTests === totalTests) {
      logger.info('🎉 ALL TESTS PASSED!');
      process.exit(0);
    } else {
      logger.error('❌ SOME TESTS FAILED');
      process.exit(1);
    }
    
  } catch (error) {
    logger.error('❌ Test suite failed:', error);
    await cleanup();
    process.exit(1);
  }
}

// Run tests
if (require.main === module) {
  runE2ETests().catch(error => {
    logger.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  runE2ETests,
  testOrderCreationFlow,
  testOrderCancellationFlow,
  testOrderFulfillmentFlow,
  testRealtimeSynchronization,
  testCronJobExecution
};
