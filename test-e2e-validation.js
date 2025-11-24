/**
 * E2E Test Validation Script
 * Validates that the E2E test file is properly structured
 */

const logger = require('./src/utils/logger');

async function validateTestFile() {
  logger.info('🔍 Validating E2E test file...');
  
  try {
    // Check if test file exists and can be loaded
    const testModule = require('./test-seaport-e2e.js');
    
    // Check if all test functions are exported
    const requiredFunctions = [
      'testOrderCreationFlow',
      'testOrderCancellationFlow',
      'testOrderFulfillmentFlow',
      'testRealtimeSynchronization',
      'testCronJobExecution',
      'runE2ETests'
    ];
    
    let allFunctionsPresent = true;
    
    for (const funcName of requiredFunctions) {
      if (typeof testModule[funcName] === 'function') {
        logger.info(`✅ ${funcName} is exported`);
      } else {
        logger.error(`❌ ${funcName} is missing or not a function`);
        allFunctionsPresent = false;
      }
    }
    
    if (allFunctionsPresent) {
      logger.info('\n✅ All test functions are properly exported');
      logger.info('✅ E2E test file validation passed');
      return true;
    } else {
      logger.error('\n❌ Some test functions are missing');
      return false;
    }
    
  } catch (error) {
    logger.error('❌ Failed to load test file:', error.message);
    logger.error('Stack:', error.stack);
    return false;
  }
}

// Run validation
validateTestFile().then(success => {
  process.exit(success ? 0 : 1);
});
