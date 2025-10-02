#!/usr/bin/env node

/**
 * TEST WITH REAL FRONTEND SESSION DATA
 * Uses your actual Para session to get real verification token
 */

require('dotenv').config();
const { Para } = require('@getpara/server-sdk');
const axios = require('axios');

async function testWithRealSession() {
  console.log('🔍 TESTING WITH YOUR REAL PARA SESSION DATA\n');
  
  // Your real Para data
  const realUserData = {
    userId: "248ec087-1738-4f4a-ac03-9db5f7dc786c",
    email: "rohit.rajsurya10@gmail.com",
    walletAddress: "0x161d026cd7855bc783506183546c968cd96b4896",
    sessionCookie: "capsule.sid=s%3A47c8d70a-3b01-4923-97b5-e3304df847f2.uxIWzqORBq8SRsKcyOGGvfBKCnVBR6m6PRG8brTjn44",
    walletId: "126d1c9d-4ef7-48de-88ea-9b7111d93bb6"
  };
  
  console.log('📋 Your Real Para Data:');
  console.log('User ID:', realUserData.userId);
  console.log('Email:', realUserData.email);
  console.log('Wallet:', realUserData.walletAddress);
  console.log('Wallet ID:', realUserData.walletId);
  console.log('');
  
  // Test 1: Try to recreate Para session from your data
  console.log('1️⃣ Attempting to create Para instance with your session:');
  try {
    const para = new Para(process.env.PARA_API_KEY);
    console.log('✅ Para instance created');
    
    // The problem: We can't directly inject your session cookie into Para SDK
    // Para SDK needs to authenticate through their flow, not raw session data
    console.log('⚠️  Cannot directly inject browser session into Para Server SDK');
    console.log('Para Server SDK requires either:');
    console.log('1. importSession(serializedSession) from frontend para.exportSession()');
    console.log('2. Verification token from frontend para.getVerificationToken()');
    
  } catch (error) {
    console.log('❌ Failed:', error.message);
  }
  
  // Test 2: What we actually need from frontend
  console.log('\n2️⃣ What Frontend Needs to Provide:');
  console.log('');
  console.log('From your browser console, run this JavaScript:');
  console.log('```javascript');
  console.log('// In browser where you are logged into Para:');
  console.log('');
  console.log('// Option 1: Get verification token');
  console.log('const verificationToken = await para.getVerificationToken();');
  console.log('console.log("Verification Token:", verificationToken);');
  console.log('');
  console.log('// Option 2: Export session');
  console.log('const serializedSession = await para.exportSession();');
  console.log('console.log("Serialized Session:", serializedSession);');
  console.log('```');
  console.log('');
  
  // Test 3: Verify wallet ownership (this works with your data)
  console.log('3️⃣ Testing wallet verification with your wallet:');
  try {
    const response = await axios.post('https://api.beta.getpara.com/wallets/verify', {
      address: realUserData.walletAddress
    }, {
      headers: {
        'content-type': 'application/json',
        'x-external-api-key': process.env.PARA_SECRET_API_KEY
      }
    });
    
    console.log('✅ Wallet verified successfully!');
    console.log('Response:', response.data);
    console.log('This confirms your wallet exists in Para system');
    
  } catch (error) {
    console.log('❌ Wallet verification failed:', error.response?.data || error.message);
  }
  
  // Test 4: Show the real integration path
  console.log('\n4️⃣ REAL INTEGRATION PATH:');
  console.log('');
  console.log('Since you have an active Para session in browser:');
  console.log('1. In browser console: const token = await para.getVerificationToken()');
  console.log('2. Copy that token');
  console.log('3. Test backend with real token:');
  console.log('');
  console.log('curl -X POST http://localhost:5009/api/auth/para-auth \\');
  console.log('  -H "Content-Type: application/json" \\');
  console.log('  -d \'{"verificationToken": "REAL_TOKEN_FROM_BROWSER"}\'');
  console.log('');
  console.log('This will make REAL API call to Para and return actual user data!');
}

testWithRealSession().catch(console.error);
