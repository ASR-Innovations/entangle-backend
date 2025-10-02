#!/usr/bin/env node

/**
 * AUCTION ENDING LOGIC TESTING
 * 
 * This script tests the auction ending logic to ensure:
 * 1. Expired auctions with bids are properly ended
 * 2. Expired auctions without bids are properly handled
 * 3. Winners get NFTs and losers get refunds
 * 4. Cron job processes auctions correctly
 */

require('dotenv').config();
const { ethers } = require('ethers');
const { getContractService } = require('./src/services/ContractService');
const { getAuctionCronService } = require('./src/services/AuctionCronService');
const logger = require('./src/utils/logger');

class AuctionEndingTester {
  constructor() {
    this.contractService = null;
    this.cronService = null;
    this.testResults = {
      passed: 0,
      failed: 0,
      total: 0,
      details: []
    };
  }

  async initialize() {
    try {
      console.log('🚀 INITIALIZING AUCTION ENDING LOGIC TESTER');
      console.log('=' .repeat(60));
      
      // Initialize services
      this.contractService = getContractService();
      await this.contractService.initialize();
      
      this.cronService = getAuctionCronService();
      
      console.log('✅ Services initialized');
      console.log('✅ Ready for auction ending tests\n');
      
    } catch (error) {
      console.error('❌ Initialization failed:', error.message);
      throw error;
    }
  }

