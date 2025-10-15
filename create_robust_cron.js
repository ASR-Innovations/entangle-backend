require('dotenv').config();
const { ethers } = require('ethers');

const CONTRACT_ADDRESS = '0x6fD65aE833C9679cBC571581CE0f5Cd73D565796';
const RPC_URL = 'https://avax-fuji.g.alchemy.com/v2/Yo4enHB113igpnycl13On';

// Contract ABI
const CONTRACT_ABI = [
  'function getAuction(uint256 _auctionId) external view returns (tuple(uint256 id, address host, uint256 endBlock, uint256 reservePrice, uint256 highestBid, address highestBidder, string metadataIPFS, string hostTwitterId, bool ended, bool meetingScheduled, uint256 duration))',
  'function auctionCounter() external view returns (uint256)',
  'function endAuction(uint256 _auctionId) external'
];

// Track problematic auctions to avoid repeated attempts
const PROBLEMATIC_AUCTIONS = new Set([35, 36]);

async function robustAuctionCheck() {
  console.log('🤖 Starting robust auction check...');
  
  const privateKey = process.env.PLATFORM_PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ PLATFORM_PRIVATE_KEY environment variable is required');
    return;
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

  try {
    const currentBlock = await provider.getBlockNumber();
    console.log(`📦 Current block: ${currentBlock}`);
    console.log(`💼 Using wallet: ${wallet.address}`);

    const auctionCounter = await contract.auctionCounter();
    console.log(`🏷️  Total auctions: ${auctionCounter}`);

    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Check all auctions
    for (let i = 1; i <= auctionCounter; i++) {
      try {
        const auction = await contract.getAuction(i);
        
        // Skip if already ended
        if (auction.ended) {
          console.log(`   ✅ Auction ${i}: Already ended`);
          continue;
        }

        // Check if auction should be ended
        const shouldEnd = Number(auction.endBlock) <= currentBlock;
        const blocksRemaining = Number(auction.endBlock) - currentBlock;
        
        if (shouldEnd) {
          // Check if this is a known problematic auction
          if (PROBLEMATIC_AUCTIONS.has(i)) {
            console.log(`   ⚠️  Auction ${i}: Known problematic auction, skipping (${Math.abs(blocksRemaining)} blocks overdue)`);
            skippedCount++;
            continue;
          }

          console.log(`   🎯 Processing auction ${i} (${Math.abs(blocksRemaining)} blocks overdue)...`);
          
          try {
            // Try to end the auction
            const gasEstimate = await contract.endAuction.estimateGas(i);
            const tx = await contract.endAuction(i, { gasLimit: gasEstimate * 2n });
            
            console.log(`   📝 Transaction submitted: ${tx.hash}`);
            const receipt = await tx.wait();
            
            console.log(`   ✅ Auction ${i} ended successfully!`);
            console.log(`   ⛽ Gas used: ${receipt.gasUsed}`);
            processedCount++;
            
          } catch (error) {
            console.error(`   ❌ Failed to end auction ${i}: ${error.message}`);
            
            // If it's a token transfer error, add to problematic auctions
            if (error.message.includes('Token transfer failed')) {
              PROBLEMATIC_AUCTIONS.add(i);
              console.log(`   📝 Added auction ${i} to problematic auctions list`);
            }
            
            errorCount++;
          }
        } else {
          console.log(`   ⏳ Auction ${i}: Active (${blocksRemaining} blocks remaining)`);
        }
        
      } catch (error) {
        console.error(`   ❌ Failed to check auction ${i}: ${error.message}`);
        errorCount++;
      }
    }

    console.log(`\n📊 Robust auction check completed!`);
    console.log(`   ✅ Processed: ${processedCount} auctions`);
    console.log(`   ⚠️  Skipped: ${skippedCount} problematic auctions`);
    console.log(`   ❌ Errors: ${errorCount} auctions`);
    console.log(`   🚫 Known problematic: ${Array.from(PROBLEMATIC_AUCTIONS).join(', ')}`);

    // Log problematic auctions for manual intervention
    if (PROBLEMATIC_AUCTIONS.size > 0) {
      console.log(`\n📝 Manual intervention required for auctions: ${Array.from(PROBLEMATIC_AUCTIONS).join(', ')}`);
      console.log(`💡 These auctions have "Token transfer failed" errors and need:`);
      console.log(`   - Smart contract update`);
      console.log(`   - Manual state modification`);
      console.log(`   - Contract redeployment`);
    }

  } catch (error) {
    console.error('❌ Error in robust auction check:', error);
  }
}

// Export for use in cron service
module.exports = { robustAuctionCheck, PROBLEMATIC_AUCTIONS };

if (require.main === module) {
  robustAuctionCheck();
}
