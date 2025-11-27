#!/usr/bin/env node

/**
 * SIMPLE TEST RUNNER
 * Runs tests without requiring full backend dependencies
 */

console.log('🧪 RUNNING CONSOLIDATED TEST SUITE');
console.log('=' .repeat(60));

async function runTests() {
  let totalPassed = 0;
  let totalFailed = 0;
  let totalTests = 0;

  // Test 1: Test Utilities Validation
  console.log('\n📋 TEST 1: VALIDATING TEST UTILITIES');
  console.log('-'.repeat(50));

  try {
    const { TestUtilsValidator } = require('./test-utils.test.js');
    const validator = new TestUtilsValidator();
    const results = await validator.runUtilityTests();
    
    totalPassed += results.passed;
    totalFailed += results.failed;
    totalTests += results.total;
    
    console.log(`✅ Test utilities validation: ${results.passed}/${results.total} passed`);
  } catch (error) {
    console.log(`❌ Test utilities validation failed: ${error.message}`);
    totalFailed++;
    totalTests++;
  }

  // Test 2: Basic Functionality Tests
  console.log('\n📋 TEST 2: BASIC FUNCTIONALITY TESTS');
  console.log('-'.repeat(50));

  try {
    // Test file existence
    const fs = require('fs');
    const testFiles = [
      'tests/comprehensive.js',
      'tests/test-utils.js',
      'tests/specialized/contract-deep.js',
      'tests/specialized/auction-flow.js'
    ];

    let filesExist = 0;
    testFiles.forEach(file => {
      if (fs.existsSync(file)) {
        filesExist++;
        console.log(`✅ ${file} exists`);
      } else {
        console.log(`❌ ${file} missing`);
      }
    });

    totalPassed += filesExist;
    totalFailed += (testFiles.length - filesExist);
    totalTests += testFiles.length;

    // Test file structure
    const { TestUtils } = require('./test-utils.js');
    const utils = new TestUtils();
    
    // Test basic utility functions
    const testToken = utils.generateTestJWT();
    if (testToken) {
      console.log('✅ JWT generation working');
      totalPassed++;
    } else {
      console.log('❌ JWT generation failed');
      totalFailed++;
    }
    totalTests++;

    const testAuction = utils.generateTestAuction();
    if (testAuction && testAuction.title) {
      console.log('✅ Auction data generation working');
      totalPassed++;
    } else {
      console.log('❌ Auction data generation failed');
      totalFailed++;
    }
    totalTests++;

    const testWallet = utils.generateRandomWallet();
    if (testWallet && testWallet.address) {
      console.log('✅ Wallet generation working');
      totalPassed++;
    } else {
      console.log('❌ Wallet generation failed');
      totalFailed++;
    }
    totalTests++;

  } catch (error) {
    console.log(`❌ Basic functionality tests failed: ${error.message}`);
    totalFailed++;
    totalTests++;
  }

  // Test 3: Check Old Test Files Still Exist (should be removed)
  console.log('\n📋 TEST 3: CHECKING OLD TEST FILES STATUS');
  console.log('-'.repeat(50));

  try {
    const fs = require('fs');
    const oldTestFiles = [
      'test-comprehensive-system.js',
      'test-backend-server.js',
      'test-auction-flow.js',
      'test-contract-integration.js',
      'test-para-flow.js'
    ];

    let oldFilesRemaining = 0;
    oldTestFiles.forEach(file => {
      if (fs.existsSync(file)) {
        oldFilesRemaining++;
        console.log(`⚠️  ${file} still exists (should be removed)`);
      } else {
        console.log(`✅ ${file} removed`);
      }
    });

    if (oldFilesRemaining === 0) {
      console.log('✅ All old test files have been removed');
      totalPassed++;
    } else {
      console.log(`❌ ${oldFilesRemaining} old test files still exist`);
      totalFailed++;
    }
    totalTests++;

  } catch (error) {
    console.log(`❌ Old test files check failed: ${error.message}`);
    totalFailed++;
    totalTests++;
  }

  // Print final results
  console.log('\n🎉 CONSOLIDATED TEST SUITE RESULTS');
  console.log('=' .repeat(60));
  console.log(`✅ Passed: ${totalPassed}`);
  console.log(`❌ Failed: ${totalFailed}`);
  console.log(`📊 Total: ${totalTests}`);
  console.log(`📈 Success Rate: ${((totalPassed / totalTests) * 100).toFixed(1)}%`);

  if (totalFailed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! Test consolidation successful!');
    return 0;
  } else {
    console.log('\n⚠️  Some tests failed. Issues need to be addressed.');
    return 1;
  }
}

// Run tests
if (require.main === module) {
  runTests()
    .then(exitCode => process.exit(exitCode))
    .catch(error => {
      console.error('❌ Test runner crashed:', error);
      process.exit(1);
    });
}

module.exports = { runTests };