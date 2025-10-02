#!/usr/bin/env node

/**
 * REAL PARA VERIFICATION TEST
 * Tests actual Para API verification with correct keys
 */

require('dotenv').config();
const axios = require('axios');
const { Para: ParaServer } = require('@getpara/server-sdk');

async function testRealParaVerification() {
  console.log('🔍 TESTING REAL PARA VERIFICATION\n');
  
  // Your dashboard configuration
  const dashboardApiKey = 'beta_01d517c4bbccb9aa45cca196d6ba9f80';
  const currentApiKey = process.env.PARA_API_KEY;
  const secretKey = process.env.PARA_SECRET_API_KEY;
  
  console.log('📋 Configuration Check:');
  console.log('Dashboard API Key:', dashboardApiKey);
  console.log('Current .env API Key:', currentApiKey);
  console.log('Keys Match:', dashboardApiKey === currentApiKey ? '✅ YES' : '❌ NO - UPDATE NEEDED');
  console.log('Secret Key Set:', secretKey ? '✅ YES' : '❌ NO');
  console.log('');
  
  // Test 1: Para Server SDK initialization
  console.log('1️⃣ Testing Para Server SDK initialization:');
  try {
    console.log('Testing with current API key...');
    const paraServer = new ParaServer(currentApiKey);
    console.log('✅ Para server created with current key');
    
    console.log('Testing with dashboard API key...');
    const paraServerDashboard = new ParaServer(dashboardApiKey);
    console.log('✅ Para server created with dashboard key');
    
    console.log('Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(paraServer)));
    
  } catch (error) {
    console.log('❌ Para server creation failed:', error.message);
  }
  
  // Test 2: Para API endpoint testing
  console.log('\n2️⃣ Testing Para API endpoints:');
  
  const paraBaseUrl = 'https://api.beta.getpara.com';
  
  // Test session verification endpoint
  console.log('Testing /sessions/verify endpoint...');
  try {
    const response = await axios.post(`${paraBaseUrl}/sessions/verify`, {
      verificationToken: 'test-token-123'
    }, {
      headers: {
        'content-type': 'application/json',
        'x-external-api-key': secretKey
      },
      timeout: 10000,
      validateStatus: () => true
    });
    
    console.log('Response Status:', response.status);
    console.log('Response Data:', response.data);
    
    if (response.status === 400 && response.data === 'verification token is not valid') {
      console.log('✅ Endpoint working (expected response for test token)');
    } else if (response.status === 401) {
      console.log('❌ Authentication failed - check secret key');
    } else {
      console.log('? Unexpected response');
    }
    
  } catch (error) {
    console.log('❌ API request failed:', error.message);
  }
  
  // Test 3: What we need for real authentication
  console.log('\n3️⃣ Real Para Authentication Requirements:');
  console.log('');
  console.log('Frontend needs to provide:');
  console.log('1. User authenticates with Para SDK');
  console.log('2. Get verification token: para.getVerificationToken()');
  console.log('3. OR serialize session: para.session.serialize()');
  console.log('');
  console.log('Backend options:');
  console.log('A. Verification token approach: /api/auth/para-auth');
  console.log('B. Session import approach: /api/auth/para-session');
  console.log('');
  
  // Test 4: Session import approach
  console.log('4️⃣ Testing session import approach:');
  console.log('This requires a serialized session from frontend Para SDK');
  console.log('Format: para.session.serialize() → returns encrypted session data');
  console.log('');
  
  console.log('🎯 NEXT STEPS:');
  console.log('1. Update .env with correct API key from dashboard');
  console.log('2. Get real verification token OR serialized session from frontend');
  console.log('3. Test with real Para data');
  console.log('4. Remove development endpoints');
  
  console.log('\n📝 Frontend Integration Code:');
  console.log('// Para SDK Frontend Code:');
  console.log('const para = new Para("beta_01d517c4bbccb9aa45cca196d6ba9f80");');
  console.log('await para.auth.loginWithEmail("rohit.rajsurya10@gmail.com");');
  console.log('');
  console.log('// Option A: Verification token');
  console.log('const token = await para.getVerificationToken();');
  console.log('fetch("/api/auth/para-auth", { body: JSON.stringify({ verificationToken: token }) });');
  console.log('');
  console.log('// Option B: Session import');
  console.log('const session = para.session.serialize();');
  console.log('fetch("/api/auth/para-session", { body: JSON.stringify({ serializedSession: session }) });');
}

testRealParaVerification().catch(console.error);
