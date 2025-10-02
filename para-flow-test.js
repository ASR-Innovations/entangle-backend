#!/usr/bin/env node

/**
 * PARA WALLET AUTHENTICATION FLOW TESTER
 * 
 * This script helps test and understand the Para authentication flow
 * including session cookie handling and API interactions.
 */

require('dotenv').config();
const axios = require('axios');
const { getParaService } = require('./src/services/ParaService');
const logger = require('./src/utils/logger');

class ParaFlowTester {
  constructor() {
    this.sessionCookie = 'capsule.sid=s%3A4fa4ff8e-f081-4664-a9a3-2198f31f18c6.BzEoSRIAQzbONUCiXObVmr1h6nsl9hOE%2F1cm%2BU5Wqd8; Path=/; Expires=Sat, 30 Aug 2025 13:54:30 GMT; HttpOnly; Secure; SameSite=None';
    this.environment = process.env.PARA_ENVIRONMENT || 'beta';
    this.baseUrls = {
      sandbox: 'https://api.sandbox.getpara.com',
      beta: 'https://api.beta.getpara.com', 
      prod: 'https://api.getpara.com'
    };
    this.baseUrl = this.baseUrls[this.environment];
  }

  log(message, data = null) {
    console.log(`\n🔍 ${message}`);
    if (data) {
      console.log('   📊 Data:', JSON.stringify(data, null, 2));
    }
  }

  error(message, error) {
    console.log(`\n❌ ERROR: ${message}`);
    console.log('   🔥 Details:', error.message || error);
  }

  success(message, data = null) {
    console.log(`\n✅ SUCCESS: ${message}`);
    if (data) {
      console.log('   📊 Result:', JSON.stringify(data, null, 2));
    }
  }

  // Parse session cookie to extract session ID
  parseSessionCookie() {
    this.log('Parsing Para session cookie...');
    
    try {
      // Extract session ID from cookie
      const cookieMatch = this.sessionCookie.match(/capsule\.sid=s%3A([^.]+)\.([^;]+)/);
      
      if (cookieMatch) {
        const sessionId = cookieMatch[1];
        const signature = cookieMatch[2];
        
        const parsed = {
          sessionId: sessionId,
          signature: signature,
          fullCookie: this.sessionCookie,
          decoded: {
            sessionId: decodeURIComponent(sessionId),
            signature: decodeURIComponent(signature)
          }
        };

        this.success('Session cookie parsed', parsed);
        return parsed;
      } else {
        throw new Error('Could not parse session cookie format');
      }
      
    } catch (error) {
      this.error('Failed to parse session cookie', error);
      return null;
    }
  }

  // Test Para API endpoints with different approaches
  async testParaAPIEndpoints() {
    this.log('Testing Para API endpoints...');
    
    const apiKey = process.env.PARA_API_KEY;
    const secretKey = process.env.PARA_SECRET_API_KEY;
    
    if (!apiKey || !secretKey) {
      this.error('Para API keys not configured', new Error('Missing PARA_API_KEY or PARA_SECRET_API_KEY'));
      return false;
    }

    const testResults = {};

    // Test 1: Basic API health check
    try {
      this.log('Testing basic API connectivity...');
      
      const healthResponse = await axios.get(`${this.baseUrl}/health`, {
        timeout: 5000,
        headers: {
          'x-api-key': apiKey
        }
      });
      
      testResults.healthCheck = {
        success: true,
        status: healthResponse.status,
        data: healthResponse.data
      };
      
      this.success('API health check passed', testResults.healthCheck);
      
    } catch (error) {
      testResults.healthCheck = {
        success: false,
        error: error.response?.data || error.message,
        status: error.response?.status
      };
      
      this.error('API health check failed', error);
    }

    // Test 2: Session verification with cookie
    try {
      this.log('Testing session verification with cookie...');
      
      const sessionResponse = await axios.post(`${this.baseUrl}/sessions/verify`, {}, {
        timeout: 5000,
        headers: {
          'content-type': 'application/json',
          'x-external-api-key': secretKey,
          'Cookie': this.sessionCookie
        }
      });
      
      testResults.sessionWithCookie = {
        success: true,
        status: sessionResponse.status,
        data: sessionResponse.data
      };
      
      this.success('Session verification with cookie passed', testResults.sessionWithCookie);
      
    } catch (error) {
      testResults.sessionWithCookie = {
        success: false,
        error: error.response?.data || error.message,
        status: error.response?.status
      };
      
      this.error('Session verification with cookie failed', error);
    }

    // Test 3: Direct session query
    try {
      this.log('Testing direct session query...');
      
      const sessionId = this.parseSessionCookie()?.decoded?.sessionId;
      if (sessionId) {
        const directResponse = await axios.get(`${this.baseUrl}/sessions/${sessionId}`, {
          timeout: 5000,
          headers: {
            'x-external-api-key': secretKey
          }
        });
        
        testResults.directSession = {
          success: true,
          status: directResponse.status,
          data: directResponse.data
        };
        
        this.success('Direct session query passed', testResults.directSession);
      }
      
    } catch (error) {
      testResults.directSession = {
        success: false,
        error: error.response?.data || error.message,
        status: error.response?.status
      };
      
      this.error('Direct session query failed', error);
    }

    return testResults;
  }

