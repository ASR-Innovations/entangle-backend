#!/usr/bin/env node

/**
 * TEST REAL FRONTEND PARA DATA
 * Uses actual Para session data from frontend to test backend verification
 */

require('dotenv').config();
const { Para: ParaServer } = require('@getpara/server-sdk');
const { getParaService } = require('./src/services/ParaService');
const axios = require('axios');

async function testWithRealParaData() {
  console.log('🔍 TESTING WITH REAL FRONTEND PARA DATA\n');
  
  // Real Para data from frontend
  const frontendData = {
    authInfo: {
      auth: { email: "rohit.rajsurya10@gmail.com" },
      authType: "email",
      identifier: "rohit.rajsurya10@gmail.com"
    },
    userId: "248ec087-1738-4f4a-ac03-9db5f7dc786c",
    sessionCookie: "capsule.sid=s%3A47c8d70a-3b01-4923-97b5-e3304df847f2.uxIWzqORBq8SRsKcyOGGvfBKCnVBR6m6PRG8brTjn44",
    currentWalletIds: { EVM: ["126d1c9d-4ef7-48de-88ea-9b7111d93bb6"] },
    wallets: {
      "126d1c9d-4ef7-48de-88ea-9b7111d93bb6": {
        id: "126d1c9d-4ef7-48de-88ea-9b7111d93bb6",
        userId: "248ec087-1738-4f4a-ac03-9db5f7dc786c",
        address: "0x161d026cd7855bc783506183546c968cd96b4896",
        publicKey: "0x04872f23f523263a20e6c326cce47cabd1e7b4de797ddfe00e2b7a9240551276638992f6f00986df72902d70a0fda6564f1fe3bce85020602fb5cf68490ec30a78",
        type: "EVM"
      }
    }
  };
  
  console.log('📋 Frontend Para Data:');
  console.log('Email:', frontendData.authInfo.auth.email);
  console.log('User ID:', frontendData.userId);
  console.log('Wallet Address:', frontendData.wallets[frontendData.currentWalletIds.EVM[0]].address);
  console.log('Auth Type:', frontendData.authInfo.authType);
  console.log('');
  
  // Test 1: Try to create Para instance with real user data
  console.log('1️⃣ Testing Para Server SDK with real data:');
  try {
    const paraServer = new ParaServer(process.env.PARA_API_KEY);
    console.log('✅ Para server instance created');
    
    // Test if we can get verification token (this requires frontend to be authenticated)
    console.log('Note: Verification token must come from authenticated frontend Para instance');
    console.log('Frontend code: const token = await para.getVerificationToken()');
    
  } catch (error) {
    console.log('❌ Para server creation failed:', error.message);
  }
  
  // Test 2: Test wallet verification with real wallet address
  console.log('\n2️⃣ Testing wallet verification with real address:');
  try {
    const paraService = getParaService();
    const walletAddress = frontendData.wallets[frontendData.currentWalletIds.EVM[0]].address;
    
    console.log('Testing wallet:', walletAddress);
    const walletResult = await paraService.verifyWalletOwnership(walletAddress);
    
    if (walletResult.success) {
      console.log('✅ Wallet verification successful!');
      console.log('Wallet ID:', walletResult.walletId);
      console.log('🎉 This confirms the wallet exists in Para system');
    } else {
      console.log('ℹ️  Wallet verification result:', walletResult.error);
      if (walletResult.error === 'Wallet not found') {
        console.log('This could mean:');
        console.log('- Wallet exists but not linked to our Para app partner ID');
        console.log('- Need to use correct API keys or environment');
      }
    }
    
  } catch (error) {
    console.log('❌ Wallet verification failed:', error.message);
  }
  
  // Test 3: Test backend authentication endpoint with test
  console.log('\n3️⃣ Testing backend authentication with real user data:');
  try {
    const response = await axios.post('http://localhost:5009/api/auth/para-test', {
      email: frontendData.authInfo.auth.email,
      useRealAPI: false // Use test mode first
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });
    
    if (response.data.success) {
      console.log('✅ Backend authentication working');
      console.log('User created with ID:', response.data.user.id);
      console.log('Para User ID:', response.data.user.paraUserId);
      console.log('JWT Token generated successfully');
    } else {
      console.log('⚠️  Authentication result:', response.data);
    }
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Backend server not running on port 5009');
      console.log('Please start server: npm start');
    } else {
      console.log('❌ Backend test failed:', error.message);
    }
  }
  
  // Test 4: Instructions for real frontend integration
  console.log('\n4️⃣ Real Frontend Integration Steps:');
  console.log('');
  console.log('Frontend needs to call:');
  console.log('```javascript');
  console.log('// After user is authenticated with Para');
  console.log('const para = new Para("' + process.env.PARA_API_KEY + '");');
  console.log('await para.auth.loginWithEmail("' + frontendData.authInfo.auth.email + '");');
  console.log('');
  console.log('// Get verification token');
  console.log('const verificationToken = await para.getVerificationToken();');
  console.log('');
  console.log('// Send to backend');
  console.log('const response = await fetch("/api/auth/para-auth", {');
  console.log('  method: "POST",');
  console.log('  headers: { "Content-Type": "application/json" },');
  console.log('  body: JSON.stringify({ verificationToken })');
  console.log('});');
  console.log('```');
  console.log('');
  console.log('🎯 NEXT STEPS:');
  console.log('1. Frontend: Get real verification token from authenticated Para session');
  console.log('2. Test with: POST /api/auth/para-auth { "verificationToken": "real-token" }');
  console.log('3. Verify backend actually calls Para API for verification');
}

testWithRealParaData().catch(console.error);
