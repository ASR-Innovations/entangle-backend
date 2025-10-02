#!/usr/bin/env node

/**
 * BACKEND SERVER COMPREHENSIVE TEST
 * Tests the actual running backend server with real API calls
 * 
 * PREREQUISITES:
 * 1. Backend server must be running: npm run dev
 * 2. Database must be configured
 * 3. Environment variables must be set
 */

require('dotenv').config();
const axios = require('axios');
const { ethers } = require('ethers');

// Configuration
const CONFIG = {
  BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:5009',
  CONTRACT_ADDRESS: '0xB5D6eaD3f2b302ab38D59617C179a2f61a4ca0EC',
  RPC_URL: process.env.RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc',
  TEST_WALLET: '0x84c30c7b7cb3ce9f075550a26e6485958fbd2ee7',
  TEST_EMAIL: 'test@example.com'
};

console.log('🚀 BACKEND SERVER COMPREHENSIVE TEST');
console.log('=' .repeat(60));
console.log(`Backend URL: ${CONFIG.BACKEND_URL}`);
console.log(`Contract Address: ${CONFIG.CONTRACT_ADDRESS}`);
console.log(`Test Wallet: ${CONFIG.TEST_WALLET}`);
console.log('');

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  details: []
};

function logTest(testName, passed, details = '') {
  testResults.total++;
  if (passed) {
    testResults.passed++;
    console.log(`✅ ${testName}`);
  } else {
    testResults.failed++;
    console.log(`❌ ${testName}`);
  }
  if (details) {
    console.log(`   ${details}`);
  }
  testResults.details.push({ testName, passed, details });
}

/**
 * Test 1: Server Health Check
 */
async function testServerHealth() {
  console.log('\n📋 TEST 1: SERVER HEALTH CHECK');
  console.log('-'.repeat(40));
  
  try {
    const response = await axios.get(`${CONFIG.BACKEND_URL}/health`, { timeout: 5000 });
    
    if (response.status === 200 && response.data.status === 'ok') {
      logTest('Server is running', true, `Status: ${response.data.status}`);
      logTest('Database configured', response.data.services.database === 'configured', 
        `Database: ${response.data.services.database}`);
      logTest('Blockchain configured', response.data.services.blockchain === 'configured',
        `Blockchain: ${response.data.services.blockchain}`);
      logTest('Para configured', response.data.services.para === 'configured',
        `Para: ${response.data.services.para}`);
      logTest('Jitsi configured', response.data.services.jitsi === 'configured',
        `Jitsi: ${response.data.services.jitsi}`);
      return true;
    } else {
      logTest('Server health check', false, `Unexpected response: ${response.status}`);
      return false;
    }
  } catch (error) {
    logTest('Server health check', false, `Error: ${error.message}`);
    return false;
  }
}

/**
 * Test 2: Authentication Endpoints
 */
async function testAuthenticationEndpoints() {
  console.log('\n📋 TEST 2: AUTHENTICATION ENDPOINTS');
  console.log('-'.repeat(40));
  
  // Test Para auth endpoint
  try {
    const paraResponse = await axios.post(`${CONFIG.BACKEND_URL}/api/auth/para-auth`, {
      verificationToken: 'test-token'
    }).catch(err => err.response);
    
    if (paraResponse.status === 400) {
      logTest('Para auth endpoint responding', true, 'Returns validation error as expected');
    } else {
      logTest('Para auth endpoint', false, `Unexpected status: ${paraResponse.status}`);
    }
  } catch (error) {
    logTest('Para auth endpoint', false, `Error: ${error.message}`);
  }
  
  // Test session import endpoint
  try {
    const sessionResponse = await axios.post(`${CONFIG.BACKEND_URL}/api/auth/import-session`, {
      session: 'test-session'
    }).catch(err => err.response);
    
    if (sessionResponse.status === 400) {
      logTest('Session import endpoint responding', true, 'Returns validation error as expected');
    } else {
      logTest('Session import endpoint', false, `Unexpected status: ${sessionResponse.status}`);
    }
  } catch (error) {
    logTest('Session import endpoint', false, `Error: ${error.message}`);
  }
  
  // Test JWT verification endpoint
  try {
    const verifyResponse = await axios.get(`${CONFIG.BACKEND_URL}/api/auth/verify`, {
      headers: { Authorization: 'Bearer invalid-token' }
    }).catch(err => err.response);
    
    if (verifyResponse.status === 401) {
      logTest('JWT verification endpoint responding', true, 'Returns unauthorized as expected');
    } else {
      logTest('JWT verification endpoint', false, `Unexpected status: ${verifyResponse.status}`);
    }
  } catch (error) {
    logTest('JWT verification endpoint', false, `Error: ${error.message}`);
  }
}