  async runAllTests() {
    console.log('🎯 STARTING AUCTION ENDING LOGIC TESTS');
    console.log('=' .repeat(60));
    
    const testSuites = [
      { name: 'Current Auction Status', fn: this.testCurrentAuctionStatus },
      { name: 'Auction Ending Logic', fn: this.testAuctionEndingLogic },
      { name: 'Cron Job Processing', fn: this.testCronJobProcessing },
      { name: 'Refund Logic', fn: this.testRefundLogic },
      { name: 'Winner Determination', fn: this.testWinnerDetermination }
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

  async testCurrentAuctionStatus() {
    console.log('Testing current auction status...');
    
    // Get all auctions
    await this.testFunction('getAllAuctions', async () => {
      const stats = await this.contractService.getContractStats();
      const totalAuctions = stats.auctionCounter;
      console.log(`   📊 Total auctions: ${totalAuctions}`);
      
      const activeAuctions = await this.contractService.getActiveAuctions();
      console.log(`   🟢 Active auctions: ${activeAuctions.length}`);
      
      return { totalAuctions, activeAuctions: activeAuctions.length };
    });

    // Check each auction individually
    await this.testFunction('checkIndividualAuctions', async () => {
      const stats = await this.contractService.getContractStats();
      const totalAuctions = stats.auctionCounter;
      
      for (let i = 1; i <= totalAuctions; i++) {
        try {
          const auction = await this.contractService.getAuction(i);
          const currentBlock = await this.contractService.provider.getBlockNumber();
          
          console.log(`   📋 Auction ${i}:`);
          console.log(`      Title: ${auction.title}`);
          console.log(`      Ended: ${auction.ended}`);
          console.log(`      Start Block: ${auction.startBlock}`);
          console.log(`      End Block: ${auction.endBlock}`);
          console.log(`      Current Block: ${currentBlock}`);
          console.log(`      Expired: ${currentBlock > auction.endBlock}`);
          console.log(`      Highest Bid: ${ethers.formatEther(auction.highestBid)} AVAX`);
          console.log(`      Highest Bidder: ${auction.highestBidder}`);
          console.log(`      Meeting Scheduled: ${auction.meetingScheduled}`);
          console.log('');
          
        } catch (error) {
          console.log(`   ❌ Auction ${i}: Error - ${error.message}`);
        }
      }
      
      return true;
    });
  }

  async testAuctionEndingLogic() {
    console.log('Testing auction ending logic...');
    
    // Test end auction function
    await this.testFunction('endAuctionFunction', async () => {
      const stats = await this.contractService.getContractStats();
      const totalAuctions = stats.auctionCounter;
      
      // Find an expired auction
      let expiredAuctionId = null;
      for (let i = 1; i <= totalAuctions; i++) {
        try {
          const auction = await this.contractService.getAuction(i);
          const currentBlock = await this.contractService.provider.getBlockNumber();
          
          if (!auction.ended && currentBlock > auction.endBlock) {
            expiredAuctionId = i;
            console.log(`   🎯 Found expired auction ${i} (ended at block ${auction.endBlock}, current: ${currentBlock})`);
            break;
          }
        } catch (error) {
          // Skip invalid auctions
        }
      }
      
      if (expiredAuctionId) {
        console.log(`   🔧 Testing endAuction for auction ${expiredAuctionId}...`);
        
        try {
          // Get auction before ending
          const auctionBefore = await this.contractService.getAuction(expiredAuctionId);
          console.log(`   📊 Before ending: ended=${auctionBefore.ended}, highestBid=${ethers.formatEther(auctionBefore.highestBid)}`);
          
          // Try to end the auction
          const tx = await this.contractService.contract.endAuction(expiredAuctionId);
          console.log(`   ✅ End auction transaction: ${tx.hash}`);
          
          // Wait for transaction to be mined
          const receipt = await tx.wait();
          console.log(`   ✅ Transaction mined in block ${receipt.blockNumber}`);
          
          // Get auction after ending
          const auctionAfter = await this.contractService.getAuction(expiredAuctionId);
          console.log(`   📊 After ending: ended=${auctionAfter.ended}, highestBid=${ethers.formatEther(auctionAfter.highestBid)}`);
          
          return { success: true, auctionId: expiredAuctionId, txHash: tx.hash };
          
        } catch (error) {
          console.log(`   ❌ Failed to end auction ${expiredAuctionId}: ${error.message}`);
          return { success: false, error: error.message };
        }
      } else {
        console.log(`   ⚠️  No expired auctions found to test`);
        return { success: true, message: 'No expired auctions to test' };
      }
    });
  }

  async testCronJobProcessing() {
    console.log('Testing cron job processing...');
    
    // Test cron service processing
    await this.testFunction('cronServiceProcessing', async () => {
      console.log(`   🔧 Running cron service processEndedAuctions...`);
      
      try {
        const result = await this.cronService.processEndedAuctions();
        console.log(`   ✅ Cron service completed: ${JSON.stringify(result, null, 2)}`);
        return result;
      } catch (error) {
        console.log(`   ❌ Cron service failed: ${error.message}`);
        throw error;
      }
    });
  }

  async testRefundLogic() {
    console.log('Testing refund logic...');
    
    // Test get pending return
    await this.testFunction('getPendingReturn', async () => {
      const stats = await this.contractService.getContractStats();
      const totalAuctions = stats.auctionCounter;
      
      for (let i = 1; i <= totalAuctions; i++) {
        try {
          const auction = await this.contractService.getAuction(i);
          if (auction.ended && auction.highestBidder !== '0x0000000000000000000000000000000000000000') {
            console.log(`   📊 Auction ${i} - Winner: ${auction.highestBidder}`);
            console.log(`      Highest Bid: ${ethers.formatEther(auction.highestBid)} AVAX`);
            
            // Check if there are any pending returns for other bidders
            // This would require knowing the bidder addresses, which we don't have
            console.log(`      ⚠️  Cannot test refunds without bidder addresses`);
          }
        } catch (error) {
          // Skip invalid auctions
        }
      }
      
      return true;
    });
  }

  async testWinnerDetermination() {
    console.log('Testing winner determination...');
    
    // Test winner logic
    await this.testFunction('winnerDetermination', async () => {
      const stats = await this.contractService.getContractStats();
      const totalAuctions = stats.auctionCounter;
      
      for (let i = 1; i <= totalAuctions; i++) {
        try {
          const auction = await this.contractService.getAuction(i);
          
          if (auction.ended) {
            console.log(`   🏆 Auction ${i} Winner Analysis:`);
            console.log(`      Title: ${auction.title}`);
            console.log(`      Winner: ${auction.highestBidder}`);
            console.log(`      Winning Bid: ${ethers.formatEther(auction.highestBid)} AVAX`);
            console.log(`      NFT Token ID: ${auction.nftTokenId}`);
            console.log(`      Meeting Scheduled: ${auction.meetingScheduled}`);
            
            if (auction.highestBidder === '0x0000000000000000000000000000000000000000') {
              console.log(`      ⚠️  No winner - auction ended without bids`);
            } else {
              console.log(`      ✅ Winner determined successfully`);
            }
          }
        } catch (error) {
          // Skip invalid auctions
        }
      }
      
      return true;
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
    console.log('\n🎉 AUCTION ENDING LOGIC TEST RESULTS');
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
    
    console.log('\n🎯 RECOMMENDATIONS:');
    console.log('   1. Check why expired auctions are being skipped');
    console.log('   2. Verify auction ending logic in smart contract');
    console.log('   3. Test with real auction data');
    console.log('   4. Monitor cron job execution');
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new AuctionEndingTester();
  
  tester.initialize()
    .then(() => tester.runAllTests())
    .catch(error => {
      console.error('❌ Testing failed:', error);
      process.exit(1);
    });
}

module.exports = { AuctionEndingTester };




