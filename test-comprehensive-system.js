#!/usr/bin/env node

/**
 * COMPREHENSIVE SYSTEM TESTING
 * Tests the complete backend system with the new contract address
 */

require('dotenv').config();
const axios = require('axios');
const { ethers } = require('ethers');

// Configuration
const CONFIG = {
  BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:5000',
  CONTRACT_ADDRESS: '0xB5D6eaD3f2b302ab38D59617C179a2f61a4ca0EC',
  RPC_URL: process.env.RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc',
  TEST_WALLET: '0x161d026cd7855bc783506183546c968cd96b4896' // Test wallet
};

console.log('🧪 COMPREHENSIVE SYSTEM TESTING');
console.log('=' .repeat(60));
console.log(`Contract Address: ${CONFIG.CONTRACT_ADDRESS}`);
console.log(`Backend URL: ${CONFIG.BACKEND_URL}`);
console.log(`RPC URL: ${CONFIG.RPC_URL}`);

/**
 * Test 1: Backend Health Check
 */
async function testBackendHealth() {
  console.log('\n📋 TEST 1: BACKEND HEALTH CHECK');
  console.log('-'.repeat(40));
  
  try {
    const response = await axios.get(`${CONFIG.BACKEND_URL}/health`);
    console.log('✅ Backend is running');
    console.log('Status:', response.data.status);
    console.log('Services:', JSON.stringify(response.data.services, null, 2));
    return true;
  } catch (error) {
    console.error('❌ Backend health check failed:', error.message);
    return false;
  }
}

/**
 * Test 2: Contract Connection
 */
