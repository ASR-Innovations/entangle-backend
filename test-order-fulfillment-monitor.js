/**
 * Test script for OrderFulfillmentMonitorService
 * 
 * This script tests the order fulfillment monitoring functionality
 */

require('dotenv').config();
const { getOrderFulfillmentMonitorService } = require('./src/services/OrderFulfillmentMonitorService');
const { getOrderService } = require('./src/services/OrderService');
const logger = require('./src/utils/logger');

async function testOrderFulfillmentMonitor() {
  try {
    logger.info('🧪 Testing OrderFulfillmentMonitorService...');
    logger.info('='.repeat(60));

    // Test 1: Initialize the service
    logger.info('\n📋 Test 1: Initialize OrderFulfillmentMonitorService');
    const monitorService = getOrderFulfillmentMonitorService();
    const initialized = await monitorService.initialize();
    
    if (initialized) {
      logger.info('✅ Service initialized successfully');
    } else {
      logger.error('❌ Service initialization failed');
      return;
    }

    // Test 2: Check service status
    logger.info('\n📋 Test 2: Check service status');
    const status = monitorService.getStatus();
    logger.info('Service status:', status);

    // Test 3: Start monitoring
    logger.info('\n📋 Test 3: Start monitoring for OrderFulfilled events');
    await monitorService.start();
    logger.info('✅ Monitoring started');

    // Test 4: Check if monitoring is active
    logger.info('\n📋 Test 4: Verify monitoring is active');
    const updatedStatus = monitorService.getStatus();
    if (updatedStatus.isMonitoring) {
      logger.info('✅ Service is actively monitoring');
    } else {
      logger.error('❌ Service is not monitoring');
    }

    // Test 5: Keep monitoring for 30 seconds
    logger.info('\n📋 Test 5: Monitor for 30 seconds...');
    logger.info('💡 If you have a test transaction, you can manually trigger it using:');
    logger.info('   await monitorService.processTransaction("0x...")');
    logger.info('⏳ Waiting for events...');

    await new Promise(resolve => setTimeout(resolve, 30000));

    // Test 6: Stop monitoring
    logger.info('\n📋 Test 6: Stop monitoring');
    monitorService.stop();
    logger.info('✅ Monitoring stopped');

    // Final status
    logger.info('\n📊 Final Status:');
    const finalStatus = monitorService.getStatus();
    logger.info(JSON.stringify(finalStatus, null, 2));

    logger.info('\n🎉 All tests completed!');
    logger.info('='.repeat(60));

    process.exit(0);

  } catch (error) {
    logger.error('❌ Test failed:', error);
    logger.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run tests
testOrderFulfillmentMonitor();
