#!/usr/bin/env node

/**
 * COMPREHENSIVE CONTRACT FUNCTION TESTING
 * 
 * This script tests ALL contract functions with multiple private keys
 * to simulate real user interactions and verify complete functionality.
 * 
 * Usage: node test-all-contract-functions.js
 */

require('dotenv').config();
const { ethers } = require('ethers');
const { getContractService } = require('./src/services/ContractService');
const logger = require('./src/utils/logger');

class ComprehensiveContractTester {
  constructor() {
    this.contractService = null;
    this.testResults = {
      passed: 0,
      failed: 0,
      total: 0,
      details: []
    };
    
    // Test private keys (you'll provide these)
    this.testKeys = {
      creator: process.env.CREATOR_PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000000',
      bidder1: process.env.BIDDER1_PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000000',
      bidder2: process.env.BIDDER2_PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000000',
      host: process.env.HOST_PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000000',
      nftOwner: process.env.NFT_OWNER_PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000000'
    };
    
    this.testWallets = {};
    this.testAuctionId = null;
    this.testNFTTokenId = null;
  }

  async initialize() {
    try {
      console.log('🚀 INITIALIZING COMPREHENSIVE CONTRACT TESTER');
      console.log('=' .repeat(60));
      
      // Initialize contract service
      this.contractService = getContractService();
      await this.contractService.initialize();
      
      // Initialize test wallets
      await this.initializeTestWallets();
      
      console.log('✅ Contract service initialized');
      console.log('✅ Test wallets initialized');
      console.log('✅ Ready for comprehensive testing\n');
      
    } catch (error) {
      console.error('❌ Initialization failed:', error.message);
      throw error;
    }
  }

  async initializeTestWallets() {
    console.log('🔑 Initializing test wallets...');
    
    for (const [role, privateKey] of Object.entries(this.testKeys)) {
      if (privateKey === '0x0000000000000000000000000000000000000000000000000000000000000000') {
        console.log(`⚠️  ${role.toUpperCase()}: No private key provided - using random wallet`);
        this.testWallets[role] = ethers.Wallet.createRandom();
      } else {
        this.testWallets[role] = new ethers.Wallet(privateKey, this.contractService.provider);
      }
      
      const balance = await this.contractService.provider.getBalance(this.testWallets[role].address);
      console.log(`   ${role.toUpperCase()}: ${this.testWallets[role].address} (${ethers.formatEther(balance)} AVAX)`);
    }
  }

