require('dotenv').config();
const { ethers } = require('ethers');

const CONTRACT_ADDRESS = '0x6fD65aE833C9679cBC571581CE0f5Cd73D565796';
const RPC_URL = 'https://avax-fuji.g.alchemy.com/v2/Yo4enHB113igpnycl13On';

// Contract ABI for endAuction function
const CONTRACT_ABI = [
  'function endAuction(uint256 _auctionId) external',
  'function getAuction(uint256 _auctionId) external view returns (tuple(uint256 id, address host, uint256 endBlock, uint256 reservePrice, uint256 highestBid, address highestBidder, string metadataIPFS, string hostTwitterId, bool ended, bool meetingScheduled, uint256 duration))',
  'function auctionCounter() external view returns (uint256)'
];

async function manualEndAuctions() {
  console.log('🚀 Starting manual auction ending process...');
  
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
    console.log(`📝 Contract: ${CONTRACT_ADDRESS}`);

    // Check wallet balance
    const walletBalance = await provider.getBalance(wallet.address);
    console.log(`💰 Wallet balance: ${ethers.formatEther(walletBalance)} AVAX`);

    // Check contract balance
    const contractBalance = await provider.getBalance(CONTRACT_ADDRESS);
    console.log(`🏦 Contract balance: ${ethers.formatEther(contractBalance)} AVAX`);

    const auctionCounter = await contract.auctionCounter();
    console.log(`🏷️  Total auctions: ${auctionCounter}`);

    // Focus on problematic auctions 35 and 36
    const problematicAuctions = [35, 36];
    
    for (const auctionId of problematicAuctions) {
      console.log(`\n🔍 Checking auction ${auctionId}...`);
      
      try {
        const auction = await contract.getAuction(auctionId);
        console.log(`   📊 Auction ${auctionId} details:`);
        console.log(`      ID: ${auction.id}`);
        console.log(`      Host: ${auction.host}`);
        console.log(`      End Block: ${auction.endBlock}`);
        console.log(`      Current Block: ${currentBlock}`);
        console.log(`      Blocks Remaining: ${Number(auction.endBlock) - currentBlock}`);
        console.log(`      Ended: ${auction.ended}`);
        console.log(`      Highest Bid: ${ethers.formatEther(auction.highestBid)} AVAX`);
        console.log(`      Winner: ${auction.highestBidder}`);
        console.log(`      Should End: ${Number(auction.endBlock) <= currentBlock}`);

        if (!auction.ended && Number(auction.endBlock) <= currentBlock) {
          console.log(`\n🎯 Attempting to end auction ${auctionId}...`);
          
          try {
            // Try to estimate gas first
            const gasEstimate = await contract.endAuction.estimateGas(auctionId);
            console.log(`   ⛽ Gas estimate: ${gasEstimate.toString()}`);
            
            // Send the transaction
            const tx = await contract.endAuction(auctionId, {
              gasLimit: gasEstimate * 2n // Use 2x gas limit for safety
            });
            
            console.log(`   📝 Transaction submitted: ${tx.hash}`);
            console.log(`   ⏳ Waiting for confirmation...`);
            
            const receipt = await tx.wait();
            console.log(`   ✅ Auction ${auctionId} ended successfully!`);
            console.log(`   ⛽ Gas used: ${receipt.gasUsed}`);
            console.log(`   🔗 Transaction: ${tx.hash}`);
            
          } catch (error) {
            console.error(`   ❌ Failed to end auction ${auctionId}:`);
            console.error(`   Error: ${error.message}`);
            
            if (error.message.includes('Token transfer failed')) {
              console.log(`   🔍 This suggests an issue with the contract's internal transfer logic`);
              console.log(`   💡 Possible causes:`);
              console.log(`      - Insufficient contract balance for the specific transfer`);
              console.log(`      - Corrupted auction data`);
              console.log(`      - Contract logic bug in endAuction function`);
            }
          }
        } else if (auction.ended) {
          console.log(`   ✅ Auction ${auctionId} is already ended`);
        } else {
          console.log(`   ⏳ Auction ${auctionId} is not ready to end yet`);
        }
        
      } catch (error) {
        console.error(`   ❌ Failed to get auction ${auctionId}: ${error.message}`);
      }
    }

    console.log('\n🎉 Manual auction ending process completed!');

  } catch (error) {
    console.error('❌ Error in manual auction ending:', error);
  }
}

if (require.main === module) {
  manualEndAuctions();
}

module.exports = { manualEndAuctions };
