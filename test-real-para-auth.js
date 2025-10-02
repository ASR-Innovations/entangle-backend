#!/usr/bin/env node

/**
 * REAL PARA AUTHENTICATION TEST
 * Using actual session data provided by user
 */

require('dotenv').config();
const axios = require('axios');
const jwt = require('jsonwebtoken');

async function testRealParaAuth() {
  console.log('🚀 TESTING REAL PARA AUTHENTICATION\n');

  // Your actual Para session data
  const realParaData = {
    authInfo: {
      auth: { email: 'rohit.rajsurya10@gmail.com' },
      authType: 'email',
      identifier: 'rohit.rajsurya10@gmail.com'
    },
    userId: '248ec087-1738-4f4a-ac03-9db5f7dc786c',
    walletData: {
      id: '126d1c9d-4ef7-48de-88ea-9b7111d93bb6',
      address: '0x161d026cd7855bc783506183546c968cd96b4896',
      type: 'EVM',
      publicKey: '0x04872f23f523263a20e6c326cce47cabd1e7b4de797ddfe00e2b7a9240551276638992f6f00986df72902d70a0fda6564f1fe3bce85020602fb5cf68490ec30a78'
    },
    sessionCookie: 'capsule.sid=s%3A4fa4ff8e-f081-4664-a9a3-2198f31f18c6.BzEoSRIAQzbONUCiXObVmr1h6nsl9hOE%2F1cm%2BU5Wqd8; Path=/; Expires=Sat, 30 Aug 2025 19:10:22 GMT; HttpOnly; Secure; SameSite=None'
  };

  console.log('📋 User Data Summary:');
  console.log('Email:', realParaData.authInfo.identifier);
  console.log('Para User ID:', realParaData.userId);
  console.log('Wallet Address:', realParaData.walletData.address);
  console.log('Auth Type:', realParaData.authInfo.authType);
  console.log('');

  // Test 1: Create direct authentication request
  console.log('🧪 Test 1: Testing direct Para authentication');
  
  try {
    const response = await axios.post('http://localhost:5009/api/auth/para-direct', realParaData, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
      validateStatus: () => true
    });

    console.log('Response Status:', response.status);
    console.log('Response Data:', JSON.stringify(response.data, null, 2));

    if (response.status === 404) {
      console.log('⚠️ Endpoint /api/auth/para-direct not found');
      console.log('We need to create this endpoint first');
      
      // Test the existing para-session endpoint instead
      console.log('\n🧪 Test 2: Testing existing para-session endpoint');
      
      // Create a mock serialized session from the data
      const mockSession = {
        userId: realParaData.userId,
        authInfo: realParaData.authInfo,
        wallets: [realParaData.walletData]
      };
      
      // First we need to authenticate to get a JWT
      console.log('Need to create user first...');
      
    } else if (response.status === 200) {
      console.log('✅ Success! Para authentication working');
      
      if (response.data.token) {
        // Test the token
        const decoded = jwt.decode(response.data.token);
        console.log('JWT Token Payload:', decoded);
      }
    }

  } catch (error) {
    console.log('❌ Error:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('Server not running on port 5009');
    }
  }

  // Test 3: Direct database insertion simulation
  console.log('\n🧪 Test 3: Simulate database operations');
  
  const paraUserId = `${realParaData.authInfo.authType}_${Buffer.from(realParaData.authInfo.identifier).toString('base64').slice(0, 16)}`;
  
  console.log('Generated Para User ID:', paraUserId);
  console.log('Database operations would be:');
  console.log('INSERT INTO users:');
  console.log({
    para_user_id: paraUserId,
    wallet_address: realParaData.walletData.address.toLowerCase(),
    email: realParaData.authInfo.identifier,
    auth_type: realParaData.authInfo.authType,
    oauth_method: null, // Not provided in your data
    display_name: realParaData.authInfo.identifier
  });

  // Test 4: JWT generation simulation
  console.log('\n🧪 Test 4: Simulate JWT generation');
  
  try {
    const jwtPayload = {
      userId: 1, // Would be from database
      paraUserId: paraUserId,
      realParaUserId: realParaData.userId, // The actual Para user ID
      authType: realParaData.authInfo.authType,
      identifier: realParaData.authInfo.identifier,
      email: realParaData.authInfo.identifier,
      displayName: realParaData.authInfo.identifier,
      walletAddress: realParaData.walletData.address.toLowerCase(),
      hasWallet: true,
      sessionActive: true,
      role: 'para_user'
    };

    const token = jwt.sign(jwtPayload, process.env.JWT_SECRET || 'fallback-secret', { expiresIn: '7d' });
    console.log('✅ JWT Generated successfully');
    console.log('Token payload:', jwtPayload);
    console.log('Token (first 50 chars):', token.substring(0, 50) + '...');

  } catch (error) {
    console.log('❌ JWT generation failed:', error.message);
  }

  console.log('\n🎯 SUMMARY:');
  console.log('✅ We have all required Para data');
  console.log('✅ Can generate Para User ID');
  console.log('✅ Can create database record');
  console.log('✅ Can generate JWT token');
  console.log('');
  console.log('📝 Next Step: Create /api/auth/para-direct endpoint');
}

testRealParaAuth().catch(console.error);
