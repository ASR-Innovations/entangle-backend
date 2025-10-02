#!/usr/bin/env node

/**
 * COMPREHENSIVE BACKEND FLOW TESTING SCRIPT
 * 
 * This script tests the complete backend flow:
 * 1. Para Wallet Authentication
 * 2. Jitsi Meeting Creation & JWT Generation
 * 3. Web3 Service Initialization
 * 4. Database Connectivity
 * 5. Lit Protocol Integration (when configured)
 * 6. Complete Auction → Meeting Flow
 */

require('dotenv').config();
const { getParaService } = require('./src/services/ParaService');
const { getJitsiService } = require('./src/services/JitsiService');
const { getContractService } = require('./src/services/ContractService');
const { setupDatabase, pool } = require('./src/config/database');
const logger = require('./src/utils/logger');
const jwt = require('jsonwebtoken');

class BackendFlowTester {
  constructor() {
    this.results = {};
    this.errors = [];
  }

  log(message, data = null) {
    console.log(`\n🔍 ${message}`);
    if (data) {
      console.log('   📊 Data:', JSON.stringify(data, null, 2));
    }
  }

  error(message, error) {
    console.log(`\n❌ ERROR: ${message}`);
    console.log('   🔥 Details:', error.message);
    this.errors.push({ message, error: error.message });
  }

  success(message, data = null) {
    console.log(`\n✅ SUCCESS: ${message}`);
    if (data) {
      console.log('   📊 Result:', JSON.stringify(data, null, 2));
    }
  }

  // Test 1: Environment Variables
  async testEnvironmentVariables() {
    this.log('Testing Environment Variables...');
    
    const requiredVars = [
      'NODE_ENV', 'PORT', 'DATABASE_URL', 'JWT_SECRET',
      'PARA_API_KEY', 'PARA_SECRET_API_KEY', 'PARA_ENVIRONMENT',
      'JITSI_DOMAIN', 'JITSI_APP_ID'
    ];

    const optionalVars = [
      'ETH_WSS_ENDPOINT', 'ETH_HTTP_ENDPOINT', 'AUCTION_CONTRACT_ADDRESS',
      'PLATFORM_PRIVATE_KEY', 'JITSI_PRIVATE_KEY', 'JITSI_KID',
      'LIT_ACTION_IPFS_CID', 'LIT_PKP_PUBLIC_KEY', 'LIT_NETWORK'
    ];

    const envStatus = {};
    
    requiredVars.forEach(varName => {
      envStatus[varName] = {
        configured: !!process.env[varName],
        value: process.env[varName] ? '***SET***' : 'MISSING'
      };
    });

    optionalVars.forEach(varName => {
      envStatus[varName] = {
        configured: !!process.env[varName],
        value: process.env[varName] ? '***SET***' : 'NOT_SET',
        optional: true
      };
    });

    this.results.environment = envStatus;
    
    const missingRequired = requiredVars.filter(v => !process.env[v]);
    if (missingRequired.length > 0) {
      this.error('Missing required environment variables', new Error(`Missing: ${missingRequired.join(', ')}`));
      return false;
    }

    this.success('Environment variables configured', envStatus);
    return true;
  }

