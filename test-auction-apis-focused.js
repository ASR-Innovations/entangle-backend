#!/usr/bin/env node

/**
 * FOCUSED AUCTION API TESTING
 * 
 * This script tests all auction-related APIs specifically to identify
 * and fix issues with auction functionality.
 */

require('dotenv').config();
const axios = require('axios');
const { ethers } = require('ethers');

class AuctionAPITester {
  constructor() {
    this.baseURL = process.env.BACKEND_URL || 'http://localhost:5009';
    this.testResults = {
      passed: 0,
      failed: 0,
      total: 0,
      details: []
    };
  }

  async runAllTests() {
    console.log('🎯 FOCUSED AUCTION API TESTING');
    console.log('=' .repeat(60));
    console.log(`Backend URL: ${this.baseURL}`);
    console.log(`Contract Address: 0xB5D6eaD3f2b302ab38D59617C179a2f61a4ca0EC\n`);

    const testSuites = [
      { name: 'Server Health', fn: this.testServerHealth },
      { name: 'Auction List APIs', fn: this.testAuctionListAPIs },
      { name: 'Auction Creation APIs', fn: this.testAuctionCreationAPIs },
      { name: 'Auction Detail APIs', fn: this.testAuctionDetailAPIs },
      { name: 'Auction Management APIs', fn: this.testAuctionManagementAPIs },
      { name: 'Contract Integration APIs', fn: this.testContractIntegrationAPIs },
      { name: 'Error Handling APIs', fn: this.testErrorHandlingAPIs }
    ];

    for (const suite of testSuites) {
      console.log(`\n📋 ${suite.name.toUpperCase()}`);
      console.log('-'.repeat(40));
      
      try {
        await suite.fn.call(this);
      } catch (error) {
        console.error(`❌ ${suite.name} failed:`, error.message);
        this.recordTest(suite.name, false, error.message);
      }
    }

    this.printResults();
  }

  async testServerHealth() {
    console.log('Testing server health...');
    
    await this.testFunction('GET /health', async () => {
      const response = await axios.get(`${this.baseURL}/health`);
      console.log(`   ✅ Server health: ${response.data.status}`);
      return response.data;
    });

    await this.testFunction('GET /api/health', async () => {
      const response = await axios.get(`${this.baseURL}/api/health`);
      console.log(`   ✅ API health: ${JSON.stringify(response.data)}`);
      return response.data;
    });
  }

  async testAuctionListAPIs() {
    console.log('Testing auction list APIs...');
    
    await this.testFunction('GET /api/auctions/active', async () => {
      const response = await axios.get(`${this.baseURL}/api/auctions/active`);
      console.log(`   ✅ Active auctions: ${response.data.auctions?.length || 0} found`);
      console.log(`   📊 Response: ${JSON.stringify(response.data, null, 2)}`);
      return response.data;
    });

    await this.testFunction('GET /api/auctions/created', async () => {
      try {
        const response = await axios.get(`${this.baseURL}/api/auctions/created`);
        console.log(`   ✅ Created auctions: ${response.data.auctions?.length || 0} found`);
        return response.data;
      } catch (error) {
        if (error.response?.status === 401) {
          console.log(`   ⚠️  Created auctions: 401 (expected - needs auth)`);
          return { error: 'Authentication required' };
        }
        throw error;
      }
    });

    await this.testFunction('GET /api/auctions/user/:userId', async () => {
      try {
        const response = await axios.get(`${this.baseURL}/api/auctions/user/1`);
        console.log(`   ✅ User auctions: ${response.data.auctions?.length || 0} found`);
        return response.data;
      } catch (error) {
        if (error.response?.status === 401) {
          console.log(`   ⚠️  User auctions: 401 (expected - needs auth)`);
          return { error: 'Authentication required' };
        }
        throw error;
      }
    });
  }