async function testContractConnection() {
  console.log('\n📋 TEST 2: CONTRACT CONNECTION');
  console.log('-'.repeat(40));
  
  try {
    const provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL);
    const network = await provider.getNetwork();
    console.log('✅ RPC Connection successful');
    console.log('Network:', network.name, '(Chain ID:', network.chainId, ')');
    
    // Load contract ABI
    const MeetingAuctionABI = require('./src/contracts/MeetingAuction.json');
    const contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, MeetingAuctionABI, provider);
    
    // Test basic contract calls
    const auctionCounter = await contract.auctionCounter();
    const platformFee = await contract.platformFee();
    const owner = await contract.owner();
    
    console.log('✅ Contract connection successful');
    console.log('Contract Address:', CONFIG.CONTRACT_ADDRESS);
    console.log('Total Auctions:', auctionCounter.toString());
    console.log('Platform Fee:', platformFee.toString(), 'basis points');
    console.log('Owner:', owner);
    
    return {
      success: true,
      contract,
      provider,
      stats: {
        auctionCounter: auctionCounter.toString(),
        platformFee: platformFee.toString(),
        owner
      }
    };
  } catch (error) {
    console.error('❌ Contract connection failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test 3: Contract Functions
 */
async function testContractFunctions(contract) {
  console.log('\n📋 TEST 3: CONTRACT FUNCTIONS');
  console.log('-'.repeat(40));
  
  try {
    // Test getActiveAuctions
    console.log('\n3.1 Testing getActiveAuctions():');
    const activeAuctions = await contract.getActiveAuctions();
    console.log('✅ Active auctions:', activeAuctions.length);
    
    // Test getAuction for first auction if exists
    if (activeAuctions.length > 0) {
      console.log('\n3.2 Testing getAuction():');
      const auctionId = activeAuctions[0];
      const auction = await contract.getAuction(auctionId);
      console.log('✅ Auction details retrieved:');
      console.log('   ID:', auction.id.toString());
      console.log('   Host:', auction.host);
      console.log('   Ended:', auction.ended);
      console.log('   Highest Bid:', ethers.utils.formatEther(auction.highestBid));
      console.log('   NFT Token ID:', auction.nftTokenId.toString());
    }
    
    // Test NFT functions if available
    console.log('\n3.3 Testing NFT Functions:');
    try {
      // Test getNFTsOwnedByUser
      const nfts = await contract.getNFTsOwnedByUser(CONFIG.TEST_WALLET);
      console.log('✅ getNFTsOwnedByUser working');
      console.log('   Token IDs:', nfts.tokenIds.map(id => id.toString()));
      console.log('   Auction IDs:', nfts.auctionIds.map(id => id.toString()));
    } catch (error) {
      console.log('⚠️  getNFTsOwnedByUser not available or wallet has no NFTs');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Contract functions test failed:', error.message);
    return false;
  }
}

/**
 * Test 4: Meeting Creation APIs
 */
async function testMeetingAPIs() {
  console.log('\n📋 TEST 4: MEETING CREATION APIs');
  console.log('-'.repeat(40));
  
  try {
    // Test direct meeting creation (no auth required)
    console.log('\n4.1 Testing Direct Meeting Creation:');
    const meetingData = {
      hostName: 'Test Host',
      hostEmail: 'host@test.com',
      guestName: 'Test Guest',
      guestEmail: 'guest@test.com',
      meetingName: 'Test Meeting',
      duration: 30
    };
    
    const response = await axios.post(`${CONFIG.BACKEND_URL}/api/meetings/create-direct`, meetingData);
    
    if (response.data.success) {
      console.log('✅ Direct meeting creation successful');
      console.log('Room ID:', response.data.meeting.roomId);
      console.log('Host URL:', response.data.participants.host.url);
      console.log('Guest URL:', response.data.participants.guest.url);
    } else {
      console.log('❌ Direct meeting creation failed:', response.data.error);
    }
    
    return response.data.success;
  } catch (error) {
    console.error('❌ Meeting APIs test failed:', error.message);
    return false;
  }
}

/**
 * Test 5: Authentication Flow
 */
async function testAuthenticationFlow() {
  console.log('\n📋 TEST 5: AUTHENTICATION FLOW');
  console.log('-'.repeat(40));
  
  try {
    // Test Para auth endpoint
    console.log('\n5.1 Testing Para Auth Endpoint:');
    const authResponse = await axios.post(`${CONFIG.BACKEND_URL}/api/auth/para-auth`, {
      verificationToken: 'test-token'
    }).catch(err => err.response);
    
    if (authResponse.status === 400) {
      console.log('✅ Para auth endpoint responding (expecting validation error)');
      console.log('Error:', authResponse.data.error);
    } else {
      console.log('⚠️  Unexpected response:', authResponse.status, authResponse.data);
    }
    
    // Test session import endpoint
    console.log('\n5.2 Testing Session Import Endpoint:');
    const sessionResponse = await axios.post(`${CONFIG.BACKEND_URL}/api/auth/import-session`, {
      session: 'test-session'
    }).catch(err => err.response);
    
    if (sessionResponse.status === 400) {
      console.log('✅ Session import endpoint responding (expecting validation error)');
      console.log('Error:', sessionResponse.data.error);
    } else {
      console.log('⚠️  Unexpected response:', sessionResponse.status, sessionResponse.data);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Authentication flow test failed:', error.message);
    return false;
  }
}

/**
 * Test 6: Auction APIs
 */
async function testAuctionAPIs() {
  console.log('\n📋 TEST 6: AUCTION APIs');
  console.log('-'.repeat(40));
  
  try {
    // Test get active auctions
    console.log('\n6.1 Testing Get Active Auctions:');
    const response = await axios.get(`${CONFIG.BACKEND_URL}/api/auctions/active`);
    
    if (response.data.success) {
      console.log('✅ Active auctions API working');
      console.log('Total auctions:', response.data.auctions.length);
      
      if (response.data.auctions.length > 0) {
        const auction = response.data.auctions[0];
        console.log('Sample auction:');
        console.log('   ID:', auction.id);
        console.log('   Title:', auction.title);
        console.log('   Creator:', auction.creatorName);
        console.log('   Reserve Price:', auction.reservePrice, 'AVAX');
        console.log('   Highest Bid:', auction.highestBid, 'AVAX');
      }
    } else {
      console.log('❌ Active auctions API failed:', response.data.error);
    }
    
    return response.data.success;
  } catch (error) {
    console.error('❌ Auction APIs test failed:', error.message);
    return false;
  }
}

/**
 * Test 7: Database Connection
 */
async function testDatabaseConnection() {
  console.log('\n📋 TEST 7: DATABASE CONNECTION');
  console.log('-'.repeat(40));
  
  try {
    const { pool } = require('./src/config/database');
    const result = await pool.query('SELECT NOW() as current_time, version() as version');
    
    console.log('✅ Database connected successfully');
    console.log('Current time:', result.rows[0].current_time);
    console.log('PostgreSQL version:', result.rows[0].version);
    
    // Check if tables exist
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'auctions', 'meetings', 'meeting_access_logs')
      ORDER BY table_name
    `);
    
    console.log('✅ Available tables:');
    tableCheck.rows.forEach(row => {
      console.log('   -', row.table_name);
    });
    
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

/**
 * Test 8: Environment Configuration
 */
async function testEnvironmentConfig() {
  console.log('\n📋 TEST 8: ENVIRONMENT CONFIGURATION');
  console.log('-'.repeat(40));
  
  const requiredVars = [
    'JWT_SECRET',
    'DATABASE_URL',
    'PARA_API_KEY',
    'JITSI_SECRET'
  ];
  
  const optionalVars = [
    'ETH_WSS_ENDPOINT',
    'ETH_HTTP_ENDPOINT',
    'LIT_ACTION_IPFS_CID',
    'LIT_PKP_PUBLIC_KEY'
  ];
  
  console.log('Required Environment Variables:');
  requiredVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      console.log(`✅ ${varName}: ${value.substring(0, 20)}...`);
    } else {
      console.log(`❌ ${varName}: NOT SET`);
    }
  });
  
  console.log('\nOptional Environment Variables:');
  optionalVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      console.log(`✅ ${varName}: ${value.substring(0, 20)}...`);
    } else {
      console.log(`⚠️  ${varName}: NOT SET (optional)`);
    }
  });
  
  const missingRequired = requiredVars.filter(varName => !process.env[varName]);
  return missingRequired.length === 0;
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🚀 Starting Comprehensive System Tests...\n');
  
  const results = {
    backendHealth: await testBackendHealth(),
    contractConnection: await testContractConnection(),
    contractFunctions: false,
    meetingAPIs: await testMeetingAPIs(),
    authentication: await testAuthenticationFlow(),
    auctionAPIs: await testAuctionAPIs(),
    database: await testDatabaseConnection(),
    environment: await testEnvironmentConfig()
  };
  
  // Test contract functions if connection was successful
  if (results.contractConnection.success) {
    results.contractFunctions = await testContractFunctions(results.contractConnection.contract);
  }
  
  // Print summary
  console.log('\n🎉 TEST RESULTS SUMMARY');
  console.log('=' .repeat(60));
  
  Object.entries(results).forEach(([test, result]) => {
    const status = result ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${test}`);
  });
  
  const passedTests = Object.values(results).filter(result => result === true).length;
  const totalTests = Object.keys(results).length;
  
  console.log(`\n📊 Overall: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 ALL TESTS PASSED! System is ready for integration.');
  } else {
    console.log('\n⚠️  Some tests failed. Please address the issues before integration.');
  }
  
  return results;
}

// Run if called directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { runAllTests };




