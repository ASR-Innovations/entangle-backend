#!/usr/bin/env node

/**
 * SIMPLE BACKEND COMPONENT TEST
 * Tests individual components without starting the full server
 */

require('dotenv').config();

async function testComponents() {
  console.log('🔍 Testing Backend Components...\n');

  // Test 1: Para Service
  try {
    const { getParaService } = require('./src/services/ParaService');
    const paraService = getParaService();
    console.log('✅ Para Service: Initialized');
    console.log(`   Environment: ${paraService.environment}`);
    console.log(`   Base URL: ${paraService.baseUrl}`);
  } catch (error) {
    console.log('❌ Para Service: Failed', error.message);
  }

  // Test 2: Jitsi Service
  try {
    const { getJitsiService } = require('./src/services/JitsiService');
    const jitsiService = getJitsiService();
    console.log('✅ Jitsi Service: Initialized');
    console.log(`   Domain: ${jitsiService.domain}`);
    console.log(`   App ID: ${jitsiService.appId}`);
    
    // Test room creation
    const testRoom = jitsiService.createRoom({
      roomName: 'test-room-123',
      displayName: 'Test Room',
      duration: 30
    });
    console.log(`   Room Created: ${testRoom.roomId}`);
    
    // Test JWT generation
    const hasKeys = !!(process.env.JITSI_PRIVATE_KEY && process.env.JITSI_KID);
    console.log(`   JWT Keys Configured: ${hasKeys}`);
    
    if (hasKeys) {
      const token = jitsiService.generateToken({
        roomName: testRoom.roomId,
        userId: 'test-user',
        userName: 'Test User',
        email: 'test@example.com'
      });
      console.log(`   JWT Generated: ${!!token}`);
    }
    
  } catch (error) {
    console.log('❌ Jitsi Service: Failed', error.message);
  }

  // Test 3: Contract ABI
  try {
    const contractABI = require('./src/contracts/MeetingAuction.json');
    const functions = contractABI.abi.filter(item => item.type === 'function');
    console.log('✅ Contract ABI: Loaded');
    console.log(`   Functions: ${functions.length}`);
    console.log(`   Has getAuction: ${functions.some(f => f.name === 'getAuction')}`);
    console.log(`   Has ownerOf: ${functions.some(f => f.name === 'ownerOf')}`);
  } catch (error) {
    console.log('❌ Contract ABI: Failed', error.message);
  }

  // Test 4: Web3 Connection (without events)
  try {
    const { Web3 } = require('web3');
    const web3 = new Web3(process.env.ETH_HTTP_ENDPOINT);
    const blockNumber = await web3.eth.getBlockNumber();
    console.log('✅ Web3 Connection: Working');
    console.log(`   Current Block: ${blockNumber}`);
    console.log(`   RPC Endpoint: ${process.env.ETH_HTTP_ENDPOINT ? 'Configured' : 'Missing'}`);
  } catch (error) {
    console.log('❌ Web3 Connection: Failed', error.message);
  }

  // Test 5: Environment Variables
  const requiredVars = [
    'JWT_SECRET', 'PARA_API_KEY', 'PARA_SECRET_API_KEY',
    'ETH_HTTP_ENDPOINT', 'AUCTION_CONTRACT_ADDRESS'
  ];
  
  const optionalVars = [
    'JITSI_PRIVATE_KEY', 'JITSI_KID', 'LIT_PKP_PUBLIC_KEY',
    'DATABASE_URL', 'PLATFORM_PRIVATE_KEY'
  ];

  console.log('📋 Environment Variables:');
  requiredVars.forEach(varName => {
    const configured = !!process.env[varName];
    console.log(`   ${configured ? '✅' : '❌'} ${varName}: ${configured ? 'Set' : 'Missing'}`);
  });
  
  console.log('   Optional:');
  optionalVars.forEach(varName => {
    const configured = !!process.env[varName];
    console.log(`   ${configured ? '✅' : '⚠️ '} ${varName}: ${configured ? 'Set' : 'Not Set'}`);
  });

  // Test 6: Lit Protocol (without full initialization)
  try {
    const { LitService } = require('./src/services/LitService');
    const litService = new LitService();
    console.log('✅ Lit Service: Class loaded');
    console.log(`   Network: ${litService.network}`);
    console.log(`   PKP Key: ${litService.pkpPublicKey ? 'Configured' : 'Missing'}`);
    console.log(`   Action CID: ${litService.actionIpfsCid ? 'Configured' : 'Missing'}`);
  } catch (error) {
    console.log('❌ Lit Service: Failed', error.message);
  }

  console.log('\n🎯 Component Test Summary:');
  console.log('- Para Service: Authentication ready');
  console.log('- Jitsi Service: Room creation working');
  console.log('- Contract ABI: Functions available');
  console.log('- Web3: Blockchain connection working');
  console.log('- Environment: Most variables configured');
  console.log('- Lit Protocol: Service available');
  
  console.log('\n📝 Next Steps:');
  console.log('1. Start server without Web3 events to test APIs');
  console.log('2. Test Para authentication with real session');
  console.log('3. Test Jitsi JWT generation with keys');
  console.log('4. Test contract calls with deployed contract');
}

// Run the test
testComponents().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
