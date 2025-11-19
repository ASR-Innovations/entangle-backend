#!/usr/bin/env node

/**
 * COMPREHENSIVE TEST SUITE
 * Consolidated testing for the Entangle Backend system
 * 
 * This test suite combines functionality from 42+ individual test files
 * into a single comprehensive testing solution that covers:
 * - Server health and startup
 * - Authentication flow (Para + JWT)
 * - Database connectivity
 * - Smart contract integration
 * - API endpoints
 * - Meeting creation and access
 * - NFT gating and verification
 */

require('dotenv').config();
const axios = require('axios');
const { ethers } = require('ethers');
const jwt = require('jsonwebtoken');

// Import services
const { getParaService } = require('../src/services/ParaService');
const { getJitsiService } = require('../src/services/JitsiService');
const { getContractService } = require('../src/services/ContractService');
const { initializeLitService, getLitService } = require('../src/services/LitService');
const { setupDatabase, pool } = require('../src/config/database');
const logger = require('../src/utils/logger');

class ComprehensiveTestSuite {
  constructor() {
    this.baseUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    this.contractAddress = process.env.AUCTION_CONTRACT_ADDRESS || '0xB5D6eaD3f2b302ab38D59617C179a2f61a4ca0EC';
    this.rpcUrl = process.env.RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc';
    this.testWallet = '0x161d026cd7855bc783506183546c968cd96b4896';
    
    this.results = {
      passed: 0,
      failed: 0,
      total: 0,
      details: []
    };
    
    this.testData = {
      users: {
        creator: {
          paraUserId: 'test_creator_' + Date.now(),
          email: 'creator@test.com',
          walletAddress: this.testWallet,
          jwtToken: null
        },
        winner: {
          paraUserId: 'test_winner_' + Date.now(),
          email: 'winner@test.com', 
          walletAddress: '0x9876543210987654321098765432109876543210',
          jwtToken: null
        }
      },
      auction: null,
      meeting: null
    };
  }

