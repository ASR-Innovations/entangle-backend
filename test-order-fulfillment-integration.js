/**
 * Integration test for OrderFulfillmentMonitorService
 * 
 * This script tests the complete order fulfillment flow:
 * 1. Create a test order in the database
 * 2. Simulate a fulfillment event
 * 3. Verify the order is updated correctly
 */

require('dotenv').config();
const { getOrderFulfillmentMonitorService } = require('./src/services/OrderFulfillmentMonitorService');
const { getOrderService } = require('./src/services/OrderService');
const { pool } = require('./src/config/database');
const logger = require('./src/utils/logger');
const { ethers } = require('ethers');

async function testOrderFulfillmentIntegration() {
  try {
    logger.info('🧪 Testing OrderFulfillmentMonitorService Integration...');
    logger.info('='.repeat(60));

    // Initialize services
    logger.info('\n📋 Step 1: Initialize services');
    const monitorService = getOrderFulfillmentMonitorService();
    await monitorService.initialize();
    
    const orderService = getOrderService();
    await orderService.initialize();
    
    logger.info('✅ Services initialized');

    // Create a test order
    logger.info('\n📋 Step 2: Create a test order in database');
    const testOrderHash = ethers.keccak256(ethers.toUtf8Bytes(`test-order-${Date.now()}`));
    const testMaker = '0x1234567890123456789012345678901234567890';
    const testNftContract = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
    const testTokenId = '123';
    
    const testOrderData = {
      orderHash: testOrderHash,
      orderType: 'listing',
      nftContract: testNftContract,
      tokenId: testTokenId,
      maker: testMaker,
      paymentToken: '0x0000000000000000000000000000000000000000',
      price: ethers.parseEther('1.0').toString(),
      priceDecimal: '1.0',
      startTime: Math.floor(Date.now() / 1000),
      endTime: Math.floor(Date.now() / 1000) + 86400, // 24 hours
      orderComponents: {
        offerer: testMaker,
        zone: ethers.ZeroAddress,
        offer: [{
          itemType: 2,
          token: testNftContract,
          identifierOrCriteria: testTokenId,
          startAmount: '1',
          endAmount: '1'
        }],
        consideration: [{
          itemType: 0,
          token: '0x0000000000000000000000000000000000000000',
          identifierOrCriteria: '0',
          startAmount: ethers.parseEther('1.0').toString(),
          endAmount: ethers.parseEther('1.0').toString(),
          recipient: testMaker
        }],
        orderType: 0,
        startTime: Math.floor(Date.now() / 1000).toString(),
        endTime: (Math.floor(Date.now() / 1000) + 86400).toString(),
        zoneHash: ethers.ZeroHash,
        salt: '0',
        conduitKey: ethers.ZeroHash,
        counter: '0'
      },
      signature: '0x' + '00'.repeat(65) // Dummy signature for testing
    };

    // Insert directly into database (bypassing validation for testing)
    await pool.query(`
      INSERT INTO seaport_orders (
        order_hash, order_type, nft_contract, token_id, maker,
        payment_token, price, price_decimal, start_time, end_time,
        expires_at, order_components, signature, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true)
    `, [
      testOrderHash,
      testOrderData.orderType,
      testOrderData.nftContract,
      testOrderData.tokenId,
      testOrderData.maker,
      testOrderData.paymentToken,
      testOrderData.price,
      testOrderData.priceDecimal,
      testOrderData.startTime,
      testOrderData.endTime,
      new Date((testOrderData.endTime) * 1000),
      JSON.stringify(testOrderData.orderComponents),
      testOrderData.signature
    ]);

    logger.info('✅ Test order created:', {
      orderHash: testOrderHash,
      maker: testMaker,
      tokenId: testTokenId
    });

    // Verify order exists
    logger.info('\n📋 Step 3: Verify order exists in database');
    const order = await orderService.getOrderByHash(testOrderHash);
    if (order) {
      logger.info('✅ Order found:', {
        orderHash: order.orderHash,
        isActive: order.isActive,
        isFulfilled: order.isFulfilled
      });
    } else {
      throw new Error('Order not found in database');
    }

    // Simulate fulfillment
    logger.info('\n📋 Step 4: Simulate order fulfillment');
    const testFulfiller = '0x9876543210987654321098765432109876543210';
    const testTxHash = ethers.keccak256(ethers.toUtf8Bytes(`test-tx-${Date.now()}`));
    const testBlockNumber = 12345678;

    const fulfillmentData = {
      fulfiller: testFulfiller,
      transactionHash: testTxHash,
      blockNumber: testBlockNumber,
      amountPaid: testOrderData.price,
      platformFeePaid: '0'
    };

    const result = await orderService.fulfillOrder(testOrderHash, fulfillmentData);
    
    if (result.success) {
      logger.info('✅ Order fulfillment recorded:', {
        orderHash: testOrderHash,
        fulfiller: testFulfiller,
        transactionHash: testTxHash
      });
    } else {
      throw new Error('Failed to record order fulfillment');
    }

    // Verify fulfillment
    logger.info('\n📋 Step 5: Verify order fulfillment in database');
    const fulfilledOrder = await orderService.getOrderByHash(testOrderHash);
    
    if (fulfilledOrder.isFulfilled) {
      logger.info('✅ Order marked as fulfilled:', {
        orderHash: fulfilledOrder.orderHash,
        fulfilledBy: fulfilledOrder.fulfilledBy,
        fulfilledAt: fulfilledOrder.fulfilledAt,
        fulfillmentTxHash: fulfilledOrder.fulfillmentTxHash,
        isActive: fulfilledOrder.isActive
      });
    } else {
      throw new Error('Order not marked as fulfilled');
    }

    // Check fulfillment record
    logger.info('\n📋 Step 6: Verify fulfillment record');
    const fulfillmentRecord = await pool.query(
      'SELECT * FROM order_fulfillments WHERE order_hash = $1',
      [testOrderHash]
    );

    if (fulfillmentRecord.rows.length > 0) {
      logger.info('✅ Fulfillment record found:', {
        fulfiller: fulfillmentRecord.rows[0].fulfiller,
        transactionHash: fulfillmentRecord.rows[0].transaction_hash,
        blockNumber: fulfillmentRecord.rows[0].block_number
      });
    } else {
      throw new Error('Fulfillment record not found');
    }

    // Check event log
    logger.info('\n📋 Step 7: Verify event log');
    const eventLog = await pool.query(
      'SELECT * FROM order_events WHERE order_hash = $1 AND event_type = $2',
      [testOrderHash, 'order:fulfilled']
    );

    if (eventLog.rows.length > 0) {
      logger.info('✅ Event log found:', {
        eventType: eventLog.rows[0].event_type,
        actor: eventLog.rows[0].actor,
        eventData: eventLog.rows[0].event_data
      });
    } else {
      throw new Error('Event log not found');
    }

    // Cleanup
    logger.info('\n📋 Step 8: Cleanup test data');
    await pool.query('DELETE FROM order_fulfillments WHERE order_hash = $1', [testOrderHash]);
    await pool.query('DELETE FROM order_events WHERE order_hash = $1', [testOrderHash]);
    await pool.query('DELETE FROM seaport_orders WHERE order_hash = $1', [testOrderHash]);
    logger.info('✅ Test data cleaned up');

    logger.info('\n🎉 All integration tests passed!');
    logger.info('='.repeat(60));

    process.exit(0);

  } catch (error) {
    logger.error('❌ Integration test failed:', error);
    logger.error('Stack trace:', error.stack);
    
    // Cleanup on error
    try {
      const testOrderHash = ethers.keccak256(ethers.toUtf8Bytes(`test-order-${Date.now()}`));
      await pool.query('DELETE FROM order_fulfillments WHERE order_hash LIKE $1', ['%test-order%']);
      await pool.query('DELETE FROM order_events WHERE order_hash LIKE $1', ['%test-order%']);
      await pool.query('DELETE FROM seaport_orders WHERE order_hash LIKE $1', ['%test-order%']);
    } catch (cleanupError) {
      logger.error('Cleanup failed:', cleanupError);
    }
    
    process.exit(1);
  }
}

// Run tests
testOrderFulfillmentIntegration();
