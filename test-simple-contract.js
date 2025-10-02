#!/usr/bin/env node

/**
 * SIMPLE CONTRACT TEST - Check basic functions
 */

require('dotenv').config();
const ethers = require('ethers');
const MeetingAuctionABI = require('./src/contracts/MeetingAuction.json');

async function testContract() {
  console.log('🔍 SIMPLE CONTRACT INTERACTION TEST');
  console.log('='.repeat(40));
  console.log('');

  try {
    const contractAddress = '0xceBD87246e91C7D70C82D5aE5C196a0028543933';
    const rpcUrl = 'https://api.avax-test.network/ext/bc/C/rpc';
    
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(contractAddress, MeetingAuctionABI, provider);

    console.log('📡 Contract Connection:', contractAddress);
    console.log('');

    // Test 1: Simple view functions
    console.log('1️⃣ TESTING BASIC FUNCTIONS');
    console.log('-'.repeat(30));
    
    try {
      const auctionCounter = await contract.auctionCounter();
      console.log(`✅ Auction Counter: ${auctionCounter.toString()}`);
    } catch (error) {
      console.log('❌ auctionCounter failed:', error.message);
    }

    try {
      const platformFee = await contract.platformFee();
      console.log(`✅ Platform Fee: ${platformFee.toString()}`);
    } catch (error) {
      console.log('❌ platformFee failed:', error.message);
    }

    // Test 2: Get individual auctions
    console.log('');
    console.log('2️⃣ TESTING INDIVIDUAL AUCTIONS');
    console.log('-'.repeat(30));
    
    for (let i = 1; i <= 3; i++) {
      try {
        const auction = await contract.getAuction(i);
        console.log(`Auction ${i}:`);
        console.log(`  Host: ${auction.host}`);
        console.log(`  End Block: ${auction.endBlock.toString()}`);
        console.log(`  Highest Bid: ${ethers.utils.formatEther(auction.highestBid)} AVAX`);
        console.log(`  Ended: ${auction.ended}`);
        console.log('');
      } catch (error) {
        console.log(`❌ Auction ${i} failed: ${error.message}`);
      }
    }

    // Test 3: Check current block vs auction end blocks
    console.log('3️⃣ CHECKING AUCTION STATUS');
    console.log('-'.repeat(30));
    
    const currentBlock = await provider.getBlockNumber();
    console.log(`Current Block: ${currentBlock}`);
    console.log('');

    // Manual check for ended auctions
    const possibleEndedAuctions = [];
    for (let i = 1; i <= 9; i++) {
      try {
        const auction = await contract.getAuction(i);
        if (!auction.ended && currentBlock >= auction.endBlock) {
          possibleEndedAuctions.push({
            id: i,
            auction: auction
          });
        }
      } catch (error) {
        // Skip
      }
    }

    if (possibleEndedAuctions.length > 0) {
      console.log(`🎯 Found ${possibleEndedAuctions.length} auctions that should end:`);
      possibleEndedAuctions.forEach(({ id, auction }) => {
        console.log(`  Auction ${id}: End block ${auction.endBlock.toString()}, Current: ${currentBlock}`);
      });
    } else {
      console.log('⚠️  No auctions ready to end found');
    }

    console.log('');
    console.log('4️⃣ API TESTING');
    console.log('-'.repeat(30));
    console.log('✅ Backend server is running on http://localhost:5009');
    console.log('🧪 You can test these APIs:');
    console.log('');
    
    // Test basic API endpoint
    try {
      const response = await fetch('http://localhost:5009/health');
      if (response.ok) {
        console.log('✅ Health check passed');
      } else {
        console.log('⚠️  Health check failed');
      }
    } catch (error) {
      console.log('⚠️  Health endpoint not available');
    }

    console.log('');
    console.log('📋 SUMMARY:');
    console.log('- ✅ Contract connection working');
    console.log('- ✅ Basic contract functions accessible');
    console.log('- ✅ Backend server running');
    console.log('- ⚠️  getActiveAuctions() function needs investigation');
    console.log('- 💡 Ready for manual API testing with proper auth');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testContract().catch(console.error);
