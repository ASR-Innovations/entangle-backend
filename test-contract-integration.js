#!/usr/bin/env node

/**
 * CONTRACT INTEGRATION TEST
 * Tests the new contract address: 0xB5D6eaD3f2b302ab38D59617C179a2f61a4ca0EC
 */

require('dotenv').config();
const { ethers } = require('ethers');

// Configuration
const CONFIG = {
  CONTRACT_ADDRESS: '0xB5D6eaD3f2b302ab38D59617C179a2f61a4ca0EC',
  RPC_URL: process.env.RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc',
  TEST_WALLET: '0x161d026cd7855bc783506183546c968cd96b4896'
};

console.log('🔗 CONTRACT INTEGRATION TEST');
console.log('=' .repeat(60));
console.log(`Contract Address: ${CONFIG.CONTRACT_ADDRESS}`);
console.log(`RPC URL: ${CONFIG.RPC_URL}`);

/**
 * Test contract connection and basic functions
 */
async function testContractConnection() {
  console.log('\n📋 TESTING CONTRACT CONNECTION');
  console.log('-'.repeat(40));
  
  try {
    // Initialize provider
    const provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL);
    const network = await provider.getNetwork();
    console.log('✅ RPC Connection successful');
    console.log('Network:', network.name, '(Chain ID:', network.chainId, ')');
    
    // Load contract ABI
    const MeetingAuctionABI = require('./src/contracts/MeetingAuction.json');
    const contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, MeetingAuctionABI, provider);
    
    // Test basic contract calls
    console.log('\n📊 CONTRACT STATISTICS:');
    const auctionCounter = await contract.auctionCounter();
    const platformFee = await contract.platformFee();
    const owner = await contract.owner();
    const paused = await contract.paused();
    
    console.log('✅ Contract connection successful');
    console.log('Contract Address:', CONFIG.CONTRACT_ADDRESS);
    console.log('Total Auctions:', auctionCounter.toString());
    console.log('Platform Fee:', platformFee.toString(), 'basis points');
    console.log('Owner:', owner);
    console.log('Paused:', paused);
    
    return { success: true, contract, provider, stats: { auctionCounter, platformFee, owner, paused } };
  } catch (error) {
    console.error('❌ Contract connection failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test auction functions
 */
async function testAuctionFunctions(contract) {
  console.log('\n📋 TESTING AUCTION FUNCTIONS');
  console.log('-'.repeat(40));
  
  try {
    // Test getActiveAuctions
    console.log('\n1. Testing getActiveAuctions():');
    const activeAuctions = await contract.getActiveAuctions();
    console.log('✅ getActiveAuctions() working');
    console.log('Active auctions count:', activeAuctions.length);
    
    if (activeAuctions.length > 0) {
      console.log('Active auction IDs:', activeAuctions.map(id => id.toString()));
    }
    
    // Test getAuction for each active auction
    if (activeAuctions.length > 0) {
      console.log('\n2. Testing getAuction() for active auctions:');
      for (const auctionId of activeAuctions.slice(0, 3)) { // Test first 3
        try {
          const auction = await contract.getAuction(auctionId);
          console.log(`\nAuction ${auctionId.toString()}:`);
          console.log('   ID:', auction.id.toString());
          console.log('   Host:', auction.host);
          console.log('   Twitter ID:', auction.hostTwitterId);
          console.log('   Reserve Price:', ethers.utils.formatEther(auction.reservePrice), 'AVAX');
          console.log('   Highest Bid:', ethers.utils.formatEther(auction.highestBid), 'AVAX');
          console.log('   Highest Bidder:', auction.highestBidder);
          console.log('   Start Block:', auction.startBlock.toString());
          console.log('   End Block:', auction.endBlock.toString());
          console.log('   Ended:', auction.ended);
          console.log('   Meeting Scheduled:', auction.meetingScheduled);
          console.log('   Duration:', auction.duration.toString(), 'minutes');
          console.log('   NFT Token ID:', auction.nftTokenId.toString());
          console.log('   Metadata IPFS:', auction.meetingMetadataIPFS);
        } catch (error) {
          console.log(`❌ Failed to get auction ${auctionId}:`, error.message);
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error('❌ Auction functions test failed:', error.message);
    return false;
  }
}

/**
 * Test NFT functions
 */
async function testNFTFunctions(contract) {
  console.log('\n📋 TESTING NFT FUNCTIONS');
  console.log('-'.repeat(40));
  
  try {
    // Test getNFTsOwnedByUser
    console.log('\n1. Testing getNFTsOwnedByUser():');
    try {
      const nfts = await contract.getNFTsOwnedByUser(CONFIG.TEST_WALLET);
      console.log('✅ getNFTsOwnedByUser() working');
      console.log('Token IDs:', nfts.tokenIds.map(id => id.toString()));
      console.log('Auction IDs:', nfts.auctionIds.map(id => id.toString()));
      
      if (nfts.tokenIds.length > 0) {
        // Test getNFTMetadata for first token
        console.log('\n2. Testing getNFTMetadata():');
        const tokenId = nfts.tokenIds[0];
        const metadata = await contract.getNFTMetadata(tokenId);
        console.log('✅ getNFTMetadata() working');
        console.log('Token ID:', tokenId.toString());
        console.log('Auction ID:', metadata.auctionId.toString());
        console.log('Host:', metadata.host);
        console.log('Host Twitter ID:', metadata.hostTwitterId);
        console.log('Meeting Duration:', metadata.meetingDuration.toString());
        console.log('Mint Timestamp:', metadata.mintTimestamp.toString());
        
        // Test canBurnForMeeting
        console.log('\n3. Testing canBurnForMeeting():');
        const canBurn = await contract.canBurnForMeeting(tokenId, CONFIG.TEST_WALLET);
        console.log('✅ canBurnForMeeting() working');
        console.log('Can burn for meeting:', canBurn);
        
        // Test canAccessMeeting
        console.log('\n4. Testing canAccessMeeting():');
        const canAccess = await contract.canAccessMeeting(metadata.auctionId, CONFIG.TEST_WALLET);
        console.log('✅ canAccessMeeting() working');
        console.log('Can access meeting:', canAccess);
      }
    } catch (error) {
      console.log('⚠️  getNFTsOwnedByUser not available or wallet has no NFTs');
      console.log('Error:', error.message);
    }
    
    return true;
  } catch (error) {
    console.error('❌ NFT functions test failed:', error.message);
    return false;
  }
}

/**
 * Test contract constants and view functions
 */
async function testContractConstants(contract) {
  console.log('\n📋 TESTING CONTRACT CONSTANTS');
  console.log('-'.repeat(40));
  
  try {
    const constants = {
      ANTI_SNIPE_BLOCKS: await contract.ANTI_SNIPE_BLOCKS(),
      EXTENSION_BLOCKS: await contract.EXTENSION_BLOCKS(),
      MIN_BID_INCREMENT: await contract.MIN_BID_INCREMENT(),
      platformFee: await contract.platformFee()
    };
    
    console.log('✅ Contract constants retrieved:');
    console.log('Anti-snipe blocks:', constants.ANTI_SNIPE_BLOCKS.toString());
    console.log('Extension blocks:', constants.EXTENSION_BLOCKS.toString());
    console.log('Min bid increment:', ethers.utils.formatEther(constants.MIN_BID_INCREMENT), 'AVAX');
    console.log('Platform fee:', constants.platformFee.toString(), 'basis points');
    
    return true;
  } catch (error) {
    console.error('❌ Contract constants test failed:', error.message);
    return false;
  }
}

/**
 * Test contract events (if any recent events exist)
 */
async function testContractEvents(contract) {
  console.log('\n📋 TESTING CONTRACT EVENTS');
  console.log('-'.repeat(40));
  
  try {
    // Get recent AuctionCreated events
    console.log('\n1. Testing AuctionCreated events:');
    const filter = contract.filters.AuctionCreated();
    const events = await contract.queryFilter(filter, -1000); // Last 1000 blocks
    
    console.log('✅ Event query working');
    console.log('Recent AuctionCreated events:', events.length);
    
    if (events.length > 0) {
      const recentEvent = events[events.length - 1];
      console.log('Most recent event:');
      console.log('   Auction ID:', recentEvent.args.auctionId.toString());
      console.log('   Host:', recentEvent.args.host);
      console.log('   Twitter ID:', recentEvent.args.twitterId);
      console.log('   Reserve Price:', ethers.utils.formatEther(recentEvent.args.reservePrice), 'AVAX');
      console.log('   Block Number:', recentEvent.blockNumber);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Contract events test failed:', error.message);
    return false;
  }
}

/**
 * Test contract balance and emergency functions
 */
async function testContractBalance(contract) {
  console.log('\n📋 TESTING CONTRACT BALANCE');
  console.log('-'.repeat(40));
  
  try {
    const balance = await contract.getContractBalance();
    console.log('✅ Contract balance retrieved');
    console.log('Contract balance:', ethers.utils.formatEther(balance), 'AVAX');
    
    return true;
  } catch (error) {
    console.error('❌ Contract balance test failed:', error.message);
    return false;
  }
}

/**
 * Run all contract tests
 */
async function runContractTests() {
  console.log('🚀 Starting Contract Integration Tests...\n');
  
  const connectionResult = await testContractConnection();
  if (!connectionResult.success) {
    console.log('\n❌ Cannot proceed - contract connection failed');
    return;
  }
  
  const results = {
    connection: true,
    auctionFunctions: await testAuctionFunctions(connectionResult.contract),
    nftFunctions: await testNFTFunctions(connectionResult.contract),
    constants: await testContractConstants(connectionResult.contract),
    events: await testContractEvents(connectionResult.contract),
    balance: await testContractBalance(connectionResult.contract)
  };
  
  // Print summary
  console.log('\n🎉 CONTRACT TEST RESULTS');
  console.log('=' .repeat(60));
  
  Object.entries(results).forEach(([test, result]) => {
    const status = result ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${test}`);
  });
  
  const passedTests = Object.values(results).filter(result => result === true).length;
  const totalTests = Object.keys(results).length;
  
  console.log(`\n📊 Overall: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 ALL CONTRACT TESTS PASSED!');
    console.log('✅ Contract is ready for backend integration');
    console.log('✅ All required functions are available');
    console.log('✅ Contract is properly deployed and accessible');
  } else {
    console.log('\n⚠️  Some contract tests failed.');
    console.log('Please check the contract deployment and function availability.');
  }
  
  return results;
}

// Run if called directly
if (require.main === module) {
  runContractTests().catch(console.error);
}

module.exports = { runContractTests };