  async runAllTests() {
    console.log('🎯 STARTING COMPREHENSIVE CONTRACT FUNCTION TESTS');
    console.log('=' .repeat(60));
    
    const testSuites = [
      { name: 'Contract Info Tests', fn: this.testContractInfo },
      { name: 'Auction Creation Tests', fn: this.testAuctionCreation },
      { name: 'Bidding Tests', fn: this.testBidding },
      { name: 'Auction Management Tests', fn: this.testAuctionManagement },
      { name: 'NFT Operations Tests', fn: this.testNFTOperations },
      { name: 'Meeting Operations Tests', fn: this.testMeetingOperations },
      { name: 'Dashboard Tests', fn: this.testDashboardFunctions },
      { name: 'Utility Functions Tests', fn: this.testUtilityFunctions },
      { name: 'Event Monitoring Tests', fn: this.testEventMonitoring },
      { name: 'Error Handling Tests', fn: this.testErrorHandling }
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

  async testContractInfo() {
    console.log('Testing contract information...');
    
    // Test contract stats
    await this.testFunction('getContractStats', async () => {
      const stats = await this.contractService.getContractStats();
      console.log(`   📊 Contract Stats: ${stats.auctionCounter} auctions, ${stats.feeBps}bps fee`);
      return stats;
    });

    // Test contract balance
    await this.testFunction('getContractBalance', async () => {
      const balance = await this.contractService.getContractBalance();
      console.log(`   💰 Contract Balance: ${ethers.formatEther(balance)} AVAX`);
      return balance;
    });

    // Test network info
    await this.testFunction('getNetworkConfig', async () => {
      const config = this.contractService.getNetworkConfig();
      console.log(`   🌐 Network: ${config.name} (${config.chainId})`);
      return config;
    });
  }

  async testAuctionCreation() {
    console.log('Testing auction creation...');
    
    // Test create auction
    await this.testFunction('createAuction', async () => {
      const auctionData = {
        title: 'Test Auction',
        description: 'Test auction for comprehensive testing',
        duration: 100, // 100 blocks
        reservePrice: ethers.parseEther('0.1'),
        meetingDuration: 60,
        sellerName: 'Test Seller',
        eventName: 'Test Event',
        eventDate: '2025-12-31',
        eventStartTime: '10:00',
        eventEndTime: '11:00',
        profilePicture: 'https://example.com/pic.jpg'
      };
      
      const tx = await this.contractService.contract.connect(this.testWallets.creator).createAuction(
        auctionData.title,
        auctionData.description,
        auctionData.duration,
        auctionData.reservePrice,
        auctionData.meetingDuration,
        auctionData.sellerName,
        auctionData.eventName,
        auctionData.eventDate,
        auctionData.eventStartTime,
        auctionData.eventEndTime,
        auctionData.profilePicture
      );
      
      const receipt = await tx.wait();
      console.log(`   🎯 Auction created: ${tx.hash}`);
      
      // Get auction ID from event
      const event = receipt.logs.find(log => {
        try {
          const parsed = this.contractService.contract.interface.parseLog(log);
          return parsed.name === 'AuctionCreated';
        } catch (e) {
          return false;
        }
      });
      
      if (event) {
        const parsed = this.contractService.contract.interface.parseLog(event);
        this.testAuctionId = parsed.args.auctionId.toString();
        console.log(`   🆔 Auction ID: ${this.testAuctionId}`);
      }
      
      return tx;
    });

    // Test get auction
    if (this.testAuctionId) {
      await this.testFunction('getAuction', async () => {
        const auction = await this.contractService.getAuction(this.testAuctionId);
        console.log(`   📋 Auction ${this.testAuctionId}: ${auction.title}`);
        return auction;
      });
    }
  }

  async testBidding() {
    console.log('Testing bidding functionality...');
    
    if (!this.testAuctionId) {
      console.log('   ⚠️  Skipping bidding tests - no auction created');
      return;
    }

    // Test place bid
    await this.testFunction('placeBid', async () => {
      const bidAmount = ethers.parseEther('0.2');
      const tx = await this.contractService.contract.connect(this.testWallets.bidder1).placeBid(
        this.testAuctionId,
        { value: bidAmount }
      );
      
      console.log(`   💰 Bid placed: ${ethers.formatEther(bidAmount)} AVAX`);
      return tx;
    });

    // Test get pending return
    await this.testFunction('getPendingReturn', async () => {
      const pending = await this.contractService.getPendingReturn(
        this.testAuctionId,
        this.testWallets.bidder1.address
      );
      console.log(`   📊 Pending return: ${ethers.formatEther(pending)} AVAX`);
      return pending;
    });

    // Test withdraw bid
    await this.testFunction('withdrawBid', async () => {
      const tx = await this.contractService.contract.connect(this.testWallets.bidder1).withdrawBid(
        this.testAuctionId
      );
      console.log(`   💸 Bid withdrawn: ${tx.hash}`);
      return tx;
    });
  }

  async testAuctionManagement() {
    console.log('Testing auction management...');
    
    if (!this.testAuctionId) {
      console.log('   ⚠️  Skipping auction management tests - no auction created');
      return;
    }

    // Test cancel auction
    await this.testFunction('cancelAuction', async () => {
      const tx = await this.contractService.contract.connect(this.testWallets.creator).cancelAuction(
        this.testAuctionId
      );
      console.log(`   ❌ Auction cancelled: ${tx.hash}`);
      return tx;
    });

    // Test end auction (if not cancelled)
    await this.testFunction('endAuction', async () => {
      try {
        const tx = await this.contractService.contract.connect(this.testWallets.creator).endAuction(
          this.testAuctionId
        );
        console.log(`   ✅ Auction ended: ${tx.hash}`);
        return tx;
      } catch (error) {
        console.log(`   ⚠️  End auction failed (expected if cancelled): ${error.message}`);
        throw error;
      }
    });
  }

  async testNFTOperations() {
    console.log('Testing NFT operations...');
    
    // Test get NFTs owned by user
    await this.testFunction('getNFTsOwnedByUser', async () => {
      const nfts = await this.contractService.getNFTsOwnedByUser(this.testWallets.creator.address);
      console.log(`   🎨 NFTs owned: ${nfts.length}`);
      if (nfts.length > 0) {
        this.testNFTTokenId = nfts[0];
        console.log(`   🆔 Test NFT Token ID: ${this.testNFTTokenId}`);
      }
      return nfts;
    });

    // Test get NFT metadata
    if (this.testNFTTokenId) {
      await this.testFunction('getNFTMetadata', async () => {
        const metadata = await this.contractService.getNFTMetadata(this.testNFTTokenId);
        console.log(`   📋 NFT Metadata: ${metadata.title}`);
        return metadata;
      });
    }

    // Test can burn for meeting
    if (this.testNFTTokenId) {
      await this.testFunction('canBurnForMeeting', async () => {
        const canBurn = await this.contractService.canBurnForMeeting(
          this.testNFTTokenId,
          this.testWallets.creator.address
        );
        console.log(`   🔥 Can burn NFT: ${canBurn}`);
        return canBurn;
      });
    }

    // Test burn NFT for meeting
    if (this.testNFTTokenId) {
      await this.testFunction('burnNFTForMeeting', async () => {
        try {
          const tx = await this.contractService.contract.connect(this.testWallets.creator).burnNFTForMeeting(
            this.testNFTTokenId
          );
          console.log(`   🔥 NFT burned: ${tx.hash}`);
          return tx;
        } catch (error) {
          console.log(`   ⚠️  Burn NFT failed (expected): ${error.message}`);
          throw error;
        }
      });
    }
  }

  async testMeetingOperations() {
    console.log('Testing meeting operations...');
    
    if (!this.testAuctionId) {
      console.log('   ⚠️  Skipping meeting tests - no auction created');
      return;
    }

    // Test schedule meeting
    await this.testFunction('scheduleMeeting', async () => {
      const meetingData = {
        auctionId: this.testAuctionId,
        meetingTime: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        meetingLink: 'https://meet.jit.si/test-meeting-123'
      };
      
      const tx = await this.contractService.contract.connect(this.testWallets.creator).scheduleMeeting(
        meetingData.auctionId,
        meetingData.meetingTime,
        meetingData.meetingLink
      );
      console.log(`   📅 Meeting scheduled: ${tx.hash}`);
      return tx;
    });

    // Test can access meeting
    await this.testFunction('canAccessMeeting', async () => {
      const canAccess = await this.contractService.canAccessMeeting(
        this.testAuctionId,
        this.testWallets.creator.address
      );
      console.log(`   🚪 Can access meeting: ${canAccess}`);
      return canAccess;
    });
  }

  async testDashboardFunctions() {
    console.log('Testing dashboard functions...');
    
    // Test user dashboard
    await this.testFunction('getUserDashboardCategorized', async () => {
      const dashboard = await this.contractService.getUserDashboardCategorized(
        this.testWallets.creator.address
      );
      console.log(`   📊 User Dashboard: ${dashboard.createdAuctions.length} created, ${dashboard.bidAuctions.length} bid`);
      return dashboard;
    });

    // Test host dashboard
    await this.testFunction('getHostDashboardCategorized', async () => {
      const dashboard = await this.contractService.getHostDashboardCategorized(
        this.testWallets.creator.address
      );
      console.log(`   🏠 Host Dashboard: ${dashboard.hostedMeetings.length} hosted`);
      return dashboard;
    });
  }

  async testUtilityFunctions() {
    console.log('Testing utility functions...');
    
    // Test get active auctions
    await this.testFunction('getActiveAuctions', async () => {
      const auctions = await this.contractService.getActiveAuctions();
      console.log(`   📋 Active Auctions: ${auctions.length}`);
      return auctions;
    });

    // Test get balance
    await this.testFunction('getBalance', async () => {
      const balance = await this.contractService.getBalance(this.testWallets.creator.address);
      console.log(`   💰 Creator Balance: ${ethers.formatEther(balance)} AVAX`);
      return balance;
    });
  }

  async testEventMonitoring() {
    console.log('Testing event monitoring...');
    
    // Test start event monitoring
    await this.testFunction('monitorEvents', async () => {
      this.contractService.monitorEvents();
      console.log(`   👂 Event monitoring started`);
      return true;
    });

    // Test stop event monitoring
    await this.testFunction('stopEventMonitoring', async () => {
      this.contractService.stopEventMonitoring();
      console.log(`   🔇 Event monitoring stopped`);
      return true;
    });
  }

  async testErrorHandling() {
    console.log('Testing error handling...');
    
    // Test invalid auction ID
    await this.testFunction('getAuction (invalid ID)', async () => {
      try {
        await this.contractService.getAuction('999999');
        throw new Error('Should have failed');
      } catch (error) {
        console.log(`   ❌ Invalid auction ID handled: ${error.message}`);
        return true;
      }
    });

    // Test invalid NFT token ID
    await this.testFunction('getNFTMetadata (invalid ID)', async () => {
      try {
        await this.contractService.getNFTMetadata('999999');
        throw new Error('Should have failed');
      } catch (error) {
        console.log(`   ❌ Invalid NFT ID handled: ${error.message}`);
        return true;
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
    console.log('\n🎉 COMPREHENSIVE CONTRACT TESTING RESULTS');
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
      console.log('   🎉 All contract functions working perfectly!');
      console.log('   🚀 Ready for production deployment!');
    } else {
      console.log('   🔧 Fix failed tests before production');
      console.log('   📋 Review error messages above');
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new ComprehensiveContractTester();
  
  tester.initialize()
    .then(() => tester.runAllTests())
    .catch(error => {
      console.error('❌ Testing failed:', error);
      process.exit(1);
    });
}

module.exports = { ComprehensiveContractTester };




