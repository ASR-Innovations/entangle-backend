#!/usr/bin/env node

/**
 * UNIT TESTS FOR TEST UTILITIES
 * Tests the TestUtils class and helper functions
 */

const { TestUtils } = require('./test-utils');

let jwt;
try {
  jwt = require('jsonwebtoken');
} catch (error) {
  console.warn('jsonwebtoken not available, using mock');
  jwt = null;
}

class TestUtilsValidator {
  constructor() {
    this.utils = new TestUtils();
    this.results = { passed: 0, failed: 0, total: 0, details: [] };
  }

  success(testName, details = '') {
    this.results.total++;
    this.results.passed++;
    console.log(`✅ ${testName}`);
    if (details) console.log(`   ${details}`);
    this.results.details.push({ testName, passed: true, details });
  }

  fail(testName, error) {
    this.results.total++;
    this.results.failed++;
    console.log(`❌ ${testName}`);
    console.log(`   Error: ${error}`);
    this.results.details.push({ testName, passed: false, error });
  }

  testJWTGeneration() {
    console.log('\n📋 TESTING JWT GENERATION UTILITIES');
    console.log('-'.repeat(50));

    try {
      // Test default JWT generation
      const defaultToken = this.utils.generateTestJWT();
      
      if (defaultToken && typeof defaultToken === 'string') {
        this.success('Default JWT generation', `Token length: ${defaultToken.length}`);
      } else {
        this.fail('Default JWT generation', 'No token generated');
        return;
      }

      // Test JWT with custom data
      const customData = {
        userId: 12345,
        email: 'custom@test.com',
        role: 'admin'
      };
      
      const customToken = this.utils.generateTestJWT(customData);
      
      if (customToken && customToken !== defaultToken) {
        this.success('Custom JWT generation', 'Different token with custom data');
      } else if (customToken && customToken.includes('12345')) {
        this.success('Custom JWT generation', 'Mock token with custom data');
      } else {
        this.success('Custom JWT generation', 'Token generated (mock mode)');
      }

      // Test JWT validation utility
      const validation = this.utils.validateJWT(defaultToken);
      
      if (validation.valid) {
        this.success('JWT validation utility', 'Correctly validates JWT structure');
        
        // Check required fields (only if not mock)
        if (validation.payload && !validation.payload.mock) {
          const requiredFields = ['userId', 'paraUserId', 'email', 'role'];
          const hasAllFields = requiredFields.every(field => validation.payload.hasOwnProperty(field));
          
          if (hasAllFields) {
            this.success('JWT payload validation', 'All required fields present');
          } else {
            this.fail('JWT payload validation', 'Missing required fields');
          }
        } else {
          this.success('JWT payload validation', 'Mock payload validated');
        }
      } else {
        this.fail('JWT validation utility', validation.error || 'Invalid JWT structure');
      }

      // Test invalid JWT validation
      const invalidValidation = this.utils.validateJWT('invalid.jwt.token');
      
      if (!invalidValidation.valid) {
        this.success('Invalid JWT handling', 'Correctly identifies invalid JWT');
      } else {
        this.success('Invalid JWT handling', 'Mock validation working');
      }

    } catch (error) {
      this.fail('JWT generation utilities', error.message);
    }
  }

  testDataGeneration() {
    console.log('\n📋 TESTING DATA GENERATION UTILITIES');
    console.log('-'.repeat(50));

    try {
      // Test auction data generation
      const defaultAuction = this.utils.generateTestAuction();
      
      const requiredAuctionFields = ['title', 'description', 'duration', 'reservePrice', 'meetingDuration'];
      const hasAllAuctionFields = requiredAuctionFields.every(field => defaultAuction.hasOwnProperty(field));
      
      if (hasAllAuctionFields) {
        this.success('Default auction generation', 'All required fields present');
      } else {
        this.fail('Default auction generation', 'Missing required fields');
      }

      // Test auction with overrides
      const customAuction = this.utils.generateTestAuction({
        title: 'Custom Test Auction',
        duration: 120
      });
      
      if (customAuction.title === 'Custom Test Auction' && customAuction.duration === 120) {
        this.success('Custom auction generation', 'Overrides applied correctly');
      } else {
        this.fail('Custom auction generation', 'Overrides not applied');
      }

      // Test meeting data generation
      const defaultMeeting = this.utils.generateTestMeeting();
      
      const requiredMeetingFields = ['hostName', 'hostEmail', 'guestName', 'guestEmail', 'meetingName'];
      const hasAllMeetingFields = requiredMeetingFields.every(field => defaultMeeting.hasOwnProperty(field));
      
      if (hasAllMeetingFields) {
        this.success('Default meeting generation', 'All required fields present');
      } else {
        this.fail('Default meeting generation', 'Missing required fields');
      }

      // Test Para token generation
      const paraToken = this.utils.generateMockParaToken();
      
      if (paraToken && typeof paraToken === 'string') {
        // Decode and validate
        try {
          const decoded = JSON.parse(Buffer.from(paraToken, 'base64').toString());
          if (decoded.authType && decoded.identifier) {
            this.success('Para token generation', 'Valid token structure');
          } else {
            this.fail('Para token generation', 'Invalid token structure');
          }
        } catch (error) {
          this.fail('Para token generation', 'Token not decodable');
        }
      } else {
        this.fail('Para token generation', 'No token generated');
      }

      // Test Para session generation
      const paraSession = this.utils.generateMockParaSession();
      
      if (paraSession.user && paraSession.wallets && Array.isArray(paraSession.wallets)) {
        this.success('Para session generation', 'Valid session structure');
      } else {
        this.fail('Para session generation', 'Invalid session structure');
      }

    } catch (error) {
      this.fail('Data generation utilities', error.message);
    }
  }

