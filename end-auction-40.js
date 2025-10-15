const { ethers } = require('ethers');
require('dotenv').config();

// Contract configuration
const CONTRACT_ADDRESS = '0x6fD65aE833C9679cBC571581CE0f5Cd73D565796';
const RPC_URL = process.env.ETH_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc';
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// Contract ABI (minimal for endAuction)
const CONTRACT_ABI = [
  {
    "inputs": [{"internalType": "uint256", "name": "auctionId", "type": "uint256"}],
    "name": "endAuction",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "auctionId", "type": "uint256"}],
    "name": "getAuction",
    "outputs": [
      {"internalType": "address", "name": "host", "type": "address"},
      {"internalType": "uint256", "name": "startBlock", "type": "uint256"},
      {"internalType": "uint256", "name": "endBlock", "type": "uint256"},
      {"internalType": "uint256", "name": "reservePrice", "type": "uint256"},
      {"internalType": "uint256", "name": "highestBid", "type": "uint256"},
      {"internalType": "address", "name": "highestBidder", "type": "address"},
      {"internalType": "string", "name": "meetingMetadataIPFS", "type": "string"},
      {"internalType": "string", "name": "hostTwitterId", "type": "string"},
      {"internalType": "bool", "name": "ended", "type": "bool"},
      {"internalType": "bool", "name": "meetingScheduled", "type": "bool"},
      {"internalType": "uint256", "name": "duration", "type": "uint256"},
      {"internalType": "uint256", "name": "nftTokenId", "type": "uint256"},
      {"internalType": "string", "name": "sellerName", "type": "string"},
      {"internalType": "string", "name": "eventName", "type": "string"},
      {"internalType": "uint256", "name": "eventDate", "type": "uint256"},
      {"internalType": "uint256", "name": "eventStartTime", "type": "uint256"},
      {"internalType": "uint256", "name": "eventEndTime", "type": "uint256"},
      {"internalType": "string", "name": "profilePicture", "type": "string"}
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

async function endAuction40() {
  try {
    console.log('🚀 Starting manual ending of auction 40...');
    
    // Setup provider and wallet
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    
    console.log(`💼 Using wallet: ${wallet.address}`);
    console.log(`📝 Contract: ${CONTRACT_ADDRESS}`);
    
    // Get current block
    const currentBlock = await provider.getBlockNumber();
    console.log(`📦 Current block: ${currentBlock}`);
    
    // Get wallet balance
    const balance = await provider.getBalance(wallet.address);
    console.log(`💰 Wallet balance: ${ethers.formatEther(balance)} AVAX`);
    
    // Create contract instance
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
    
    // Check auction 40 details
    console.log('\n🔍 Checking auction 40...');
    const auction = await contract.getAuction(40);
    
    console.log('   📊 Auction 40 details:');
    console.log(`      ID: 40`);
    console.log(`      Host: ${auction.host}`);
    console.log(`      End Block: ${auction.endBlock}`);
    console.log(`      Current Block: ${currentBlock}`);
    console.log(`      Blocks Remaining: ${auction.endBlock - currentBlock}`);
    console.log(`      Ended: ${auction.ended}`);
    console.log(`      Highest Bid: ${ethers.formatEther(auction.highestBid)} AVAX`);
    console.log(`      Winner: ${auction.highestBidder}`);
    
    // Check if auction should be ended
    const shouldEnd = currentBlock >= auction.endBlock && !auction.ended;
    console.log(`      Should End: ${shouldEnd}`);
    
    if (!shouldEnd) {
      console.log('❌ Auction 40 is not ready to be ended yet');
      console.log(`   Current block: ${currentBlock}`);
      console.log(`   End block: ${auction.endBlock}`);
      console.log(`   Blocks remaining: ${auction.endBlock - currentBlock}`);
      return;
    }
    
    if (auction.ended) {
      console.log('✅ Auction 40 is already ended');
      return;
    }
    
    // Attempt to end auction 40
    console.log('\n🎯 Attempting to end auction 40...');
    
    try {
      // Estimate gas first
      const gasEstimate = await contract.endAuction.estimateGas(40);
      console.log(`   ⛽ Gas estimate: ${gasEstimate.toString()}`);
      
      // End the auction
      const tx = await contract.endAuction(40, {
        gasLimit: gasEstimate * 2n // Add buffer
      });
      
      console.log(`   📝 Transaction sent: ${tx.hash}`);
      console.log(`   ⏳ Waiting for confirmation...`);
      
      // Wait for confirmation
      const receipt = await tx.wait();
      
      console.log('✅ Auction 40 ended successfully!');
      console.log(`   📝 Transaction hash: ${receipt.hash}`);
      console.log(`   ⛽ Gas used: ${receipt.gasUsed.toString()}`);
      console.log(`   🔢 Block number: ${receipt.blockNumber}`);
      
      // Get updated auction data
      const updatedAuction = await contract.getAuction(40);
      console.log('\n📊 Updated auction 40 details:');
      console.log(`   Ended: ${updatedAuction.ended}`);
      console.log(`   NFT Token ID: ${updatedAuction.nftTokenId}`);
      console.log(`   Meeting Scheduled: ${updatedAuction.meetingScheduled}`);
      
    } catch (error) {
      console.log('❌ Failed to end auction 40:');
      console.log(`   Error: ${error.message}`);
      
      if (error.message.includes('Token transfer failed')) {
        console.log('   🔍 This suggests an issue with the contract\'s internal transfer logic');
        console.log('   💡 Possible causes:');
        console.log('      - Insufficient contract balance for the specific transfer');
        console.log('      - Corrupted auction data');
        console.log('      - Contract logic bug in endAuction function');
      }
    }
    
  } catch (error) {
    console.error('❌ Process failed:', error);
  }
}

// Run the function
endAuction40();
