require('dotenv').config();
const { pool } = require('./src/config/database');
const { getOrderService } = require('./src/services/OrderService');
const { getOrderCleanupCronService } = require('./src/services/OrderCleanupCronService');
const logger = require('./src/utils/logger');
const io = require('socket.io-client');

/**
 * Performance Testing Suite for Seaport Orderbook Backend
 * 
 * Tests:
 * 1. Database query performance with large datasets
 * 2. WebSocket scalability with multiple connections
 * 3. Cron job performance
 * 4. Query optimization recommendations
 * 
 * Requirements: All
 */

const PERFORMANCE_THRESHOLDS = {
  singleQuery: 100, // ms
  bulkQuery: 500, // ms
  largeDatasetQuery: 1000, // ms
  cronJobExecution: 5000, // ms
  websocketConnection: 200, // ms
  websocketBroadcast: 500 // ms
};

const TEST_CONFIG = {
  smallDataset: 100,
  mediumDataset: 1000,
  largeDataset: 10000,
  websocketClients: 50,
  concurrentQueries: 100
};

class PerformanceTestRunner {
  constructor() {
    this.results = {
      databaseTests: [],
      websocketTests: [],
      cronTests: [],
      optimizationRecommendations: []
    };
    this.orderService = null;
    this.cleanupService = null;
  }

  async initialize() {
    logger.info('🚀 Initializing Performance Test Suite...');
    this.orderService = getOrderService();
    await this.orderService.initialize();
    this.cleanupService = getOrderCleanupCronService();
    logger.info('✅ Services initialized');
  }

  // ==================== DATABASE PERFORMANCE TESTS ====================

  async testDatabasePerformance() {
    logger.info('\n' + '='.repeat(80));
    logger.info('📊 DATABASE PERFORMANCE TESTS');
    logger.info('='.repeat(80));

    await this.testSingleOrderQuery();
    await this.testBulkOrderQueries();
    await this.testLargeDatasetQueries();
    await this.testConcurrentQueries();
    await this.testComplexJoinQueries();
    await this.testIndexEffectiveness();
  }

