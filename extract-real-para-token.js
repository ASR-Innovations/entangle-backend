#!/usr/bin/env node

/**
 * EXTRACT REAL PARA TOKEN FROM YOUR SESSION DATA
 * Attempt to work with your actual Para session
 */

require('dotenv').config();
const { Para } = require('@getpara/server-sdk');
const axios = require('axios');

async function extractRealParaToken() {
  console.log('🔍 ANALYZING YOUR REAL PARA SESSION DATA\n');
  
  // Your actual Para session data
  const realSessionData = {
    userId: "248ec087-1738-4f4a-ac03-9db5f7dc786c",
    email: "rohit.rajsurya10@gmail.com",
    walletAddress: "0x161d026cd7855bc783506183546c968cd96b4896",
    walletId: "126d1c9d-4ef7-48de-88ea-9b7111d93bb6",
    sessionCookie: "capsule.sid=s%3A47c8d70a-3b01-4923-97b5-e3304df847f2.uxIWzqORBq8SRsKcyOGGvfBKCnVBR6m6PRG8brTjn44",
    authInfo: {
      auth: { email: "rohit.rajsurya10@gmail.com" },
      authType: "email",
      identifier: "rohit.rajsurya10@gmail.com"
    },
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
  
  console.log('📋 Your Para Session Analysis:');
  console.log('User ID:', realSessionData.userId);
  console.log('Email:', realSessionData.email);
  console.log('Wallet Address:', realSessionData.walletAddress);
  console.log('Session Cookie:', realSessionData.sessionCookie);
  console.log('');
  
  // Test 1: Try Para Server SDK session reconstruction
  console.log('1️⃣ Attempting Para Server SDK session reconstruction:');
  try {
    const para = new Para(process.env.PARA_API_KEY);
    
    // Try to create a session object that might work with importSession
    const attemptedSession = {
      userId: realSessionData.userId,
      wallets: Object.values(realSessionData.wallets),
      authInfo: realSessionData.authInfo,
      sessionData: realSessionData.sessionCookie
    };
    
    const sessionString = JSON.stringify(attemptedSession);
    const base64Session = Buffer.from(sessionString).toString('base64');
    
    console.log('Attempting to import reconstructed session...');
    await para.importSession(base64Session);
    
    console.log('✅ Session import successful!');
    
    // Try to get verification token
    const token = await para.getVerificationToken();
    console.log('✅ Verification token obtained:', token);
    
    // Test this token with backend
    console.log('Testing with backend...');
    const response = await axios.post('http://localhost:5009/api/auth/para-auth', {
      verificationToken: token
    }, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log('✅ Backend authentication successful!');
    console.log('Response:', response.data);
    
  } catch (error) {
    console.log('❌ Session reconstruction failed:', error.message);
    console.log('This approach won\'t work - Para uses encrypted session format');
  }
  
  // Test 2: Check what Para APIs are available
  console.log('\n2️⃣ Para API Investigation:');
  
  // Try to find a Para API that can help us get a verification token
  try {
    console.log('Checking Para user management APIs...');
    
    // Try to get user info using your user ID
    const userInfoResponse = await axios.get(`https://api.beta.getpara.com/users/${realSessionData.userId}`, {
      headers: {
        'x-external-api-key': process.env.PARA_SECRET_API_KEY
      }
    }).catch(err => ({ status: err.response?.status, data: err.response?.data }));
    
    console.log('User API Response:', userInfoResponse.status, userInfoResponse.data);
    
  } catch (error) {
    console.log('User API check failed:', error.message);
  }
  
  // Test 3: The CORRECT approach
  console.log('\n3️⃣ THE CORRECT APPROACH:');
  console.log('');
  console.log('Based on Para documentation, the ONLY way to get verification tokens is:');
  console.log('');
  console.log('FRONTEND CODE (run this in your browser console):');
  console.log('```javascript');
  console.log('// Make sure you have Para SDK loaded');
  console.log('// In browser where you\'re logged in:');
  console.log('');
  console.log('// Option 1: Get verification token');
  console.log('if (typeof para !== "undefined") {');
  console.log('  try {');
  console.log('    const verificationToken = await para.getVerificationToken();');
  console.log('    console.log("VERIFICATION TOKEN:", verificationToken);');
  console.log('    ');
  console.log('    // Test it immediately');
  console.log('    fetch("http://localhost:5009/api/auth/para-auth", {');
  console.log('      method: "POST",');
  console.log('      headers: { "Content-Type": "application/json" },');
  console.log('      body: JSON.stringify({ verificationToken })');
  console.log('    }).then(r => r.json()).then(console.log);');
  console.log('  } catch (e) {');
  console.log('    console.error("Failed to get verification token:", e);');
  console.log('  }');
  console.log('} else {');
  console.log('  console.error("Para SDK not found. Make sure Para is loaded.");');
  console.log('}');
  console.log('```');
  console.log('');
  console.log('ALTERNATIVE - Export session:');
  console.log('```javascript');
  console.log('if (typeof para !== "undefined") {');
  console.log('  try {');
  console.log('    const serializedSession = await para.exportSession();');
  console.log('    console.log("SERIALIZED SESSION:", serializedSession);');
  console.log('  } catch (e) {');
  console.log('    console.error("Failed to export session:", e);');
  console.log('  }');
  console.log('}');
  console.log('```');
  console.log('');
  
  console.log('🎯 NEXT STEPS:');
  console.log('1. Open browser where you\'re logged into Para');
  console.log('2. Open developer console (F12)');
  console.log('3. Copy and paste the JavaScript code above');
  console.log('4. Copy the verification token output');
  console.log('5. Test with: curl -X POST http://localhost:5009/api/auth/para-auth -H "Content-Type: application/json" -d \'{"verificationToken": "PASTE_TOKEN_HERE"}\'');
}

extractRealParaToken().catch(console.error);