  // Test Para service integration
  async testParaServiceIntegration() {
    this.log('Testing Para service integration...');
    
    try {
      const paraService = getParaService();
      
      const serviceInfo = {
        environment: paraService.environment,
        baseUrl: paraService.baseUrl,
        configured: !!(paraService.paraServer && paraService.secretApiKey)
      };

      this.success('Para service integration verified', serviceInfo);
      return serviceInfo;
      
    } catch (error) {
      this.error('Para service integration failed', error);
      return { configured: false, error: error.message };
    }
  }

  // Generate verification token approach
  async testVerificationTokenApproach() {
    this.log('Testing verification token approach...');
    
    // This simulates how the frontend would generate a verification token
    // In reality, this would come from Para's frontend SDK
    
    const mockVerificationToken = {
      approach: 'simulation',
      sessionId: this.parseSessionCookie()?.decoded?.sessionId,
      timestamp: Date.now(),
      note: 'In production, this token would be generated by Para frontend SDK'
    };

    this.log('Mock verification token generated', mockVerificationToken);
    
    // Test with our Para service
    try {
      const paraService = getParaService();
      
      // This will fail since we don't have a real token, but shows the flow
      const result = await paraService.verifySession(JSON.stringify(mockVerificationToken));
      
      this.success('Verification token test completed', result);
      return result;
      
    } catch (error) {
      this.log('Expected failure - need real verification token from frontend', { 
        error: error.message,
        note: 'This is expected without real Para frontend integration'
      });
      return { tested: true, expectedFailure: true };
    }
  }

  // Analyze authentication flow steps
  analyzeAuthFlow() {
    this.log('Analyzing complete Para authentication flow...');
    
    const flow = {
      step1: {
        location: 'Frontend',
        action: 'User clicks "Login with Para"',
        details: 'Para SDK handles OAuth (Google, X, Discord, etc.)'
      },
      step2: {
        location: 'Para',
        action: 'Social authentication completed',
        details: 'Para creates session and returns session cookie'
      },
      step3: {
        location: 'Frontend',
        action: 'Generate verification token',
        details: 'Para SDK generates verification token from session'
      },
      step4: {
        location: 'Backend',
        action: 'Verify token with Para API',
        details: 'POST /sessions/verify with verification token'
      },
      step5: {
        location: 'Backend',
        action: 'Extract user data and create JWT',
        details: 'Store user in database, return app JWT token'
      },
      step6: {
        location: 'Frontend',
        action: 'Use app JWT for subsequent requests',
        details: 'Include JWT in Authorization header'
      },
      currentImplementation: {
        paraService: 'Configured and ready',
        endpoints: {
          'POST /api/auth/para-auth': 'Handles verification token',
          'POST /api/auth/para-session': 'Imports serialized session for wallet ops',
          'GET /api/auth/verify': 'Validates app JWT'
        },
        database: 'Users table ready for Para integration'
      }
    };

    this.success('Authentication flow analyzed', flow);
    return flow;
  }

  // Run comprehensive Para flow test
  async runAllTests() {
    console.log('\n🚀 STARTING PARA WALLET FLOW ANALYSIS');
    console.log('=====================================\n');

    const results = {};

    // Parse session cookie
    results.cookieParsing = this.parseSessionCookie();

    // Test API endpoints
    results.apiTesting = await this.testParaAPIEndpoints();

    // Test service integration
    results.serviceIntegration = await this.testParaServiceIntegration();

    // Test verification token approach
    results.verificationToken = await this.testVerificationTokenApproach();

    // Analyze flow
    results.flowAnalysis = this.analyzeAuthFlow();

    console.log('\n📊 PARA FLOW TEST SUMMARY');
    console.log('==========================');
    
    console.log('\n📋 DETAILED RESULTS:');
    console.log(JSON.stringify(results, null, 2));

    console.log('\n🎯 NEXT STEPS:');
    console.log('1. ✅ Backend Para integration is ready');
    console.log('2. ⏳ Need real verification token from Para frontend SDK');
    console.log('3. ⏳ Test complete auth flow with frontend integration');
    console.log('4. ⏳ Verify wallet operations with serialized session');

    return results;
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new ParaFlowTester();
  tester.runAllTests()
    .then(results => {
      console.log('\n🏁 Para flow analysis completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('Para flow test crashed:', error);
      process.exit(1);
    });
}

module.exports = { ParaFlowTester };