  async testSingleOrderQuery() {
    logger.info('\n🔍 Test 1: Single Order Query Performance');
    
    try {
      // Create a test order first
      const testOrder = await this.createTestOrder('listing', '1');
      
      const iterations = 100;
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await this.orderService.getOrderByHash(testOrder.orderHash);
        const duration = Date.now() - start;
        times.push(duration);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);

      const passed = avgTime < PERFORMANCE_THRESHOLDS.singleQuery;

      this.results.databaseTests.push({
        test: 'Single Order Query',
        iterations,
        avgTime: `${avgTime.toFixed(2)}ms`,
        minTime: `${minTime}ms`,
        maxTime: `${maxTime}ms`,
        threshold: `${PERFORMANCE_THRESHOLDS.singleQuery}ms`,
        passed
      });

      logger.info(`  Average: ${avgTime.toFixed(2)}ms`);
      logger.info(`  Min: ${minTime}ms, Max: ${maxTime}ms`);
      logger.info(`  Status: ${passed ? '✅ PASSED' : '❌ FAILED'}`);

      // Cleanup
      await this.deleteTestOrder(testOrder.orderHash);

    } catch (error) {
      logger.error('  ❌ Test failed:', error.message);
      this.results.databaseTests.push({
        test: 'Single Order Query',
        error: error.message,
        passed: false
      });
    }
  }

  async testBulkOrderQueries() {
    logger.info('\n🔍 Test 2: Bulk Order Queries (100 orders)');
    
    try {
      // Create 100 test orders
      const orders = [];
      for (let i = 0; i < TEST_CONFIG.smallDataset; i++) {
        const order = await this.createTestOrder(
          i % 2 === 0 ? 'listing' : 'offer',
          `${i}`
        );
        orders.push(order);
      }

      logger.info(`  Created ${orders.length} test orders`);

      // Test getMarketplaceOrders
      const start = Date.now();
      const result = await this.orderService.getMarketplaceOrders({
        limit: 100,
        offset: 0
      });
      const duration = Date.now() - start;

      const passed = duration < PERFORMANCE_THRESHOLDS.bulkQuery;

      this.results.databaseTests.push({
        test: 'Bulk Order Query (100 orders)',
        ordersCreated: orders.length,
        ordersRetrieved: result.orders.length,
        duration: `${duration}ms`,
        threshold: `${PERFORMANCE_THRESHOLDS.bulkQuery}ms`,
        passed
      });

      logger.info(`  Retrieved ${result.orders.length} orders in ${duration}ms`);
      logger.info(`  Status: ${passed ? '✅ PASSED' : '❌ FAILED'}`);

      // Cleanup
      for (const order of orders) {
        await this.deleteTestOrder(order.orderHash);
      }

    } catch (error) {
      logger.error('  ❌ Test failed:', error.message);
      this.results.databaseTests.push({
        test: 'Bulk Order Query',
        error: error.message,
        passed: false
      });
    }
  }

  async testLargeDatasetQueries() {
    logger.info('\n🔍 Test 3: Large Dataset Queries (1000 orders)');
    
    try {
      // Create 1000 test orders
      logger.info('  Creating 1000 test orders...');
      const orders = [];
      const batchSize = 50;
      
      for (let batch = 0; batch < TEST_CONFIG.mediumDataset / batchSize; batch++) {
        const batchOrders = await Promise.all(
          Array.from({ length: batchSize }, (_, i) => {
            const idx = batch * batchSize + i;
            return this.createTestOrder(
              idx % 2 === 0 ? 'listing' : 'offer',
              `${idx}`
            );
          })
        );
        orders.push(...batchOrders);
        
        if ((batch + 1) % 5 === 0) {
          logger.info(`    Progress: ${orders.length}/${TEST_CONFIG.mediumDataset}`);
        }
      }

      logger.info(`  ✅ Created ${orders.length} test orders`);

      // Test various query patterns
      const queryTests = [
        {
          name: 'Get all marketplace orders',
          fn: () => this.orderService.getMarketplaceOrders({ limit: 100, offset: 0 })
        },
        {
          name: 'Get listings only',
          fn: () => this.orderService.getMarketplaceOrders({ orderType: 'listing', limit: 100 })
        },
        {
          name: 'Get offers only',
          fn: () => this.orderService.getMarketplaceOrders({ orderType: 'offer', limit: 100 })
        },
        {
          name: 'Get offers for token (sorted by price)',
          fn: () => this.orderService.getOffersForToken('0', process.env.NFT_CONTRACT_ADDRESS || '0x1234567890123456789012345678901234567890', { sort: 'price_desc' })
        }
      ];

      for (const test of queryTests) {
        const start = Date.now();
        const result = await test.fn();
        const duration = Date.now() - start;
        const passed = duration < PERFORMANCE_THRESHOLDS.largeDatasetQuery;

        this.results.databaseTests.push({
          test: `Large Dataset - ${test.name}`,
          datasetSize: orders.length,
          duration: `${duration}ms`,
          threshold: `${PERFORMANCE_THRESHOLDS.largeDatasetQuery}ms`,
          passed
        });

        logger.info(`  ${test.name}: ${duration}ms ${passed ? '✅' : '❌'}`);
      }

      // Cleanup
      logger.info('  Cleaning up test orders...');
      for (let i = 0; i < orders.length; i += batchSize) {
        const batch = orders.slice(i, i + batchSize);
        await Promise.all(batch.map(order => this.deleteTestOrder(order.orderHash)));
        
        if ((i + batchSize) % 250 === 0) {
          logger.info(`    Cleanup progress: ${i + batchSize}/${orders.length}`);
        }
      }
      logger.info('  ✅ Cleanup complete');

    } catch (error) {
      logger.error('  ❌ Test failed:', error.message);
      this.results.databaseTests.push({
        test: 'Large Dataset Queries',
        error: error.message,
        passed: false
      });
    }
  }

  async testConcurrentQueries() {
    logger.info('\n🔍 Test 4: Concurrent Query Performance (100 simultaneous queries)');
    
    try {
      // Create test orders
      const orders = [];
      for (let i = 0; i < 50; i++) {
        const order = await this.createTestOrder('listing', `${i}`);
        orders.push(order);
      }

      // Execute 100 concurrent queries
      const start = Date.now();
      const promises = Array.from({ length: TEST_CONFIG.concurrentQueries }, (_, i) => {
        const orderHash = orders[i % orders.length].orderHash;
        return this.orderService.getOrderByHash(orderHash);
      });

      await Promise.all(promises);
      const duration = Date.now() - start;
      const avgPerQuery = duration / TEST_CONFIG.concurrentQueries;

      const passed = avgPerQuery < PERFORMANCE_THRESHOLDS.singleQuery;

      this.results.databaseTests.push({
        test: 'Concurrent Queries',
        concurrentQueries: TEST_CONFIG.concurrentQueries,
        totalDuration: `${duration}ms`,
        avgPerQuery: `${avgPerQuery.toFixed(2)}ms`,
        threshold: `${PERFORMANCE_THRESHOLDS.singleQuery}ms`,
        passed
      });

      logger.info(`  Total: ${duration}ms for ${TEST_CONFIG.concurrentQueries} queries`);
      logger.info(`  Average per query: ${avgPerQuery.toFixed(2)}ms`);
      logger.info(`  Status: ${passed ? '✅ PASSED' : '❌ FAILED'}`);

      // Cleanup
      for (const order of orders) {
        await this.deleteTestOrder(order.orderHash);
      }

    } catch (error) {
      logger.error('  ❌ Test failed:', error.message);
      this.results.databaseTests.push({
        test: 'Concurrent Queries',
        error: error.message,
        passed: false
      });
    }
  }

  async testComplexJoinQueries() {
    logger.info('\n🔍 Test 5: Complex Join Queries (with fulfillments and events)');
    
    try {
      // Create test order and fulfillment
      const order = await this.createTestOrder('listing', '1');
      
      // Simulate fulfillment
      await this.orderService.fulfillOrder(order.orderHash, {
        fulfiller: '0x' + '2'.repeat(40),
        transactionHash: '0x' + 'a'.repeat(64),
        blockNumber: 12345,
        amountPaid: '1000000000000000000',
        platformFeePaid: '25000000000000000'
      });

      // Test query with joins
      const start = Date.now();
      const query = `
        SELECT o.*, 
               f.fulfiller, f.transaction_hash, f.block_number,
               COUNT(e.id) as event_count
        FROM seaport_orders o
        LEFT JOIN order_fulfillments f ON o.order_hash = f.order_hash
        LEFT JOIN order_events e ON o.order_hash = e.order_hash
        WHERE o.order_hash = $1
        GROUP BY o.order_hash, f.id
      `;
      
      const result = await pool.query(query, [order.orderHash]);
      const duration = Date.now() - start;

      const passed = duration < PERFORMANCE_THRESHOLDS.singleQuery;

      this.results.databaseTests.push({
        test: 'Complex Join Query',
        duration: `${duration}ms`,
        threshold: `${PERFORMANCE_THRESHOLDS.singleQuery}ms`,
        passed
      });

      logger.info(`  Duration: ${duration}ms`);
      logger.info(`  Status: ${passed ? '✅ PASSED' : '❌ FAILED'}`);

      // Cleanup
      await this.deleteTestOrder(order.orderHash);

    } catch (error) {
      logger.error('  ❌ Test failed:', error.message);
      this.results.databaseTests.push({
        test: 'Complex Join Query',
        error: error.message,
        passed: false
      });
    }
  }

  async testIndexEffectiveness() {
    logger.info('\n🔍 Test 6: Index Effectiveness Analysis');
    
    try {
      // Create test dataset
      const orders = [];
      for (let i = 0; i < 100; i++) {
        const order = await this.createTestOrder(
          i % 2 === 0 ? 'listing' : 'offer',
          `${i}`
        );
        orders.push(order);
      }

      // Test queries that should use indexes
      const indexTests = [
        {
          name: 'Query by token_id (indexed)',
          query: 'SELECT * FROM seaport_orders WHERE token_id = $1 AND is_active = true',
          params: ['0']
        },
        {
          name: 'Query by maker (indexed)',
          query: 'SELECT * FROM seaport_orders WHERE maker = $1 AND is_active = true',
          params: ['0x' + '1'.repeat(40)]
        },
        {
          name: 'Query by order_type (indexed)',
          query: 'SELECT * FROM seaport_orders WHERE order_type = $1 AND is_active = true',
          params: ['listing']
        },
        {
          name: 'Query by expires_at (indexed)',
          query: 'SELECT * FROM seaport_orders WHERE expires_at > CURRENT_TIMESTAMP AND is_active = true',
          params: []
        }
      ];

      for (const test of indexTests) {
        const start = Date.now();
        await pool.query(test.query, test.params);
        const duration = Date.now() - start;

        logger.info(`  ${test.name}: ${duration}ms`);
        
        // Get query plan
        const explainQuery = 'EXPLAIN ' + test.query;
        const plan = await pool.query(explainQuery, test.params);
        const usesIndex = plan.rows.some(row => 
          row['QUERY PLAN'].includes('Index Scan') || 
          row['QUERY PLAN'].includes('Index Only Scan')
        );

        this.results.databaseTests.push({
          test: `Index Test - ${test.name}`,
          duration: `${duration}ms`,
          usesIndex,
          passed: usesIndex
        });

        logger.info(`    Uses Index: ${usesIndex ? '✅ YES' : '❌ NO'}`);
      }

      // Cleanup
      for (const order of orders) {
        await this.deleteTestOrder(order.orderHash);
      }

    } catch (error) {
      logger.error('  ❌ Test failed:', error.message);
      this.results.databaseTests.push({
        test: 'Index Effectiveness',
        error: error.message,
        passed: false
      });
    }
  }

  // ==================== WEBSOCKET PERFORMANCE TESTS ====================

  async testWebSocketPerformance() {
    logger.info('\n' + '='.repeat(80));
    logger.info('🔌 WEBSOCKET PERFORMANCE TESTS');
    logger.info('='.repeat(80));

    await this.testWebSocketConnections();
    await this.testWebSocketBroadcast();
    await this.testWebSocketScalability();
  }

  async testWebSocketConnections() {
    logger.info('\n🔍 Test 7: WebSocket Connection Performance');
    
    try {
      const serverUrl = process.env.SERVER_URL || 'http://localhost:3000';
      const clients = [];
      const connectionTimes = [];

      logger.info(`  Connecting ${TEST_CONFIG.websocketClients} clients...`);

      for (let i = 0; i < TEST_CONFIG.websocketClients; i++) {
        const start = Date.now();
        
        const client = io(serverUrl, {
          transports: ['websocket'],
          reconnection: false
        });

        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Connection timeout'));
          }, 5000);

          client.on('connect', () => {
            clearTimeout(timeout);
            const duration = Date.now() - start;
            connectionTimes.push(duration);
            resolve();
          });

          client.on('connect_error', (error) => {
            clearTimeout(timeout);
            reject(error);
          });
        });

        clients.push(client);

        if ((i + 1) % 10 === 0) {
          logger.info(`    Connected: ${i + 1}/${TEST_CONFIG.websocketClients}`);
        }
      }

      const avgConnectionTime = connectionTimes.reduce((a, b) => a + b, 0) / connectionTimes.length;
      const maxConnectionTime = Math.max(...connectionTimes);
      const passed = avgConnectionTime < PERFORMANCE_THRESHOLDS.websocketConnection;

      this.results.websocketTests.push({
        test: 'WebSocket Connections',
        clients: TEST_CONFIG.websocketClients,
        avgConnectionTime: `${avgConnectionTime.toFixed(2)}ms`,
        maxConnectionTime: `${maxConnectionTime}ms`,
        threshold: `${PERFORMANCE_THRESHOLDS.websocketConnection}ms`,
        passed
      });

      logger.info(`  Average connection time: ${avgConnectionTime.toFixed(2)}ms`);
      logger.info(`  Max connection time: ${maxConnectionTime}ms`);
      logger.info(`  Status: ${passed ? '✅ PASSED' : '❌ FAILED'}`);

      // Cleanup
      clients.forEach(client => client.disconnect());

    } catch (error) {
      logger.error('  ❌ Test failed:', error.message);
      this.results.websocketTests.push({
        test: 'WebSocket Connections',
        error: error.message,
        passed: false
      });
    }
  }

  async testWebSocketBroadcast() {
    logger.info('\n🔍 Test 8: WebSocket Broadcast Performance');
    
    try {
      const serverUrl = process.env.SERVER_URL || 'http://localhost:3000';
      const numClients = 20;
      const clients = [];
      const receivedMessages = [];

      logger.info(`  Setting up ${numClients} clients...`);

      // Connect clients
      for (let i = 0; i < numClients; i++) {
        const client = io(serverUrl, {
          transports: ['websocket'],
          reconnection: false
        });

        await new Promise((resolve) => {
          client.on('connect', resolve);
        });

        clients.push(client);
      }

      logger.info(`  ✅ ${numClients} clients connected`);

      // Set up listeners
      const messagePromises = clients.map((client, index) => {
        return new Promise((resolve) => {
          client.on('order:created', (data) => {
            receivedMessages.push({
              clientIndex: index,
              timestamp: Date.now(),
              data
            });
            resolve();
          });
        });
      });

      // Broadcast test message
      logger.info('  Broadcasting test message...');
      const broadcastStart = Date.now();
      
      // Simulate order creation broadcast
      const testOrder = {
        orderHash: '0x' + 'test'.repeat(16),
        orderType: 'listing',
        tokenId: '999',
        nftContract: '0x' + '1'.repeat(40),
        maker: '0x' + '2'.repeat(40),
        price: '1000000000000000000',
        paymentToken: '0x' + '3'.repeat(40)
      };

      // Emit from server (we'll need to trigger this through the API)
      // For now, we'll measure the theoretical broadcast time
      
      await Promise.race([
        Promise.all(messagePromises),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Broadcast timeout')), 5000))
      ]);

      const broadcastDuration = Date.now() - broadcastStart;
      const passed = broadcastDuration < PERFORMANCE_THRESHOLDS.websocketBroadcast;

      this.results.websocketTests.push({
        test: 'WebSocket Broadcast',
        clients: numClients,
        messagesReceived: receivedMessages.length,
        duration: `${broadcastDuration}ms`,
        threshold: `${PERFORMANCE_THRESHOLDS.websocketBroadcast}ms`,
        passed
      });

      logger.info(`  Messages received: ${receivedMessages.length}/${numClients}`);
      logger.info(`  Broadcast duration: ${broadcastDuration}ms`);
      logger.info(`  Status: ${passed ? '✅ PASSED' : '❌ FAILED'}`);

      // Cleanup
      clients.forEach(client => client.disconnect());

    } catch (error) {
      logger.error('  ❌ Test failed:', error.message);
      this.results.websocketTests.push({
        test: 'WebSocket Broadcast',
        error: error.message,
        passed: false
      });
    }
  }

  async testWebSocketScalability() {
    logger.info('\n🔍 Test 9: WebSocket Scalability Test');
    
    try {
      const serverUrl = process.env.SERVER_URL || 'http://localhost:3000';
      const scalabilityTests = [10, 25, 50];
      
      for (const numClients of scalabilityTests) {
        logger.info(`  Testing with ${numClients} clients...`);
        
        const clients = [];
        const start = Date.now();

        // Connect all clients
        for (let i = 0; i < numClients; i++) {
          const client = io(serverUrl, {
            transports: ['websocket'],
            reconnection: false
          });

          await new Promise((resolve) => {
            client.on('connect', resolve);
          });

          clients.push(client);
        }

        const connectionTime = Date.now() - start;
        const avgPerClient = connectionTime / numClients;

        logger.info(`    Connection time: ${connectionTime}ms (${avgPerClient.toFixed(2)}ms per client)`);

        // Test message throughput
        let messagesReceived = 0;
        clients.forEach(client => {
          client.on('order:created', () => messagesReceived++);
        });

        // Simulate some activity
        await new Promise(resolve => setTimeout(resolve, 1000));

        this.results.websocketTests.push({
          test: `WebSocket Scalability - ${numClients} clients`,
          clients: numClients,
          connectionTime: `${connectionTime}ms`,
          avgPerClient: `${avgPerClient.toFixed(2)}ms`,
          passed: avgPerClient < PERFORMANCE_THRESHOLDS.websocketConnection
        });

        // Cleanup
        clients.forEach(client => client.disconnect());
        
        // Wait before next test
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      logger.info('  ✅ Scalability tests complete');

    } catch (error) {
      logger.error('  ❌ Test failed:', error.message);
      this.results.websocketTests.push({
        test: 'WebSocket Scalability',
        error: error.message,
        passed: false
      });
    }
  }

  // ==================== CRON JOB PERFORMANCE TESTS ====================

  async testCronJobPerformance() {
    logger.info('\n' + '='.repeat(80));
    logger.info('⏰ CRON JOB PERFORMANCE TESTS');
    logger.info('='.repeat(80));

    await this.testCleanupCronPerformance();
    await this.testCleanupCronScalability();
  }

  async testCleanupCronPerformance() {
    logger.info('\n🔍 Test 10: Cleanup Cron Job Performance');
    
    try {
      // Create expired orders
      const expiredOrders = [];
      const expiredTime = new Date(Date.now() - 3600000); // 1 hour ago

      logger.info('  Creating 100 expired orders...');
      
      for (let i = 0; i < 100; i++) {
        const order = await this.createExpiredTestOrder('listing', `${i}`, expiredTime);
        expiredOrders.push(order);
      }

      logger.info('  ✅ Expired orders created');

      // Run cleanup
      logger.info('  Running cleanup cron job...');
      const start = Date.now();
      const result = await this.cleanupService.cleanupExpiredOrders();
      const duration = Date.now() - start;

      const passed = duration < PERFORMANCE_THRESHOLDS.cronJobExecution;

      this.results.cronTests.push({
        test: 'Cleanup Cron Job',
        expiredOrders: 100,
        cleanedUp: result.cleanedUp,
        duration: `${duration}ms`,
        threshold: `${PERFORMANCE_THRESHOLDS.cronJobExecution}ms`,
        passed
      });

      logger.info(`  Cleaned up: ${result.cleanedUp} orders`);
      logger.info(`  Duration: ${duration}ms`);
      logger.info(`  Status: ${passed ? '✅ PASSED' : '❌ FAILED'}`);

      // Cleanup
      for (const order of expiredOrders) {
        await this.deleteTestOrder(order.orderHash);
      }

    } catch (error) {
      logger.error('  ❌ Test failed:', error.message);
      this.results.cronTests.push({
        test: 'Cleanup Cron Job',
        error: error.message,
        passed: false
      });
    }
  }

  async testCleanupCronScalability() {
    logger.info('\n🔍 Test 11: Cleanup Cron Job Scalability');
    
    try {
      const testSizes = [100, 500, 1000];
      
      for (const size of testSizes) {
        logger.info(`  Testing with ${size} expired orders...`);
        
        const expiredOrders = [];
        const expiredTime = new Date(Date.now() - 3600000);

        // Create expired orders in batches
        const batchSize = 50;
        for (let i = 0; i < size; i += batchSize) {
          const batch = await Promise.all(
            Array.from({ length: Math.min(batchSize, size - i) }, (_, j) => 
              this.createExpiredTestOrder('listing', `${i + j}`, expiredTime)
            )
          );
          expiredOrders.push(...batch);
        }

        // Run cleanup
        const start = Date.now();
        const result = await this.cleanupService.cleanupExpiredOrders();
        const duration = Date.now() - start;

        const passed = duration < PERFORMANCE_THRESHOLDS.cronJobExecution;

        this.results.cronTests.push({
          test: `Cleanup Cron Scalability - ${size} orders`,
          expiredOrders: size,
          cleanedUp: result.cleanedUp,
          duration: `${duration}ms`,
          threshold: `${PERFORMANCE_THRESHOLDS.cronJobExecution}ms`,
          passed
        });

        logger.info(`    Cleaned up: ${result.cleanedUp} orders in ${duration}ms`);
        logger.info(`    Status: ${passed ? '✅ PASSED' : '❌ FAILED'}`);

        // Cleanup
        for (const order of expiredOrders) {
          await this.deleteTestOrder(order.orderHash);
        }

        // Wait before next test
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      logger.info('  ✅ Scalability tests complete');

    } catch (error) {
      logger.error('  ❌ Test failed:', error.message);
      this.results.cronTests.push({
        test: 'Cleanup Cron Scalability',
        error: error.message,
        passed: false
      });
    }
  }

  // ==================== OPTIMIZATION ANALYSIS ====================

  async analyzeOptimizations() {
    logger.info('\n' + '='.repeat(80));
    logger.info('🔧 OPTIMIZATION ANALYSIS');
    logger.info('='.repeat(80));

    await this.analyzeSlowQueries();
    await this.analyzeMissingIndexes();
    await this.analyzeTableStatistics();
    await this.generateOptimizationRecommendations();
  }

  async analyzeSlowQueries() {
    logger.info('\n🔍 Analyzing Slow Queries...');
    
    try {
      // Check if pg_stat_statements extension is available
      const extensionCheck = await pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
        ) as has_extension
      `);

      if (extensionCheck.rows[0].has_extension) {
        const slowQueries = await pool.query(`
          SELECT 
            query,
            calls,
            total_exec_time,
            mean_exec_time,
            max_exec_time
          FROM pg_stat_statements
          WHERE query LIKE '%seaport_orders%'
          ORDER BY mean_exec_time DESC
          LIMIT 10
        `);

        logger.info(`  Found ${slowQueries.rows.length} queries involving seaport_orders`);
        
        slowQueries.rows.forEach((row, i) => {
          logger.info(`  ${i + 1}. Mean time: ${row.mean_exec_time.toFixed(2)}ms, Calls: ${row.calls}`);
          logger.info(`     Query: ${row.query.substring(0, 100)}...`);
        });

        this.results.optimizationRecommendations.push({
          category: 'Slow Queries',
          queries: slowQueries.rows.length,
          details: 'See logs for query details'
        });
      } else {
        logger.info('  ⚠️  pg_stat_statements extension not available');
        this.results.optimizationRecommendations.push({
          category: 'Slow Queries',
          recommendation: 'Enable pg_stat_statements extension for query performance monitoring'
        });
      }

    } catch (error) {
      logger.error('  ❌ Analysis failed:', error.message);
    }
  }

  async analyzeMissingIndexes() {
    logger.info('\n🔍 Analyzing Index Coverage...');
    
    try {
      // Get all indexes on seaport_orders
      const indexes = await pool.query(`
        SELECT 
          indexname,
          indexdef
        FROM pg_indexes
        WHERE tablename = 'seaport_orders'
      `);

      logger.info(`  Found ${indexes.rows.length} indexes on seaport_orders:`);
      indexes.rows.forEach(idx => {
        logger.info(`    - ${idx.indexname}`);
      });

      // Check for recommended indexes
      const recommendedIndexes = [
        { name: 'idx_token_id', columns: ['token_id', 'nft_contract'] },
        { name: 'idx_maker', columns: ['maker'] },
        { name: 'idx_order_type', columns: ['order_type'] },
        { name: 'idx_is_active', columns: ['is_active'] },
        { name: 'idx_expires_at', columns: ['expires_at'] },
        { name: 'idx_active_orders', columns: ['order_type', 'token_id', 'is_active', 'expires_at'] }
      ];

      const existingIndexNames = indexes.rows.map(idx => idx.indexname);
      const missingIndexes = recommendedIndexes.filter(
        rec => !existingIndexNames.some(name => name.includes(rec.name))
      );

      if (missingIndexes.length > 0) {
        logger.info(`  ⚠️  Missing recommended indexes:`);
        missingIndexes.forEach(idx => {
          logger.info(`    - ${idx.name} on (${idx.columns.join(', ')})`);
        });

        this.results.optimizationRecommendations.push({
          category: 'Missing Indexes',
          count: missingIndexes.length,
          indexes: missingIndexes.map(idx => idx.name)
        });
      } else {
        logger.info('  ✅ All recommended indexes are present');
      }

    } catch (error) {
      logger.error('  ❌ Analysis failed:', error.message);
    }
  }

  async analyzeTableStatistics() {
    logger.info('\n🔍 Analyzing Table Statistics...');
    
    try {
      // Get table size
      const sizeQuery = await pool.query(`
        SELECT 
          pg_size_pretty(pg_total_relation_size('seaport_orders')) as total_size,
          pg_size_pretty(pg_relation_size('seaport_orders')) as table_size,
          pg_size_pretty(pg_indexes_size('seaport_orders')) as indexes_size
      `);

      const stats = sizeQuery.rows[0];
      logger.info(`  Table size: ${stats.table_size}`);
      logger.info(`  Indexes size: ${stats.indexes_size}`);
      logger.info(`  Total size: ${stats.total_size}`);

      // Get row count
      const countQuery = await pool.query('SELECT COUNT(*) FROM seaport_orders');
      const rowCount = parseInt(countQuery.rows[0].count);
      logger.info(`  Row count: ${rowCount}`);

      // Get statistics
      const statsQuery = await pool.query(`
        SELECT 
          COUNT(*) FILTER (WHERE is_active = true) as active_orders,
          COUNT(*) FILTER (WHERE is_fulfilled = true) as fulfilled_orders,
          COUNT(*) FILTER (WHERE is_cancelled = true) as cancelled_orders,
          COUNT(*) FILTER (WHERE order_type = 'listing') as listings,
          COUNT(*) FILTER (WHERE order_type = 'offer') as offers
        FROM seaport_orders
      `);

      const orderStats = statsQuery.rows[0];
      logger.info(`  Active orders: ${orderStats.active_orders}`);
      logger.info(`  Fulfilled orders: ${orderStats.fulfilled_orders}`);
      logger.info(`  Cancelled orders: ${orderStats.cancelled_orders}`);
      logger.info(`  Listings: ${orderStats.listings}`);
      logger.info(`  Offers: ${orderStats.offers}`);

      this.results.optimizationRecommendations.push({
        category: 'Table Statistics',
        totalSize: stats.total_size,
        rowCount,
        activeOrders: parseInt(orderStats.active_orders)
      });

    } catch (error) {
      logger.error('  ❌ Analysis failed:', error.message);
    }
  }

  async generateOptimizationRecommendations() {
    logger.info('\n🔍 Generating Optimization Recommendations...');
    
    const recommendations = [];

    // Analyze test results
    const failedDbTests = this.results.databaseTests.filter(t => !t.passed);
    const failedWsTests = this.results.websocketTests.filter(t => !t.passed);
    const failedCronTests = this.results.cronTests.filter(t => !t.passed);

    if (failedDbTests.length > 0) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Database Performance',
        issue: `${failedDbTests.length} database tests failed performance thresholds`,
        recommendations: [
          'Consider adding connection pooling if not already configured',
          'Review and optimize slow queries identified in the analysis',
          'Ensure all recommended indexes are created',
          'Consider implementing query result caching for frequently accessed data',
          'Review database configuration (shared_buffers, work_mem, etc.)'
        ]
      });
    }

    if (failedWsTests.length > 0) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'WebSocket Performance',
        issue: `${failedWsTests.length} WebSocket tests failed performance thresholds`,
        recommendations: [
          'Implement WebSocket connection pooling',
          'Use Redis adapter for Socket.IO to enable horizontal scaling',
          'Implement room-based broadcasting to reduce unnecessary message traffic',
          'Consider implementing message batching for high-frequency updates',
          'Review WebSocket server configuration (pingTimeout, pingInterval)'
        ]
      });
    }

    if (failedCronTests.length > 0) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'Cron Job Performance',
        issue: `${failedCronTests.length} cron job tests failed performance thresholds`,
        recommendations: [
          'Optimize the cleanup query with better indexes',
          'Consider batch processing for large cleanup operations',
          'Implement pagination for cleanup operations',
          'Add monitoring and alerting for long-running cron jobs',
          'Consider running cleanup during off-peak hours'
        ]
      });
    }

    // General recommendations
    recommendations.push({
      priority: 'LOW',
      category: 'General Optimizations',
      recommendations: [
        'Implement database query result caching with Redis',
        'Set up database query monitoring and slow query logging',
        'Implement API rate limiting to prevent abuse',
        'Consider implementing database read replicas for read-heavy operations',
        'Set up performance monitoring dashboards',
        'Implement automated performance regression testing in CI/CD'
      ]
    });

    this.results.optimizationRecommendations.push(...recommendations);

    logger.info(`  Generated ${recommendations.length} optimization recommendations`);
    recommendations.forEach((rec, i) => {
      logger.info(`\n  ${i + 1}. [${rec.priority}] ${rec.category}`);
      if (rec.issue) {
        logger.info(`     Issue: ${rec.issue}`);
      }
      logger.info(`     Recommendations:`);
      rec.recommendations.forEach(r => {
        logger.info(`       - ${r}`);
      });
    });
  }

  // ==================== HELPER METHODS ====================

  async createTestOrder(orderType, tokenId) {
    const orderHash = '0x' + this.generateRandomHex(64);
    const maker = '0x' + '1'.repeat(40);
    const nftContract = process.env.NFT_CONTRACT_ADDRESS || '0x' + '1'.repeat(40);
    const paymentToken = '0x' + '3'.repeat(40);
    const now = Math.floor(Date.now() / 1000);
    
    // Generate a valid salt as a large number string (not hex)
    const salt = Math.floor(Math.random() * 1000000000000000).toString();

    const orderData = {
      orderHash,
      orderType,
      nftContract,
      tokenId,
      maker,
      taker: null,
      paymentToken,
      price: '1000000000000000000',
      priceDecimal: '1.0',
      platformFeeAmount: '25000000000000000',
      platformFeeRecipient: '0x' + '4'.repeat(40),
      startTime: now,
      endTime: now + 86400, // 24 hours
      orderComponents: {
        offerer: maker,
        zone: '0x' + '0'.repeat(40),
        offer: [{
          itemType: orderType === 'listing' ? 2 : 1,
          token: orderType === 'listing' ? nftContract : paymentToken,
          identifierOrCriteria: orderType === 'listing' ? tokenId : '0',
          startAmount: orderType === 'listing' ? '1' : '1000000000000000000',
          endAmount: orderType === 'listing' ? '1' : '1000000000000000000'
        }],
        consideration: [{
          itemType: orderType === 'listing' ? 1 : 2,
          token: orderType === 'listing' ? paymentToken : nftContract,
          identifierOrCriteria: orderType === 'listing' ? '0' : tokenId,
          startAmount: orderType === 'listing' ? '1000000000000000000' : '1',
          endAmount: orderType === 'listing' ? '1000000000000000000' : '1',
          recipient: maker
        }],
        orderType: 0,
        startTime: now.toString(),
        endTime: (now + 86400).toString(),
        zoneHash: '0x' + '0'.repeat(64),
        salt: salt,
        conduitKey: '0x' + '0'.repeat(64),
        counter: '0'
      },
      signature: '0x' + this.generateRandomHex(130),
      paraUserId: 'test-user-' + tokenId
    };

    return await this.orderService.createOrder(orderData);
  }

  async createExpiredTestOrder(orderType, tokenId, expiredTime) {
    const orderHash = '0x' + this.generateRandomHex(64);
    const maker = '0x' + '1'.repeat(40);
    const nftContract = process.env.NFT_CONTRACT_ADDRESS || '0x' + '1'.repeat(40);
    const paymentToken = '0x' + '3'.repeat(40);
    const expiredTimestamp = Math.floor(expiredTime.getTime() / 1000);
    
    // Generate a valid salt as a large number string (not hex)
    const salt = Math.floor(Math.random() * 1000000000000000).toString();

    const orderData = {
      orderHash,
      orderType,
      nftContract,
      tokenId,
      maker,
      taker: null,
      paymentToken,
      price: '1000000000000000000',
      priceDecimal: '1.0',
      platformFeeAmount: '25000000000000000',
      platformFeeRecipient: '0x' + '4'.repeat(40),
      startTime: expiredTimestamp - 86400,
      endTime: expiredTimestamp,
      orderComponents: {
        offerer: maker,
        zone: '0x' + '0'.repeat(40),
        offer: [{
          itemType: orderType === 'listing' ? 2 : 1,
          token: orderType === 'listing' ? nftContract : paymentToken,
          identifierOrCriteria: orderType === 'listing' ? tokenId : '0',
          startAmount: orderType === 'listing' ? '1' : '1000000000000000000',
          endAmount: orderType === 'listing' ? '1' : '1000000000000000000'
        }],
        consideration: [{
          itemType: orderType === 'listing' ? 1 : 2,
          token: orderType === 'listing' ? paymentToken : nftContract,
          identifierOrCriteria: orderType === 'listing' ? '0' : tokenId,
          startAmount: orderType === 'listing' ? '1000000000000000000' : '1',
          endAmount: orderType === 'listing' ? '1000000000000000000' : '1',
          recipient: maker
        }],
        orderType: 0,
        startTime: (expiredTimestamp - 86400).toString(),
        endTime: expiredTimestamp.toString(),
        zoneHash: '0x' + '0'.repeat(64),
        salt: salt,
        conduitKey: '0x' + '0'.repeat(64),
        counter: '0'
      },
      signature: '0x' + this.generateRandomHex(130),
      paraUserId: 'test-user-' + tokenId
    };

    return await this.orderService.createOrder(orderData);
  }

  async deleteTestOrder(orderHash) {
    try {
      await pool.query('DELETE FROM seaport_orders WHERE order_hash = $1', [orderHash]);
    } catch (error) {
      // Ignore errors during cleanup
    }
  }

  generateRandomHex(length) {
    const chars = '0123456789abcdef';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  }

  // ==================== MAIN TEST RUNNER ====================

  async run() {
    try {
      logger.info('\n' + '='.repeat(80));
      logger.info('🚀 SEAPORT ORDERBOOK PERFORMANCE TEST SUITE');
      logger.info('='.repeat(80));
      logger.info('');

      await this.initialize();

      // Run all test suites
      await this.testDatabasePerformance();
      await this.testWebSocketPerformance();
      await this.testCronJobPerformance();
      await this.analyzeOptimizations();

      // Generate summary report
      this.generateSummaryReport();

    } catch (error) {
      logger.error('❌ Performance test suite failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  generateSummaryReport() {
    logger.info('\n' + '='.repeat(80));
    logger.info('📊 PERFORMANCE TEST SUMMARY');
    logger.info('='.repeat(80));

    // Database tests summary
    logger.info('\n📊 Database Tests:');
    const dbPassed = this.results.databaseTests.filter(t => t.passed).length;
    const dbTotal = this.results.databaseTests.length;
    logger.info(`  Passed: ${dbPassed}/${dbTotal}`);
    
    if (dbPassed < dbTotal) {
      logger.info('  Failed tests:');
      this.results.databaseTests.filter(t => !t.passed).forEach(t => {
        logger.info(`    - ${t.test}: ${t.duration || t.error}`);
      });
    }

    // WebSocket tests summary
    logger.info('\n🔌 WebSocket Tests:');
    const wsPassed = this.results.websocketTests.filter(t => t.passed).length;
    const wsTotal = this.results.websocketTests.length;
    logger.info(`  Passed: ${wsPassed}/${wsTotal}`);
    
    if (wsPassed < wsTotal) {
      logger.info('  Failed tests:');
      this.results.websocketTests.filter(t => !t.passed).forEach(t => {
        logger.info(`    - ${t.test}: ${t.duration || t.error}`);
      });
    }

    // Cron tests summary
    logger.info('\n⏰ Cron Job Tests:');
    const cronPassed = this.results.cronTests.filter(t => t.passed).length;
    const cronTotal = this.results.cronTests.length;
    logger.info(`  Passed: ${cronPassed}/${cronTotal}`);
    
    if (cronPassed < cronTotal) {
      logger.info('  Failed tests:');
      this.results.cronTests.filter(t => !t.passed).forEach(t => {
        logger.info(`    - ${t.test}: ${t.duration || t.error}`);
      });
    }

    // Overall summary
    const totalPassed = dbPassed + wsPassed + cronPassed;
    const totalTests = dbTotal + wsTotal + cronTotal;
    const passRate = ((totalPassed / totalTests) * 100).toFixed(1);

    logger.info('\n' + '='.repeat(80));
    logger.info(`📈 OVERALL RESULTS: ${totalPassed}/${totalTests} tests passed (${passRate}%)`);
    logger.info('='.repeat(80));

    if (totalPassed === totalTests) {
      logger.info('✅ ALL PERFORMANCE TESTS PASSED!');
    } else {
      logger.info('⚠️  SOME PERFORMANCE TESTS FAILED - Review recommendations above');
    }

    logger.info('\n🔧 Optimization Recommendations:');
    logger.info(`  Generated ${this.results.optimizationRecommendations.length} recommendations`);
    logger.info('  See detailed recommendations in the output above');

    logger.info('\n' + '='.repeat(80));
  }

  async cleanup() {
    logger.info('\n🧹 Cleaning up test data...');
    
    try {
      // Delete any remaining test orders
      await pool.query(`
        DELETE FROM seaport_orders 
        WHERE para_user_id LIKE 'test-user-%'
      `);
      
      logger.info('✅ Cleanup complete');
    } catch (error) {
      logger.error('Error during cleanup:', error.message);
    }
  }
}

// ==================== RUN TESTS ====================

async function main() {
  const runner = new PerformanceTestRunner();
  
  try {
    await runner.run();
    process.exit(0);
  } catch (error) {
    logger.error('Performance test suite failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { PerformanceTestRunner };
