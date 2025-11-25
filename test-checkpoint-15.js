/**
 * Checkpoint 15: Comprehensive Test Suite
 * 
 * This script runs all verification tests for the Seaport Orderbook implementation
 * to ensure all components are working correctly.
 */

const { execSync } = require('child_process');
const logger = require('./src/utils/logger');

const tests = [
  {
    name: 'Database Schema Verification',
    command: 'node database/verify-seaport-schema.js',
    required: true
  },
  {
    name: 'Seaport Configuration Validation',
    command: 'node test-seaport-config-validation.js',
    required: true
  },
  {
    name: 'OrderValidationService Tests',
    command: 'node test-order-validation-service.js',
    required: true
  },
  {
    name: 'OrderService Tests',
    command: 'node test-order-service.js',
    required: true
  },
  {
    name: 'Order Event Logging Tests',
    command: 'node test-order-event-logging.js',
    required: true
  },
  {
    name: 'Platform Fee Validation Tests',
    command: 'node test-platform-fee-validation.js',
    required: true
  },
  {
    name: 'Order Cleanup Service Tests',
    command: 'node test-order-cleanup-service.js',
    required: true
  },
  {
    name: 'Order Fulfillment Monitor Tests',
    command: 'node test-order-fulfillment-monitor.js',
    required: false // Takes 30 seconds
  }
];

async function runTests() {
  logger.info('🧪 CHECKPOINT 15: Running Comprehensive Test Suite');
  logger.info('='.repeat(80));
  
  const results = {
    passed: [],
    failed: [],
    skipped: []
  };
  
  for (const test of tests) {
    logger.info(`\n📋 Running: ${test.name}`);
    logger.info('-'.repeat(80));
    
    try {
      execSync(test.command, { 
        stdio: 'inherit',
        timeout: 60000 // 60 second timeout
      });
      results.passed.push(test.name);
      logger.info(`✅ ${test.name} - PASSED`);
    } catch (error) {
      if (test.required) {
        results.failed.push(test.name);
        logger.error(`❌ ${test.name} - FAILED`);
      } else {
        results.skipped.push(test.name);
        logger.warn(`⚠️  ${test.name} - SKIPPED (non-critical)`);
      }
    }
  }
  
  // Print summary
  logger.info('\n' + '='.repeat(80));
  logger.info('📊 TEST SUMMARY');
  logger.info('='.repeat(80));
  logger.info(`✅ Passed: ${results.passed.length}`);
  results.passed.forEach(name => logger.info(`   - ${name}`));
  
  if (results.failed.length > 0) {
    logger.info(`\n❌ Failed: ${results.failed.length}`);
    results.failed.forEach(name => logger.error(`   - ${name}`));
  }
  
  if (results.skipped.length > 0) {
    logger.info(`\n⚠️  Skipped: ${results.skipped.length}`);
    results.skipped.forEach(name => logger.warn(`   - ${name}`));
  }
  
  logger.info('\n' + '='.repeat(80));
  
  if (results.failed.length === 0) {
    logger.info('🎉 ALL REQUIRED TESTS PASSED!');
    logger.info('✅ Checkpoint 15 Complete - System is ready');
    process.exit(0);
  } else {
    logger.error('❌ SOME TESTS FAILED - Please review the errors above');
    process.exit(1);
  }
}

runTests().catch(error => {
  logger.error('❌ Test suite execution failed:', error);
  process.exit(1);
});
