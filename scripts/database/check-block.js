const { ethers } = require('ethers');
require('dotenv').config();

// Contract configuration
const RPC_URL = 'https://api.avax-test.network/ext/bc/C/rpc';

async function checkBlock() {
  try {
    console.log('🔍 Checking current block...');
    
    // Initialize provider
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    
    // Get current block
    const currentBlock = await provider.getBlockNumber();
    console.log(`📦 Current block: ${currentBlock}`);
    
    // Calculate auction end block
    const auctionEndBlock = 46432443; // From our auction creation
    const blocksRemaining = auctionEndBlock - currentBlock;
    
    console.log(`🎯 Auction end block: ${auctionEndBlock}`);
    console.log(`⏰ Blocks remaining: ${blocksRemaining}`);
    
    if (blocksRemaining <= 0) {
      console.log('✅ Auction should have ended!');
    } else {
      console.log('⏳ Auction is still active');
    }
    
  } catch (error) {
    console.error('❌ Error checking block:', error);
  }
}

// Run the check
checkBlock();