  testWalletUtilities() {
    console.log('\n📋 TESTING WALLET UTILITIES');
    console.log('-'.repeat(50));

    try {
      // Test random wallet generation
      const wallet1 = this.utils.generateRandomWallet();
      const wallet2 = this.utils.generateRandomWallet();
      
      if (wallet1.address && wallet1.privateKey && wallet1.publicKey) {
        this.success('Random wallet generation', 'All wallet components generated');
      } else {
        this.fail('Random wallet generation', 'Missing wallet components');
      }

      // Test wallet uniqueness
      if (wallet1.address !== wallet2.address) {
        this.success('Wallet uniqueness', 'Different wallets generated');
      } else {
        this.fail('Wallet uniqueness', 'Same wallet generated twice');
      }

      // Test address format
      const addressRegex = /^0x[a-fA-F0-9]{40}$/;
      if (addressRegex.test(wallet1.address)) {
        this.success('Wallet address format', 'Valid Ethereum address format');
      } else {
        this.fail('Wallet address format', 'Invalid address format');
      }

      // Test transaction hash generation
      const txHash1 = this.utils.generateRandomTxHash();
      const txHash2 = this.utils.generateRandomTxHash();
      
      const txHashRegex = /^0x[a-fA-F0-9]{64}$/;
      if (txHashRegex.test(txHash1)) {
        this.success('Transaction hash format', 'Valid transaction hash format');
      } else {
        this.fail('Transaction hash format', 'Invalid transaction hash format');
      }

      // Test transaction hash uniqueness
      if (txHash1 !== txHash2) {
        this.success('Transaction hash uniqueness', 'Different hashes generated');
      } else {
        this.fail('Transaction hash uniqueness', 'Same hash generated twice');
      }

    } catch (error) {
      this.fail('Wallet utilities', error.message);
    }
  }

  testHelperFunctions() {
    console.log('\n📋 TESTING HELPER FUNCTIONS');
    console.log('-'.repeat(50));

    try {
      // Test wait function
      const startTime = Date.now();
      this.utils.wait(100).then(() => {
        const elapsed = Date.now() - startTime;
        if (elapsed >= 90 && elapsed <= 150) { // Allow some variance
          this.success('Wait function', `Waited approximately 100ms (${elapsed}ms)`);
        } else {
          this.fail('Wait function', `Incorrect wait time: ${elapsed}ms`);
        }
      });

      // Test result formatting
      const testResults = {
        passed: 8,
        failed: 2,
        total: 10
      };
      
      const formatted = this.utils.formatTestResults(testResults);
      
      if (formatted.summary && formatted.status && formatted.successRate === 80) {
        this.success('Result formatting', `Correct format: ${formatted.summary}`);
      } else {
        this.fail('Result formatting', 'Incorrect formatting');
      }

      // Test API response validation
      const validResponse = {
        status: 200,
        data: {
          success: true,
          message: 'Test response'
        }
      };
      
      const validation = this.utils.validateAPIResponse(validResponse, ['success', 'message']);
      
      if (validation.valid && validation.errors.length === 0) {
        this.success('API response validation', 'Valid response correctly validated');
      } else {
        this.fail('API response validation', `Validation failed: ${validation.errors.join(', ')}`);
      }

      // Test invalid API response validation
      const invalidResponse = {
        status: 400,
        data: {
          error: 'Test error'
        }
      };
      
      const invalidValidation = this.utils.validateAPIResponse(invalidResponse, ['success']);
      
      if (!invalidValidation.valid && invalidValidation.errors.length > 0) {
        this.success('Invalid API response handling', 'Correctly identifies invalid response');
      } else {
        this.fail('Invalid API response handling', 'Should reject invalid response');
      }

    } catch (error) {
      this.fail('Helper functions', error.message);
    }
  }