/**
 * Test 3: Auction Endpoints
 */
async function testAuctionEndpoints() {
  console.log('\n📋 TEST 3: AUCTION ENDPOINTS');
  console.log('-'.repeat(40));
  
  // Test active auctions endpoint
  try {
    const activeResponse = await axios.get(`${CONFIG.BACKEND_URL}/api/auctions/active`);
    
    if (activeResponse.status === 200 && activeResponse.data.success) {
      logTest('Active auctions endpoint', true, 
        `Returns ${activeResponse.data.auctions.length} auctions`);
      
      // Check if auctions have expected structure
      if (activeResponse.data.auctions.length > 0) {
        const auction = activeResponse.data.auctions[0];
        const hasRequiredFields = auction.id && auction.title && auction.creatorWallet;
        logTest('Auction data structure', hasRequiredFields, 
          hasRequiredFields ? 'Has required fields' : 'Missing required fields');
        
        // Check for new contract fields
        const hasNewFields = auction.nftTokenId !== undefined && auction.sellerName !== undefined;
        logTest('New contract fields present', hasNewFields,
          hasNewFields ? 'Has NFT and seller fields' : 'Missing new contract fields');
      }
    } else {
      logTest('Active auctions endpoint', false, `Unexpected response: ${activeResponse.status}`);
    }
  } catch (error) {
    logTest('Active auctions endpoint', false, `Error: ${error.message}`);
  }
  
  // Test auction creation endpoint (with mock data)
  try {
    const jwt = require('jsonwebtoken');
    const mockToken = jwt.sign({
      userId: 1,
      paraUserId: 'test_para_user_123',
      authType: 'email',
      identifier: CONFIG.TEST_EMAIL,
      email: CONFIG.TEST_EMAIL,
      displayName: 'Test User',
      role: 'para_user',
      hasWallet: true
    }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
    
    const auctionData = {
      title: 'Test Auction API',
      description: 'Testing auction creation API',
      duration: 100,
      reservePrice: 0.1,
      meetingDuration: 60,
      creatorWallet: CONFIG.TEST_WALLET,
      transactionHash: '0x' + '0'.repeat(64) // Mock transaction hash
    };
    
    const createResponse = await axios.post(`${CONFIG.BACKEND_URL}/api/auctions/created`, auctionData, {
      headers: {
        'Authorization': `Bearer ${mockToken}`,
        'Content-Type': 'application/json'
      }
    }).catch(err => err.response);
    
    if (createResponse.status === 200) {
      logTest('Auction creation endpoint', true, 'Successfully created auction');
    } else if (createResponse.status === 400) {
      logTest('Auction creation endpoint', true, 'Returns validation error (expected with mock data)');
    } else {
      logTest('Auction creation endpoint', false, `Unexpected status: ${createResponse.status}`);
    }
  } catch (error) {
    logTest('Auction creation endpoint', false, `Error: ${error.message}`);
  }
  
  // Test user created auctions endpoint
  try {
    const jwt = require('jsonwebtoken');
    const mockToken = jwt.sign({
      userId: 1,
      paraUserId: 'test_para_user_123',
      authType: 'email',
      identifier: CONFIG.TEST_EMAIL,
      email: CONFIG.TEST_EMAIL,
      displayName: 'Test User',
      role: 'para_user',
      hasWallet: true
    }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
    
    const userAuctionsResponse = await axios.get(`${CONFIG.BACKEND_URL}/api/auctions/user/created`, {
      headers: { Authorization: `Bearer ${mockToken}` }
    });
    
    if (userAuctionsResponse.status === 200) {
      logTest('User created auctions endpoint', true, 
        `Returns ${userAuctionsResponse.data.auctions.length} user auctions`);
    } else {
      logTest('User created auctions endpoint', false, `Status: ${userAuctionsResponse.status}`);
    }
  } catch (error) {
    logTest('User created auctions endpoint', false, `Error: ${error.message}`);
  }
}

/**
 * Test 4: Meeting Endpoints
 */
async function testMeetingEndpoints() {
  console.log('\n📋 TEST 4: MEETING ENDPOINTS');
  console.log('-'.repeat(40));
  
  // Test direct meeting creation
  try {
    const meetingData = {
      hostName: 'Test Host',
      hostEmail: 'host@test.com',
      guestName: 'Test Guest',
      guestEmail: 'guest@test.com',
      meetingName: 'Test API Meeting',
      duration: 30
    };
    
    const meetingResponse = await axios.post(`${CONFIG.BACKEND_URL}/api/meetings/create-direct`, meetingData);
    
    if (meetingResponse.status === 200 && meetingResponse.data.success) {
      logTest('Direct meeting creation', true, 
        `Created meeting: ${meetingResponse.data.meeting.roomId}`);
      
      // Test meeting info endpoint
      const roomId = meetingResponse.data.meeting.roomId;
      const infoResponse = await axios.get(`${CONFIG.BACKEND_URL}/api/meetings/${roomId}`);
      
      if (infoResponse.status === 200) {
        logTest('Meeting info endpoint', true, 'Successfully retrieved meeting info');
      } else {
        logTest('Meeting info endpoint', false, `Status: ${infoResponse.status}`);
      }
    } else {
      logTest('Direct meeting creation', false, `Status: ${meetingResponse.status}`);
    }
  } catch (error) {
    logTest('Direct meeting creation', false, `Error: ${error.message}`);
  }
  
  // Test simple meeting creation (with auth)
  try {
    const jwt = require('jsonwebtoken');
    const mockToken = jwt.sign({
      userId: 1,
      paraUserId: 'test_para_user_123',
      authType: 'email',
      identifier: CONFIG.TEST_EMAIL,
      email: CONFIG.TEST_EMAIL,
      displayName: 'Test User',
      role: 'para_user',
      hasWallet: true
    }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
    
    const simpleMeetingData = {
      meetingName: 'Test Simple Meeting',
      duration: 45,
      guestEmail: 'guest@test.com'
    };
    
    const simpleMeetingResponse = await axios.post(`${CONFIG.BACKEND_URL}/api/meetings/create-simple`, simpleMeetingData, {
      headers: { Authorization: `Bearer ${mockToken}` }
    }).catch(err => err.response);
    
    if (simpleMeetingResponse.status === 200) {
      logTest('Simple meeting creation', true, 'Successfully created simple meeting');
    } else if (simpleMeetingResponse.status === 400) {
      logTest('Simple meeting creation', true, 'Returns validation error (expected)');
    } else {
      logTest('Simple meeting creation', false, `Status: ${simpleMeetingResponse.status}`);
    }
  } catch (error) {
    logTest('Simple meeting creation', false, `Error: ${error.message}`);
  }
  
  // Test gated meeting creation
  try {
    const jwt = require('jsonwebtoken');
    const mockToken = jwt.sign({
      userId: 1,
      paraUserId: 'test_para_user_123',
      authType: 'email',
      identifier: CONFIG.TEST_EMAIL,
      email: CONFIG.TEST_EMAIL,
      displayName: 'Test User',
      role: 'para_user',
      hasWallet: true
    }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
    
    const gatedMeetingData = {
      meetingName: 'Test Gated Meeting',
      duration: 60,
      auctionId: 1,
      nftTokenId: 1
    };
    
    const gatedMeetingResponse = await axios.post(`${CONFIG.BACKEND_URL}/api/meetings/create-gated`, gatedMeetingData, {
      headers: { Authorization: `Bearer ${mockToken}` }
    }).catch(err => err.response);
    
    if (gatedMeetingResponse.status === 200) {
      logTest('Gated meeting creation', true, 'Successfully created gated meeting');
    } else if (gatedMeetingResponse.status === 400) {
      logTest('Gated meeting creation', true, 'Returns validation error (expected with mock data)');
    } else {
      logTest('Gated meeting creation', false, `Status: ${gatedMeetingResponse.status}`);
    }
  } catch (error) {
    logTest('Gated meeting creation', false, `Error: ${error.message}`);
  }
}

/**
 * Test 5: Contract Integration
 */
async function testContractIntegration() {
  console.log('\n📋 TEST 5: CONTRACT INTEGRATION');
  console.log('-'.repeat(40));
  
  try {
    // Test contract service directly
    const { getContractService } = require('./src/services/ContractService');
    const contractService = getContractService();
    await contractService.initialize();
    
    logTest('Contract service initialization', true, 
      `Contract: ${contractService.contractAddress}, Network: ${contractService.network}`);
    
    // Test contract stats
    const stats = await contractService.getContractStats();
    logTest('Contract stats retrieval', true, 
      `Auctions: ${stats.auctionCounter}, Fee: ${stats.platformFee}bps, Owner: ${stats.owner}`);
    
    // Test active auctions
    const activeAuctions = await contractService.getActiveAuctions(10);
    logTest('Active auctions retrieval', true, 
      `Found ${activeAuctions.length} active auctions`);
    
    // Test NFT functions (if wallet has NFTs)
    try {
      const nfts = await contractService.getNFTsOwnedByUser(CONFIG.TEST_WALLET);
      logTest('NFT ownership check', true, 
        `User has ${nfts.tokenIds.length} NFTs`);
      
      if (nfts.tokenIds.length > 0) {
        const tokenId = nfts.tokenIds[0];
        const metadata = await contractService.getNFTMetadata(tokenId);
        logTest('NFT metadata retrieval', true, 
          `Token ${tokenId}: Auction ${metadata.auctionId}`);
        
        const canBurn = await contractService.canBurnForMeeting(tokenId, CONFIG.TEST_WALLET);
        logTest('NFT burn eligibility check', true, 
          `Can burn token ${tokenId}: ${canBurn}`);
      }
    } catch (error) {
      logTest('NFT functions', false, `Error: ${error.message}`);
    }
    
    // Test access functions
    try {
      if (activeAuctions.length > 0) {
        const auctionId = activeAuctions[0];
        const canAccess = await contractService.canAccessMeeting(auctionId, CONFIG.TEST_WALLET);
        logTest('Meeting access check', true, 
          `Can access auction ${auctionId}: ${canAccess}`);
      }
    } catch (error) {
      logTest('Access functions', false, `Error: ${error.message}`);
    }
    
  } catch (error) {
    logTest('Contract integration', false, `Error: ${error.message}`);
  }
}

/**
 * Test 6: Database Integration
 */
async function testDatabaseIntegration() {
  console.log('\n📋 TEST 6: DATABASE INTEGRATION');
  console.log('-'.repeat(40));
  
  try {
    const { pool } = require('./src/config/database');
    
    // Test database connection
    const dbTest = await pool.query('SELECT NOW() as current_time');
    logTest('Database connection', true, 
      `Connected at: ${dbTest.rows[0].current_time}`);
    
    // Test tables exist
    const tablesQuery = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    const tableNames = tablesQuery.rows.map(row => row.table_name);
    const expectedTables = ['users', 'auctions', 'meetings', 'meeting_access_logs', 'notifications'];
    const hasAllTables = expectedTables.every(table => tableNames.includes(table));
    
    logTest('Database tables', hasAllTables, 
      `Tables: ${tableNames.join(', ')}`);
    
    // Test auction data
    const auctionCount = await pool.query('SELECT COUNT(*) as count FROM auctions');
    logTest('Auction data', true, 
      `Found ${auctionCount.rows[0].count} auctions in database`);
    
    // Test meeting data
    const meetingCount = await pool.query('SELECT COUNT(*) as count FROM meetings');
    logTest('Meeting data', true, 
      `Found ${meetingCount.rows[0].count} meetings in database`);
    
  } catch (error) {
    logTest('Database integration', false, `Error: ${error.message}`);
  }
}

/**
 * Test 7: Error Handling
 */
async function testErrorHandling() {
  console.log('\n📋 TEST 7: ERROR HANDLING');
  console.log('-'.repeat(40));
  
  // Test invalid endpoints
  try {
    const invalidResponse = await axios.get(`${CONFIG.BACKEND_URL}/api/invalid-endpoint`).catch(err => err.response);
    if (invalidResponse.status === 404) {
      logTest('404 error handling', true, 'Returns 404 for invalid endpoints');
    } else {
      logTest('404 error handling', false, `Unexpected status: ${invalidResponse.status}`);
    }
  } catch (error) {
    logTest('404 error handling', false, `Error: ${error.message}`);
  }
  
  // Test invalid JSON
  try {
    const invalidJsonResponse = await axios.post(`${CONFIG.BACKEND_URL}/api/auctions/created`, 
      'invalid json', 
      { headers: { 'Content-Type': 'application/json' } }
    ).catch(err => err.response);
    
    if (invalidJsonResponse.status === 400) {
      logTest('Invalid JSON handling', true, 'Returns 400 for invalid JSON');
    } else {
      logTest('Invalid JSON handling', false, `Unexpected status: ${invalidJsonResponse.status}`);
    }
  } catch (error) {
    logTest('Invalid JSON handling', false, `Error: ${error.message}`);
  }
  
  // Test missing authentication
  try {
    const noAuthResponse = await axios.post(`${CONFIG.BACKEND_URL}/api/auctions/created`, {
      title: 'Test'
    }).catch(err => err.response);
    
    if (noAuthResponse.status === 401) {
      logTest('Missing auth handling', true, 'Returns 401 for missing authentication');
    } else {
      logTest('Missing auth handling', false, `Unexpected status: ${noAuthResponse.status}`);
    }
  } catch (error) {
    logTest('Missing auth handling', false, `Error: ${error.message}`);
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🎯 Starting Backend Server Tests...\n');
  
  await testServerHealth();
  await testAuthenticationEndpoints();
  await testAuctionEndpoints();
  await testMeetingEndpoints();
  await testContractIntegration();
  await testDatabaseIntegration();
  await testErrorHandling();
  
  // Print summary
  console.log('\n🎉 TEST RESULTS SUMMARY');
  console.log('=' .repeat(60));
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📊 Total: ${testResults.total}`);
  console.log(`📈 Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
  
  console.log('\n📋 DETAILED RESULTS:');
  testResults.details.forEach((test, index) => {
    const status = test.passed ? '✅' : '❌';
    console.log(`${status} ${test.testName}`);
    if (test.details) {
      console.log(`   ${test.details}`);
    }
  });
  
  if (testResults.failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! Backend server is working perfectly!');
  } else {
    console.log(`\n⚠️  ${testResults.failed} tests failed. Please check the issues above.`);
  }
  
  return testResults;
}

// Run if called directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { runAllTests };