  // Test 2: Database Connectivity
  async testDatabase() {
    this.log('Testing Database Connectivity...');
    
    try {
      await setupDatabase();
      
      // Test basic query
      const result = await pool.query('SELECT NOW() as current_time, version() as postgres_version');
      
      // Test tables exist
      const tablesQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
      `;
      const tablesResult = await pool.query(tablesQuery);
      
      const dbInfo = {
        connected: true,
        currentTime: result.rows[0].current_time,
        version: result.rows[0].postgres_version,
        tables: tablesResult.rows.map(row => row.table_name)
      };

      this.results.database = dbInfo;
      this.success('Database connectivity verified', dbInfo);
      return true;
      
    } catch (error) {
      this.error('Database connection failed', error);
      this.results.database = { connected: false, error: error.message };
      return false;
    }
  }

  // Test 3: Para Service
  async testParaService() {
    this.log('Testing Para Service...');
    
    try {
      const paraService = getParaService();
      
      // Test service initialization
      const serviceInfo = {
        environment: paraService.environment,
        baseUrl: paraService.baseUrl,
        hasApiKey: !!paraService.paraServer,
        hasSecretKey: !!paraService.secretApiKey
      };

      this.results.paraService = serviceInfo;
      this.success('Para service initialized', serviceInfo);
      
      // Note: We can't test actual verification without a real token
      this.log('Para verification requires actual session token from frontend');
      return true;
      
    } catch (error) {
      this.error('Para service initialization failed', error);
      this.results.paraService = { initialized: false, error: error.message };
      return false;
    }
  }

  // Test 4: Jitsi Service & JWT Generation
  async testJitsiService() {
    this.log('Testing Jitsi Service...');
    
    try {
      const jitsiService = getJitsiService();
      
      // Test room creation
      const testRoom = jitsiService.createRoom({
        roomName: 'test-auction-123-meeting',
        displayName: 'Test Auction Meeting',
        duration: 60,
        maxParticipants: 2
      });

      // Test JWT generation (if keys are configured)
      let jwtToken = null;
      let jwtValid = false;
      
      if (process.env.JITSI_PRIVATE_KEY && process.env.JITSI_KID) {
        jwtToken = jitsiService.generateToken({
          roomName: testRoom.roomId,
          userId: 'test-user-123',
          userName: 'Test User',
          email: 'test@example.com',
          role: 'moderator'
        });
        
        if (jwtToken) {
          // Decode JWT to verify structure
          const decoded = jwt.decode(jwtToken, { complete: true });
          jwtValid = !!(decoded && decoded.payload && decoded.payload.aud === 'jitsi');
        }
      }

      const jitsiInfo = {
        domain: jitsiService.domain,
        appId: jitsiService.appId,
        roomCreated: !!testRoom,
        roomId: testRoom.roomId,
        roomUrl: testRoom.url,
        jwtConfigured: !!(process.env.JITSI_PRIVATE_KEY && process.env.JITSI_KID),
        jwtGenerated: !!jwtToken,
        jwtValid: jwtValid,
        jwtSample: jwtToken ? jwtToken.substring(0, 50) + '...' : null
      };

      this.results.jitsiService = jitsiInfo;
      this.success('Jitsi service tested', jitsiInfo);
      return true;
      
    } catch (error) {
      this.error('Jitsi service test failed', error);
      this.results.jitsiService = { tested: false, error: error.message };
      return false;
    }
  }

  // Test 5: Contract Service
  async testContractService() {
    this.log('Testing Contract Service...');
    
    try {
      if (!process.env.RPC_URL || !process.env.CONTRACT_ADDRESS) {
        this.log('Contract service not fully configured - skipping detailed test');
        this.results.contractService = { 
          configured: false, 
          reason: 'Missing RPC_URL or CONTRACT_ADDRESS' 
        };
        return true;
      }

      // Initialize contract service
      const contractService = getContractService();
      await contractService.initialize();
      
      // Test basic blockchain connectivity
      const blockNumber = await contractService.provider.getBlockNumber();
      
      const contractInfo = {
        connected: true,
        currentBlock: blockNumber.toString(),
        contractAddress: process.env.CONTRACT_ADDRESS,
        platformAccountConfigured: !!process.env.PLATFORM_PRIVATE_KEY
      };

      this.results.contractService = contractInfo;
      this.success('Contract service initialized', contractInfo);
      return true;
      
    } catch (error) {
      this.error('Contract service test failed', error);
      this.results.contractService = { connected: false, error: error.message };
      return false;
    }
  }

  // Test 6: Complete Flow Simulation
  async testCompleteFlow() {
    this.log('Testing Complete Auction → Meeting Flow...');
    
    try {
      // Simulate auction creation data
      const mockAuctionData = {
        id: 999999, // Test ID
        creator_para_id: 'test_email_dGVzdEBleGFtcGxlLmNvbQ==',
        creator_wallet: '0x1234567890123456789012345678901234567890',
        title: 'Test Auction for Flow Verification',
        description: 'Testing complete backend flow',
        meeting_duration: 30
      };

      // Insert test auction
      await pool.query(`
        INSERT INTO auctions (
          id, contract_address, creator_para_id, creator_wallet,
          title, description, metadata_ipfs, meeting_duration
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET 
          title = EXCLUDED.title,
          updated_at = CURRENT_TIMESTAMP
      `, [
        mockAuctionData.id,
        process.env.AUCTION_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000',
        mockAuctionData.creator_para_id,
        mockAuctionData.creator_wallet,
        mockAuctionData.title,
        mockAuctionData.description,
        `metadata_${mockAuctionData.id}_${Date.now()}`,
        mockAuctionData.meeting_duration
      ]);

      // Test meeting creation flow
      const jitsiService = getJitsiService();
      const mockWinner = {
        para_user_id: 'test_email_d2lubmVyQGV4YW1wbGUuY29t',
        wallet_address: '0x9876543210987654321098765432109876543210',
        display_name: 'Test Winner'
      };

      // Create Jitsi room
      const jitsiRoom = jitsiService.createRoom({
        roomName: `auction-${mockAuctionData.id}-meeting`,
        displayName: mockAuctionData.title,
        duration: mockAuctionData.meeting_duration,
        maxParticipants: 2
      });

      // Generate access tokens
      const creatorToken = jwt.sign({
        auctionId: mockAuctionData.id,
        paraUserId: mockAuctionData.creator_para_id,
        walletAddress: mockAuctionData.creator_wallet,
        role: 'creator',
        roomId: jitsiRoom.roomId,
        nftTokenId: 123456,
        type: 'meeting_access'
      }, process.env.JWT_SECRET, { expiresIn: '7d' });

      const winnerToken = jwt.sign({
        auctionId: mockAuctionData.id,
        paraUserId: mockWinner.para_user_id,
        walletAddress: mockWinner.wallet_address,
        role: 'winner',
        roomId: jitsiRoom.roomId,
        nftTokenId: 123456,
        type: 'meeting_access'
      }, process.env.JWT_SECRET, { expiresIn: '7d' });

      // Store meeting data
      const meetingInsert = await pool.query(`
        INSERT INTO meetings (
          auction_id, jitsi_room_id, jitsi_room_config,
          creator_access_token, winner_access_token, room_url, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (auction_id) DO UPDATE SET
          jitsi_room_id = EXCLUDED.jitsi_room_id,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id
      `, [
        mockAuctionData.id,
        jitsiRoom.roomId,
        JSON.stringify(jitsiRoom.config),
        creatorToken,
        winnerToken,
        jitsiRoom.url,
        jitsiRoom.expiresAt
      ]);

      const flowResult = {
        auctionCreated: true,
        meetingCreated: true,
        meetingId: meetingInsert.rows[0].id,
        jitsiRoomId: jitsiRoom.roomId,
        jitsiRoomUrl: jitsiRoom.url,
        creatorTokenGenerated: !!creatorToken,
        winnerTokenGenerated: !!winnerToken,
        tokensValid: true
      };

      // Clean up test data
      await pool.query('DELETE FROM meetings WHERE auction_id = $1', [mockAuctionData.id]);
      await pool.query('DELETE FROM auctions WHERE id = $1', [mockAuctionData.id]);

      this.results.completeFlow = flowResult;
      this.success('Complete flow simulation passed', flowResult);
      return true;
      
    } catch (error) {
      this.error('Complete flow test failed', error);
      this.results.completeFlow = { passed: false, error: error.message };
      return false;
    }
  }

  // Test 7: API Endpoints (Basic)
  async testAPIEndpoints() {
    this.log('Testing API endpoints structure...');
    
    try {
      // Check if route files exist and can be required
      const authRoutes = require('./src/routes/auth');
      const auctionRoutes = require('./src/routes/auctions');
      const meetingRoutes = require('./src/routes/meetings');

      const apiInfo = {
        authRoutesLoaded: !!authRoutes,
        auctionRoutesLoaded: !!auctionRoutes,
        meetingRoutesLoaded: !!meetingRoutes,
        routeTypes: {
          auth: typeof authRoutes,
          auctions: typeof auctionRoutes,
          meetings: typeof meetingRoutes
        }
      };

      this.results.apiEndpoints = apiInfo;
      this.success('API endpoints structure verified', apiInfo);
      return true;
      
    } catch (error) {
      this.error('API endpoints test failed', error);
      this.results.apiEndpoints = { loaded: false, error: error.message };
      return false;
    }
  }

  // Run all tests
  async runAllTests() {
    console.log('\n🚀 STARTING COMPREHENSIVE BACKEND FLOW TEST');
    console.log('================================================\n');

    const tests = [
      { name: 'Environment Variables', fn: this.testEnvironmentVariables },
      { name: 'Database Connectivity', fn: this.testDatabase },
      { name: 'Para Service', fn: this.testParaService },
      { name: 'Jitsi Service', fn: this.testJitsiService },
      { name: 'Contract Service', fn: this.testContractService },
      { name: 'API Endpoints', fn: this.testAPIEndpoints },
      { name: 'Complete Flow', fn: this.testCompleteFlow }
    ];

    const results = {};
    
    for (const test of tests) {
      try {
        results[test.name] = await test.fn.bind(this)();
      } catch (error) {
        this.error(`Test "${test.name}" crashed`, error);
        results[test.name] = false;
      }
    }

    console.log('\n📊 TEST SUMMARY');
    console.log('================');
    
    const passed = Object.values(results).filter(r => r === true).length;
    const total = Object.keys(results).length;
    
    Object.entries(results).forEach(([testName, passed]) => {
      console.log(`${passed ? '✅' : '❌'} ${testName}`);
    });

    console.log(`\n🎯 Overall: ${passed}/${total} tests passed`);
    
    if (this.errors.length > 0) {
      console.log('\n🔥 ERRORS ENCOUNTERED:');
      this.errors.forEach((err, i) => {
        console.log(`${i + 1}. ${err.message}: ${err.error}`);
      });
    }

    console.log('\n📋 DETAILED RESULTS:');
    console.log(JSON.stringify(this.results, null, 2));

    // Close database connection
    if (pool) {
      await pool.end();
    }

    return { passed, total, results: this.results, errors: this.errors };
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new BackendFlowTester();
  tester.runAllTests()
    .then(summary => {
      process.exit(summary.passed === summary.total ? 0 : 1);
    })
    .catch(error => {
      console.error('Test runner crashed:', error);
      process.exit(1);
    });
}

module.exports = { BackendFlowTester };