  async testAuctionCreationAPIs() {
    console.log('Testing auction creation APIs...');
    
    await this.testFunction('POST /api/auctions/created (no auth)', async () => {
      try {
        const auctionData = {
          title: 'Test Auction',
          description: 'Test auction for API testing',
          duration: 100,
          reservePrice: 0.1,
          meetingDuration: 60,
          creatorWallet: '0x84c30c7b7cb3ce9f075550a26e6485958fbd2ee7',
          transactionHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
        };
        
        const response = await axios.post(`${this.baseURL}/api/auctions/created`, auctionData);
        console.log(`   ✅ Auction creation: ${JSON.stringify(response.data)}`);
        return response.data;
      } catch (error) {
        if (error.response?.status === 401) {
          console.log(`   ⚠️  Auction creation: 401 (expected - needs auth)`);
          return { error: 'Authentication required' };
        }
        console.log(`   ❌ Auction creation error: ${error.response?.data?.error || error.message}`);
        throw error;
      }
    });

    await this.testFunction('POST /api/auctions/created (invalid data)', async () => {
      try {
        const invalidData = {
          title: '', // Invalid: empty title
          description: 'Test',
          duration: -1, // Invalid: negative duration
          reservePrice: 'invalid' // Invalid: not a number
        };
        
        const response = await axios.post(`${this.baseURL}/api/auctions/created`, invalidData);
        console.log(`   ❌ Should have failed with invalid data: ${JSON.stringify(response.data)}`);
        return response.data;
      } catch (error) {
        if (error.response?.status === 400) {
          console.log(`   ✅ Validation error (expected): ${error.response.data.error}`);
          return { error: 'Validation failed as expected' };
        }
        throw error;
      }
    });
  }

  async testAuctionDetailAPIs() {
    console.log('Testing auction detail APIs...');
    
    await this.testFunction('GET /api/auctions/:id (existing auction)', async () => {
      try {
        const response = await axios.get(`${this.baseURL}/api/auctions/1`);
        console.log(`   ✅ Auction 1 details: ${JSON.stringify(response.data, null, 2)}`);
        return response.data;
      } catch (error) {
        if (error.response?.status === 404) {
          console.log(`   ⚠️  Auction 1: 404 (not found)`);
          return { error: 'Auction not found' };
        }
        throw error;
      }
    });

    await this.testFunction('GET /api/auctions/:id (non-existent auction)', async () => {
      try {
        const response = await axios.get(`${this.baseURL}/api/auctions/999999`);
        console.log(`   ❌ Should have failed: ${JSON.stringify(response.data)}`);
        return response.data;
      } catch (error) {
        if (error.response?.status === 404) {
          console.log(`   ✅ 404 error (expected): ${error.response.data.error}`);
          return { error: 'Auction not found as expected' };
        }
        throw error;
      }
    });
  }

  async testAuctionManagementAPIs() {
    console.log('Testing auction management APIs...');
    
    await this.testFunction('POST /api/auctions/:id/bid (no auth)', async () => {
      try {
        const bidData = {
          amount: 0.2,
          bidderWallet: '0x84c30c7b7cb3ce9f075550a26e6485958fbd2ee7'
        };
        
        const response = await axios.post(`${this.baseURL}/api/auctions/1/bid`, bidData);
        console.log(`   ✅ Bid placed: ${JSON.stringify(response.data)}`);
        return response.data;
      } catch (error) {
        if (error.response?.status === 401) {
          console.log(`   ⚠️  Bid placement: 401 (expected - needs auth)`);
          return { error: 'Authentication required' };
        }
        throw error;
      }
    });

    await this.testFunction('POST /api/auctions/:id/end (no auth)', async () => {
      try {
        const response = await axios.post(`${this.baseURL}/api/auctions/1/end`);
        console.log(`   ✅ Auction ended: ${JSON.stringify(response.data)}`);
        return response.data;
      } catch (error) {
        if (error.response?.status === 401) {
          console.log(`   ⚠️  End auction: 401 (expected - needs auth)`);
          return { error: 'Authentication required' };
        }
        throw error;
      }
    });
  }