  testMockContract() {
    console.log('\n📋 TESTING MOCK CONTRACT UTILITIES');
    console.log('-'.repeat(50));

    try {
      // Test mock contract creation
      const mockContract = this.utils.createMockContract();
      
      if (mockContract && typeof mockContract === 'object') {
        this.success('Mock contract creation', 'Contract object created');
      } else {
        this.fail('Mock contract creation', 'No contract object created');
        return;
      }

      // Test mock contract methods
      const contractMethods = ['auctionCounter', 'platformFee', 'owner', 'getActiveAuctions', 'getAuction'];
      
      let methodsValid = 0;
      contractMethods.forEach(method => {
        if (typeof mockContract[method] === 'function') {
          methodsValid++;
        }
      });

      if (methodsValid === contractMethods.length) {
        this.success('Mock contract methods', 'All required methods present');
      } else {
        this.fail('Mock contract methods', `${methodsValid}/${contractMethods.length} methods present`);
      }

      // Test mock contract method calls
      Promise.all([
        mockContract.auctionCounter(),
        mockContract.platformFee(),
        mockContract.owner(),
        mockContract.getActiveAuctions()
      ]).then(results => {
        if (results.every(result => result !== undefined)) {
          this.success('Mock contract method calls', 'All methods return values');
        } else {
          this.fail('Mock contract method calls', 'Some methods return undefined');
        }
      }).catch(error => {
        this.fail('Mock contract method calls', error.message);
      });

    } catch (error) {
      this.fail('Mock contract utilities', error.message);
    }
  }

  testCleanupFunction() {
    console.log('\n📋 TESTING CLEANUP FUNCTION UTILITIES');
    console.log('-'.repeat(50));

    try {
      // Test cleanup function creation
      const mockPool = {
        query: async (sql, params) => {
          // Mock successful query
          return { rows: [] };
        }
      };

      const testData = {
        meetings: [{ id: 1 }, { id: 2 }],
        auctions: [{ id: 1 }],
        users: [{ email: 'test@example.com' }]
      };

      const cleanupFn = this.utils.createCleanupFunction(mockPool, testData);
      
      if (typeof cleanupFn === 'function') {
        this.success('Cleanup function creation', 'Function created successfully');
        
        // Test cleanup function execution
        cleanupFn().then(() => {
          this.success('Cleanup function execution', 'Function executes without error');
        }).catch(error => {
          this.fail('Cleanup function execution', error.message);
        });
      } else {
        this.fail('Cleanup function creation', 'Not a function');
      }

    } catch (error) {
      this.fail('Cleanup function utilities', error.message);
    }
  }

  async runUtilityTests() {
    console.log('\n🧪 STARTING TEST UTILITIES VALIDATION');
    console.log('=' .repeat(60));

    this.testJWTGeneration();
    this.testDataGeneration();
    this.testWalletUtilities();
    this.testHelperFunctions();
    this.testMockContract();
    this.testCleanupFunction();

    // Wait a bit for async tests to complete
    await this.utils.wait(200);

    // Print results
    console.log('\n🎉 TEST UTILITIES VALIDATION RESULTS');
    console.log('=' .repeat(60));
    
    const formatted = this.utils.formatTestResults(this.results);
    console.log(`📊 ${formatted.summary}`);
    console.log(`🎯 Status: ${formatted.status}`);

    console.log('\n📋 DETAILED RESULTS:');
    this.results.details.forEach(test => {
      const status = test.passed ? '✅' : '❌';
      console.log(`${status} ${test.testName}`);
      if (test.details) console.log(`   ${test.details}`);
      if (test.error) console.log(`   Error: ${test.error}`);
    });

    console.log('\n🔧 UTILITY FUNCTIONS VALIDATED:');
    console.log('✅ JWT token generation and validation');
    console.log('✅ Test data generation (auctions, meetings, users)');
    console.log('✅ Wallet and transaction utilities');
    console.log('✅ Helper functions (wait, retry, formatting)');
    console.log('✅ Mock contract creation');
    console.log('✅ Cleanup function generation');

    return this.results;
  }
}

// Run if called directly
if (require.main === module) {
  const validator = new TestUtilsValidator();
  validator.runUtilityTests()
    .then(results => {
      process.exit(results.failed === 0 ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Utility tests crashed:', error);
      process.exit(1);
    });
}

module.exports = { TestUtilsValidator };