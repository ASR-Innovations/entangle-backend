#!/usr/bin/env node

/**
 * COMPREHENSIVE PARA AUTHENTICATION TEST
 * Tests both verification token and session import approaches
 * Works with real Para API and provides fallback test scenarios
 */

require('dotenv').config();
const axios = require('axios');
const { getParaService } = require('./src/services/ParaService');

class ParaAuthTester {
  constructor() {
    this.paraService = getParaService();
    this.testEmail = 'test@example.com';
    this.apiKey = process.env.PARA_API_KEY;
    this.secretKey = process.env.PARA_SECRET_API_KEY;
    this.environment = process.env.PARA_ENVIRONMENT || 'beta';
  }

  async runAllTests() {
    console.log('🔍 COMPREHENSIVE PARA AUTHENTICATION TESTS\n');
    
    // Configuration check
    await this.checkConfiguration();
    
    // Test 1: Verification Token Approach
    console.log('\n1️⃣ Testing Verification Token Approach:');
    await this.testVerificationTokenFlow();
    
    // Test 2: Session Import Approach  
    console.log('\n2️⃣ Testing Session Import Approach:');
    await this.testSessionImportFlow();
    
    // Test 3: API Endpoints
    console.log('\n3️⃣ Testing Para API Endpoints:');
    await this.testParaAPIEndpoints();
    
    // Test 4: Wallet Verification
    console.log('\n4️⃣ Testing Wallet Verification:');
    await this.testWalletVerification();
    
    console.log('\n✅ All Para authentication tests completed');
    console.log('\n📋 NEXT STEPS FOR FRONTEND INTEGRATION:');
    console.log('1. Frontend: const para = new Para("' + this.apiKey + '")');
    console.log('2. Frontend: await para.auth.loginWithEmail("user@example.com")');
    console.log('3. Frontend: const token = await para.getVerificationToken()');
    console.log('4. Frontend: Send token to backend /api/auth/para-auth');
    console.log('5. Backend: Uses ParaService.verifySession(token) for authentication');
  }

  async checkConfiguration() {
    console.log('📋 Configuration Check:');
    console.log('API Key:', this.apiKey ? '✅ SET' : '❌ MISSING');
    console.log('Secret Key:', this.secretKey ? '✅ SET' : '❌ MISSING');
    console.log('Environment:', this.environment);
    
    if (!this.apiKey || !this.secretKey) {
      console.log('⚠️  Missing Para API keys - some tests may fail');
    }
  }

  async testVerificationTokenFlow() {
    try {
      // Test with mock verification token (simulating frontend)
      console.log('Testing with mock verification token...');
      
      const mockTokenResult = await this.paraService.createTestVerificationToken(this.testEmail);
      
      if (mockTokenResult.success) {
        console.log('✅ Mock verification token created:', mockTokenResult.verificationToken);
        
        // Now test the verification (this will fail with real API, but shows the flow)
        console.log('Testing verification flow...');
        const verifyResult = await this.paraService.verifySession(mockTokenResult.verificationToken);
        
        if (verifyResult.success) {
          console.log('✅ Verification successful:', verifyResult.userData);
        } else {
          console.log('⚠️  Verification failed (expected with mock token):', verifyResult.error);
          console.log('ℹ️  This is normal - frontend needs to provide real verification token');
        }
      } else {
        console.log('❌ Failed to create mock token:', mockTokenResult.error);
      }
      
    } catch (error) {
      console.log('❌ Verification token test failed:', error.message);
    }
  }

  async testSessionImportFlow() {
    try {
      console.log('Testing session import approach...');
      
      // Create mock session (simulating frontend)
      const mockSessionResult = await this.paraService.createTestSession(this.testEmail);
      
      if (mockSessionResult.success) {
        console.log('✅ Mock session created');
        console.log('Note:', mockSessionResult.note);
        
        // Test session import (this will fail with real Para SDK, but shows the flow)
        console.log('Testing session import flow...');
        const importResult = await this.paraService.importSession(
          mockSessionResult.serializedSession, 
          'test-user-123'
        );
        
        if (importResult.success) {
          console.log('✅ Session import successful');
          console.log('JWT Token:', importResult.jwtToken ? 'Generated' : 'None');
          console.log('User Data:', importResult.userData ? 'Present' : 'None');
        } else {
          console.log('⚠️  Session import failed (expected with mock session):', importResult.error);
          console.log('ℹ️  This is normal - frontend needs to provide real serialized session');
        }
      } else {
        console.log('❌ Failed to create mock session:', mockSessionResult.error);
      }
      
    } catch (error) {
      console.log('❌ Session import test failed:', error.message);
    }
  }

  async testParaAPIEndpoints() {
    try {
      console.log('Testing Para API endpoints directly...');
      
      const baseUrl = this.paraService.baseUrl;
      console.log('Base URL:', baseUrl);
      
      // Test sessions/verify endpoint
      console.log('Testing /sessions/verify endpoint...');
      const response = await axios.post(`${baseUrl}/sessions/verify`, {
        verificationToken: 'test-token-123'
      }, {
        headers: {
          'content-type': 'application/json',
          'x-external-api-key': this.secretKey
        },
        timeout: 10000,
        validateStatus: () => true
      });
      
      console.log('Response Status:', response.status);
      console.log('Response Data:', response.data);
      
      if (response.status === 400) {
        console.log('✅ API endpoint working (expected 400 for invalid token)');
      } else if (response.status === 401) {
        console.log('❌ Authentication failed - check secret key');
      } else {
        console.log('ℹ️  Unexpected response - check implementation');
      }
      
    } catch (error) {
      console.log('❌ API endpoint test failed:', error.message);
    }
  }

  async testWalletVerification() {
    try {
      console.log('Testing wallet verification...');
      
      const testWalletAddress = '0x742D35Cc6475C2cD6c4F9B5F4b4D2C9E7A83C3A';
      
      const walletResult = await this.paraService.verifyWalletOwnership(testWalletAddress);
      
      if (walletResult.success) {
        console.log('✅ Wallet verification successful:', walletResult.walletId);
      } else {
        console.log('ℹ️  Wallet not found (expected for test address):', walletResult.error);
      }
      
    } catch (error) {
      console.log('❌ Wallet verification test failed:', error.message);
    }
  }
}

// Run tests
const tester = new ParaAuthTester();
tester.runAllTests().catch(console.error);