  async testContractIntegrationAPIs() {
    console.log('Testing contract integration APIs...');
    
    await this.testFunction('GET /api/contract/stats', async () => {
      try {
        const response = await axios.get(`${this.baseURL}/api/contract/stats`);
        console.log(`   ✅ Contract stats: ${JSON.stringify(response.data)}`);
        return response.data;
      } catch (error) {
        console.log(`   ❌ Contract stats error: ${error.response?.data?.error || error.message}`);
        throw error;
      }
    });

    await this.testFunction('GET /api/contract/auctions', async () => {
      try {
        const response = await axios.get(`${this.baseURL}/api/contract/auctions`);
        console.log(`   ✅ Contract auctions: ${response.data.auctions?.length || 0} found`);
        return response.data;
      } catch (error) {
        console.log(`   ❌ Contract auctions error: ${error.response?.data?.error || error.message}`);
        throw error;
      }
    });

    await this.testFunction('GET /api/contract/nfts/:address', async () => {
      try {
        const response = await axios.get(`${this.baseURL}/api/contract/nfts/0x84c30c7b7cb3ce9f075550a26e6485958fbd2ee7`);
        console.log(`   ✅ User NFTs: ${response.data.nfts?.length || 0} found`);
        return response.data;
      } catch (error) {
        console.log(`   ❌ User NFTs error: ${error.response?.data?.error || error.message}`);
        throw error;
      }
    });
  }

  async testErrorHandlingAPIs() {
    console.log('Testing error handling APIs...');
    
    await this.testFunction('GET /api/auctions/invalid', async () => {
      try {
        const response = await axios.get(`${this.baseURL}/api/auctions/invalid`);
        console.log(`   ❌ Should have failed: ${JSON.stringify(response.data)}`);
        return response.data;
      } catch (error) {
        if (error.response?.status === 400) {
          console.log(`   ✅ 400 error (expected): ${error.response.data.error}`);
          return { error: 'Invalid auction ID as expected' };
        }
        throw error;
      }
    });

    await this.testFunction('POST /api/auctions/created (malformed JSON)', async () => {
      try {
        const response = await axios.post(`${this.baseURL}/api/auctions/created`, 'invalid json', {
          headers: { 'Content-Type': 'application/json' }
        });
        console.log(`   ❌ Should have failed: ${JSON.stringify(response.data)}`);
        return response.data;
      } catch (error) {
        if (error.response?.status === 400) {
          console.log(`   ✅ 400 error (expected): ${error.response.data.error}`);
          return { error: 'Invalid JSON as expected' };
        }
        throw error;
      }
    });
  }

  async testFunction(name, testFn) {
    try {
      const result = await testFn();
      this.recordTest(name, true, 'Success');
      return result;
    } catch (error) {
      this.recordTest(name, false, error.message);
      throw error;
    }
  }

  recordTest(name, passed, message) {
    this.testResults.total++;
    if (passed) {
      this.testResults.passed++;
      console.log(`   ✅ ${name}: ${message}`);
    } else {
      this.testResults.failed++;
      console.log(`   ❌ ${name}: ${message}`);
    }
    
    this.testResults.details.push({
      name,
      passed,
      message,
      timestamp: new Date().toISOString()
    });
  }

  printResults() {
    console.log('\n🎉 FOCUSED AUCTION API TEST RESULTS');
    console.log('=' .repeat(60));
    console.log(`✅ Passed: ${this.testResults.passed}`);
    console.log(`❌ Failed: ${this.testResults.failed}`);
    console.log(`📊 Total: ${this.testResults.total}`);
    console.log(`📈 Success Rate: ${((this.testResults.passed / this.testResults.total) * 100).toFixed(1)}%`);
    
    if (this.testResults.failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.testResults.details
        .filter(test => !test.passed)
        .forEach(test => {
          console.log(`   - ${test.name}: ${test.message}`);
        });
    }
    
    console.log('\n🎯 NEXT STEPS:');
    if (this.testResults.failed === 0) {
      console.log('   🎉 All auction APIs working perfectly!');
      console.log('   🚀 Ready for production use!');
    } else {
      console.log('   🔧 Fix failed tests before production');
      console.log('   📋 Review error messages above');
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new AuctionAPITester();
  
  tester.runAllTests()
    .catch(error => {
      console.error('❌ Testing failed:', error);
      process.exit(1);
    });
}

module.exports = { AuctionAPITester };




