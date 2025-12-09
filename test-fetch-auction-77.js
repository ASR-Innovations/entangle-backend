const { ethers } = require('ethers');
const { getContractService } = require('./src/services/ContractService');

async function testFetchAuction77() {
  console.log('🔍 Fetching Auction #77 from Blockchain...\n');
  console.log('='.repeat(60));

  try {
    // Initialize contract service
    const contractService = getContractService();
    await contractService.initialize();

    console.log('✅ Contract initialized');
    console.log(`📝 Contract Address: ${contractService.contractAddress}`);
    console.log(`🔗 RPC URL: ${process.env.RPC_URL || process.env.AVALANCHE_RPC}`);
    console.log('');

    // Get current block
    const currentBlock = await contractService.provider.getBlockNumber();
    console.log(`📦 Current Block: ${currentBlock}`);
    console.log('');

    // Fetch auction #77
    console.log('📊 Fetching Auction #77...');
    const auction = await contractService.contract.getAuction(77);

    console.log('');
    console.log('='.repeat(60));
    console.log('AUCTION #77 DATA FROM BLOCKCHAIN');
    console.log('='.repeat(60));
    console.log('');

    // Display all fields
    console.log('📋 BASIC INFO:');
    console.log(`   ID: ${auction.id ? auction.id.toString() : 'N/A'}`);
    console.log(`   Host: ${auction.host || 'N/A'}`);
    console.log(`   Twitter ID: ${auction.hostTwitterId || 'N/A'}`);
    console.log('');

    console.log('💰 BIDDING INFO:');
    console.log(`   Reserve Price: ${auction.reservePrice ? ethers.formatEther(auction.reservePrice) : '0'} AVAX`);
    console.log(`   Reserve Price (wei): ${auction.reservePrice ? auction.reservePrice.toString() : '0'}`);
    console.log(`   Highest Bid: ${auction.highestBid ? ethers.formatEther(auction.highestBid) : '0'} AVAX`);
    console.log(`   Highest Bid (wei): ${auction.highestBid ? auction.highestBid.toString() : '0'}`);
    console.log(`   Highest Bidder: ${auction.highestBidder || 'N/A'}`);
    console.log('');

    console.log('⏰ TIMING INFO:');
    console.log(`   End Block: ${auction.endBlock ? auction.endBlock.toString() : 'N/A'}`);
    const blocksRemaining = auction.endBlock ? Number(auction.endBlock) - currentBlock : 0;
    const timeRemainingSeconds = blocksRemaining * 12; // Ethereum Sepolia: 12 seconds/block
    console.log(`   Blocks Remaining: ${blocksRemaining}`);
    console.log(`   Time Remaining: ${Math.floor(timeRemainingSeconds / 60)} minutes (${timeRemainingSeconds} seconds)`);
    console.log('');

    console.log('📝 METADATA:');
    console.log(`   Metadata IPFS: ${auction.metadataIPFS || 'N/A'}`);
    console.log(`   Duration: ${auction.duration ? auction.duration.toString() : 'N/A'} minutes`);
    console.log('');

    console.log('🎨 NFT INFO:');
    console.log(`   NFT Token ID: ${auction.nftTokenId ? auction.nftTokenId.toString() : 'Not minted yet'}`);
    console.log('');

    console.log('📊 STATUS:');
    console.log(`   Ended: ${auction.ended ? 'YES' : 'NO'}`);
    console.log(`   Meeting Scheduled: ${auction.meetingScheduled ? 'YES' : 'NO'}`);
    console.log('');

    console.log('🎪 DASHBOARD FIELDS (from smart contract):');
    console.log(`   Seller Name: ${auction.sellerName || 'N/A'}`);
    console.log(`   Event Name: ${auction.eventName || 'N/A'}`);
    console.log(`   Event Date: ${auction.eventDate ? new Date(Number(auction.eventDate) * 1000).toISOString() : 'N/A'}`);
    console.log(`   Event Start Time: ${auction.eventStartTime ? new Date(Number(auction.eventStartTime) * 1000).toISOString() : 'N/A'}`);
    console.log(`   Event End Time: ${auction.eventEndTime ? new Date(Number(auction.eventEndTime) * 1000).toISOString() : 'N/A'}`);
    console.log(`   Profile Picture: ${auction.profilePicture || 'N/A'}`);
    console.log('');

    console.log('='.repeat(60));
    console.log('RAW AUCTION OBJECT:');
    console.log('='.repeat(60));
    console.log(JSON.stringify(auction, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    , 2));
    console.log('');

    console.log('='.repeat(60));
    console.log('✅ Test completed successfully!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('');
    console.error('❌ ERROR:', error.message);
    console.error('');
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
  }
}

// Run the test
testFetchAuction77().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