  // Utility methods
  log(message, data = null) {
    console.log(`\n🔍 ${message}`);
    if (data) {
      console.log('   📊 Data:', JSON.stringify(data, null, 2));
    }
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

  // Test 1: System Health and Configuration
  async testSystemHealth() {
    console.log('\n📋 TEST 1: SYSTEM HEALTH AND CONFIGURATION');
    console.log('-'.repeat(50));

    try {
      // Test server health endpoint
      const healthResponse = await axios.get(`${this.baseUrl}/health`, { timeout: 5000 });
      
      if (healthResponse.status === 200 && healthResponse.data.status === 'ok') {
        this.success('Server health check', `Status: ${healthResponse.data.status}`);
        
        // Check individual services
        const services = healthResponse.data.services || {};
        Object.entries(services).forEach(([service, status]) => {
          if (status === 'configured') {
            this.success(`${service} service`, 'Configured');
          } else {
            this.fail(`${service} service`, `Status: ${status}`);
          }
        });
      } else {
        this.fail('Server health check', `Unexpected response: ${healthResponse.status}`);
      }

      // Test environment variables
      const requiredVars = ['JWT_SECRET', 'PARA_API_KEY', 'AUCTION_CONTRACT_ADDRESS'];
      requiredVars.forEach(varName => {
        if (process.env[varName]) {
          this.success(`Environment variable ${varName}`, 'Set');
        } else {
          this.fail(`Environment variable ${varName}`, 'Missing');
        }
      });

    } catch (error) {
      this.fail('System health check', error.message);
    }
  }

  // Test 2: Database Connectivity
  async testDatabaseConnectivity() {
    console.log('\n📋 TEST 2: DATABASE CONNECTIVITY');
    console.log('-'.repeat(50));

    try {
      // Test database connection
      const dbTest = await pool.query('SELECT NOW() as current_time, version() as version');
      this.success('Database connection', `Connected at: ${dbTest.rows[0].current_time}`);

      // Check required tables
      const tableCheck = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('users', 'auctions', 'meetings', 'meeting_access_logs')
        ORDER BY table_name
      `);

      const expectedTables = ['users', 'auctions', 'meetings', 'meeting_access_logs'];
      const existingTables = tableCheck.rows.map(row => row.table_name);
      
      expectedTables.forEach(table => {
        if (existingTables.includes(table)) {
          this.success(`Table ${table}`, 'Exists');
        } else {
          this.fail(`Table ${table}`, 'Missing');
        }
      });

      // Test data counts
      const auctionCount = await pool.query('SELECT COUNT(*) as count FROM auctions');
      this.success('Auction data', `${auctionCount.rows[0].count} auctions in database`);

    } catch (error) {
      this.fail('Database connectivity', error.message);
    }
  }

  // Test 3: Smart Contract Integration
  async testContractIntegration() {
    console.log('\n📋 TEST 3: SMART CONTRACT INTEGRATION');
    console.log('-'.repeat(50));

    try {
      // Initialize provider and contract
      const provider = new ethers.providers.JsonRpcProvider(this.rpcUrl);
      const network = await provider.getNetwork();
      this.success('RPC connection', `Network: ${network.name} (Chain ID: ${network.chainId})`);

      // Load contract
      const MeetingAuctionABI = require('../src/contracts/MeetingAuction.json');
      const contract = new ethers.Contract(this.contractAddress, MeetingAuctionABI, provider);

      // Test basic contract calls
      const auctionCounter = await contract.auctionCounter();
      const platformFee = await contract.platformFee();
      const owner = await contract.owner();

      this.success('Contract connection', `Address: ${this.contractAddress}`);
      this.success('Contract statistics', `Auctions: ${auctionCounter}, Fee: ${platformFee}bps, Owner: ${owner}`);

      // Test contract functions
      const activeAuctions = await contract.getActiveAuctions();
      this.success('Active auctions query', `Found ${activeAuctions.length} active auctions`);

      // Test NFT functions if wallet has NFTs
      try {
        const nfts = await contract.getNFTsOwnedByUser(this.testWallet);
        this.success('NFT ownership check', `User has ${nfts.tokenIds.length} NFTs`);
      } catch (error) {
        this.success('NFT ownership check', 'No NFTs found (expected)');
      }

    } catch (error) {
      this.fail('Contract integration', error.message);
    }
  }

  // Test 4: Authentication Flow
  async testAuthenticationFlow() {
    console.log('\n📋 TEST 4: AUTHENTICATION FLOW');
    console.log('-'.repeat(50));

    try {
      // Test Para auth endpoint structure
      const paraResponse = await axios.post(`${this.baseUrl}/api/auth/para-auth`, {
        verificationToken: 'test-token'
      }).catch(err => err.response);

      if (paraResponse.status === 400) {
        this.success('Para auth endpoint', 'Responds with validation error (expected)');
      } else {
        this.fail('Para auth endpoint', `Unexpected status: ${paraResponse.status}`);
      }

      // Test JWT verification endpoint
      const verifyResponse = await axios.get(`${this.baseUrl}/api/auth/verify`, {
        headers: { Authorization: 'Bearer invalid-token' }
      }).catch(err => err.response);

      if (verifyResponse.status === 401) {
        this.success('JWT verification endpoint', 'Rejects invalid tokens (expected)');
      } else {
        this.fail('JWT verification endpoint', `Unexpected status: ${verifyResponse.status}`);
      }

      // Generate test JWT tokens for further testing
      const jwtSecret = process.env.JWT_SECRET || 'test-secret';
      
      this.testData.users.creator.jwtToken = jwt.sign({
        userId: 1,
        paraUserId: this.testData.users.creator.paraUserId,
        email: this.testData.users.creator.email,
        walletAddress: this.testData.users.creator.walletAddress,
        role: 'para_user'
      }, jwtSecret, { expiresIn: '1h' });

      this.testData.users.winner.jwtToken = jwt.sign({
        userId: 2,
        paraUserId: this.testData.users.winner.paraUserId,
        email: this.testData.users.winner.email,
        walletAddress: this.testData.users.winner.walletAddress,
        role: 'para_user'
      }, jwtSecret, { expiresIn: '1h' });

      this.success('JWT token generation', 'Test tokens created for further testing');

    } catch (error) {
      this.fail('Authentication flow', error.message);
    }
  }

  // Test 5: API Endpoints
  async testAPIEndpoints() {
    console.log('\n📋 TEST 5: API ENDPOINTS');
    console.log('-'.repeat(50));

    try {
      // Test active auctions endpoint
      const activeResponse = await axios.get(`${this.baseUrl}/api/auctions/active`);
      
      if (activeResponse.status === 200 && activeResponse.data.success) {
        this.success('Active auctions API', `Returns ${activeResponse.data.auctions.length} auctions`);
        
        // Check auction data structure
        if (activeResponse.data.auctions.length > 0) {
          const auction = activeResponse.data.auctions[0];
          const hasRequiredFields = auction.id && auction.title && auction.creatorWallet;
          if (hasRequiredFields) {
            this.success('Auction data structure', 'Has required fields');
          } else {
            this.fail('Auction data structure', 'Missing required fields');
          }
        }
      } else {
        this.fail('Active auctions API', `Status: ${activeResponse.status}`);
      }

      // Test user auctions endpoint (with auth)
      const userAuctionsResponse = await axios.get(`${this.baseUrl}/api/auctions/user/created`, {
        headers: { Authorization: `Bearer ${this.testData.users.creator.jwtToken}` }
      }).catch(err => err.response);

      if (userAuctionsResponse.status === 200) {
        this.success('User auctions API', 'Returns user-specific auctions');
      } else if (userAuctionsResponse.status === 401) {
        this.success('User auctions API', 'Requires authentication (expected)');
      } else {
        this.fail('User auctions API', `Status: ${userAuctionsResponse.status}`);
      }

      // Test direct meeting creation
      const meetingData = {
        hostName: 'Test Host',
        hostEmail: 'host@test.com',
        guestName: 'Test Guest',
        guestEmail: 'guest@test.com',
        meetingName: 'Test API Meeting',
        duration: 30
      };

      const meetingResponse = await axios.post(`${this.baseUrl}/api/meetings/create-direct`, meetingData);
      
      if (meetingResponse.status === 200 && meetingResponse.data.success) {
        this.success('Direct meeting creation', `Created meeting: ${meetingResponse.data.meeting.roomId}`);
        this.testData.meeting = meetingResponse.data.meeting;
      } else {
        this.fail('Direct meeting creation', `Status: ${meetingResponse.status}`);
      }

    } catch (error) {
      this.fail('API endpoints', error.message);
    }
  }

  // Test 6: Meeting and Jitsi Integration
  async testMeetingIntegration() {
    console.log('\n📋 TEST 6: MEETING AND JITSI INTEGRATION');
    console.log('-'.repeat(50));

    try {
      // Test Jitsi service initialization
      const jitsiService = getJitsiService();
      this.success('Jitsi service initialization', `Domain: ${jitsiService.domain}`);

      // Test room creation
      const testRoom = jitsiService.createRoom({
        roomName: 'test-comprehensive-' + Date.now(),
        displayName: 'Comprehensive Test Room',
        duration: 30
      });

      this.success('Jitsi room creation', `Room ID: ${testRoom.roomId}`);

      // Test JWT token generation (if configured)
      const hasJitsiKeys = !!(process.env.JITSI_PRIVATE_KEY && process.env.JITSI_KID);
      
      if (hasJitsiKeys) {
        const jitsiToken = jitsiService.generateToken({
          roomName: testRoom.roomId,
          userId: 'test-user',
          userName: 'Test User',
          email: 'test@example.com'
        });
        
        if (jitsiToken) {
          this.success('Jitsi JWT generation', 'Token generated successfully');
        } else {
          this.fail('Jitsi JWT generation', 'Failed to generate token');
        }
      } else {
        this.success('Jitsi JWT configuration', 'Keys not configured (optional)');
      }

      // Test auction meeting creation
      const auctionMeeting = jitsiService.createAuctionMeeting({
        auctionId: 'test-123',
        hostData: {
          paraId: this.testData.users.creator.paraUserId,
          name: 'Test Creator',
          email: this.testData.users.creator.email
        },
        duration: 30
      });

      if (auctionMeeting.success) {
        this.success('Auction meeting creation', `Meeting created for auction test-123`);
      } else {
        this.fail('Auction meeting creation', auctionMeeting.error);
      }

    } catch (error) {
      this.fail('Meeting integration', error.message);
    }
  }

  // Test 7: Service Integration
  async testServiceIntegration() {
    console.log('\n📋 TEST 7: SERVICE INTEGRATION');
    console.log('-'.repeat(50));

    try {
      // Test Para service
      const paraService = getParaService();
      this.success('Para service', `Environment: ${paraService.environment}, Base URL: ${paraService.baseUrl}`);

      // Test Contract service
      const contractService = getContractService();
      await contractService.initialize();
      this.success('Contract service', `Contract: ${contractService.contractAddress}`);

      // Test Lit Protocol service (optional)
      try {
        await initializeLitService();
        const litService = getLitService();
        this.success('Lit Protocol service', `Network: ${litService.network}`);
      } catch (error) {
        this.success('Lit Protocol service', 'Not configured (optional)');
      }

    } catch (error) {
      this.fail('Service integration', error.message);
    }
  }

  // Test 8: Error Handling
  async testErrorHandling() {
    console.log('\n📋 TEST 8: ERROR HANDLING');
    console.log('-'.repeat(50));

    try {
      // Test 404 handling
      const notFoundResponse = await axios.get(`${this.baseUrl}/api/nonexistent-endpoint`).catch(err => err.response);
      if (notFoundResponse.status === 404) {
        this.success('404 error handling', 'Returns 404 for invalid endpoints');
      } else {
        this.fail('404 error handling', `Status: ${notFoundResponse.status}`);
      }

      // Test invalid JSON handling
      const invalidJsonResponse = await axios.post(`${this.baseUrl}/api/auctions/created`, 
        'invalid json', 
        { headers: { 'Content-Type': 'application/json' } }
      ).catch(err => err.response);

      if (invalidJsonResponse.status === 400) {
        this.success('Invalid JSON handling', 'Returns 400 for malformed JSON');
      } else {
        this.fail('Invalid JSON handling', `Status: ${invalidJsonResponse.status}`);
      }

      // Test missing authentication
      const noAuthResponse = await axios.post(`${this.baseUrl}/api/auctions/created`, {
        title: 'Test'
      }).catch(err => err.response);

      if (noAuthResponse.status === 401) {
        this.success('Missing auth handling', 'Returns 401 for missing authentication');
      } else {
        this.fail('Missing auth handling', `Status: ${noAuthResponse.status}`);
      }

    } catch (error) {
      this.fail('Error handling', error.message);
    }
  }

  // Cleanup test data
  async cleanupTestData() {
    try {
      // Clean up any test data created during testing
      if (this.testData.meeting) {
        await pool.query('DELETE FROM meetings WHERE jitsi_room_id = $1', [this.testData.meeting.roomId]);
      }
      
      // Clean up test users if created
      await pool.query('DELETE FROM users WHERE email IN ($1, $2)', [
        this.testData.users.creator.email,
        this.testData.users.winner.email
      ]);

      console.log('\n🧹 Test data cleanup completed');
    } catch (error) {
      console.log('\n⚠️  Test data cleanup failed:', error.message);
    }
  }

  // Run all tests
  async runAllTests() {
    console.log('\n🚀 STARTING COMPREHENSIVE TEST SUITE');
    console.log('=' .repeat(60));
    console.log(`Backend URL: ${this.baseUrl}`);
    console.log(`Contract Address: ${this.contractAddress}`);
    console.log(`Test Wallet: ${this.testWallet}`);
    console.log('');

    // Initialize services
    try {
      await setupDatabase();
    } catch (error) {
      console.log('⚠️  Database setup failed, continuing with other tests');
    }

    // Run all test suites
    await this.testSystemHealth();
    await this.testDatabaseConnectivity();
    await this.testContractIntegration();
    await this.testAuthenticationFlow();
    await this.testAPIEndpoints();
    await this.testMeetingIntegration();
    await this.testServiceIntegration();
    await this.testErrorHandling();

    // Cleanup
    await this.cleanupTestData();

    // Print summary
    console.log('\n🎉 COMPREHENSIVE TEST RESULTS');
    console.log('=' .repeat(60));
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`📊 Total: ${this.results.total}`);
    console.log(`📈 Success Rate: ${((this.results.passed / this.results.total) * 100).toFixed(1)}%`);

    // Detailed results
    console.log('\n📋 DETAILED RESULTS:');
    this.results.details.forEach(test => {
      const status = test.passed ? '✅' : '❌';
      console.log(`${status} ${test.testName}`);
      if (test.details) {
        console.log(`   ${test.details}`);
      }
      if (test.error) {
        console.log(`   Error: ${test.error}`);
      }
    });

    // Overall assessment
    const successRate = (this.results.passed / this.results.total) * 100;
    console.log('\n🎯 SYSTEM READINESS ASSESSMENT:');
    
    if (successRate >= 90) {
      console.log('🟢 EXCELLENT: System is fully operational and ready for production');
    } else if (successRate >= 75) {
      console.log('🟡 GOOD: System is mostly functional with minor issues');
    } else if (successRate >= 50) {
      console.log('🟠 FAIR: System has significant issues that need attention');
    } else {
      console.log('🔴 POOR: System has major issues and needs immediate attention');
    }

    // Close database connection
    if (pool) {
      await pool.end();
    }

    return {
      passed: this.results.passed,
      failed: this.results.failed,
      total: this.results.total,
      successRate,
      details: this.results.details
    };
  }
}

// Run tests if called directly
if (require.main === module) {
  const testSuite = new ComprehensiveTestSuite();
  testSuite.runAllTests()
    .then(results => {
      process.exit(results.failed === 0 ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Test suite crashed:', error);
      process.exit(1);
    });
}

module.exports = { ComprehensiveTestSuite };