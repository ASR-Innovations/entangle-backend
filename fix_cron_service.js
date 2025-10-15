require('dotenv').config();
const { ethers } = require('ethers');

const CONTRACT_ADDRESS = '0x6fD65aE833C9679cBC571581CE0f5Cd73D565796';
const RPC_URL = 'https://avax-fuji.g.alchemy.com/v2/Yo4enHB113igpnycl13On';

// Contract ABI
const CONTRACT_ABI = [
  'function getAuction(uint256 _auctionId) external view returns (tuple(uint256 id, address host, uint256 endBlock, uint256 reservePrice, uint256 highestBid, address highestBidder, string metadataIPFS, string hostTwitterId, bool ended, bool meetingScheduled, uint256 duration))',
  'function auctionCounter() external view returns (uint256)',
  'function endAuction(uint256 _auctionId) external',
  'function cancelAuction(uint256 _auctionId) external'
];

async function fixCronService() {
  console.log('🔧 Starting cron service fix...');
  
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

    // Find problematic auctions
    const problematicAuctions = [];
    
    for (let i = 1; i <= auctionCounter; i++) {
      try {
        const auction = await contract.getAuction(i);
        if (!auction.ended && Number(auction.endBlock) <= currentBlock) {
          problematicAuctions.push({
            id: i,
            auction: auction,
            blocksOverdue: currentBlock - Number(auction.endBlock)
          });
        }
      } catch (error) {
        console.log(`⚠️  Could not check auction ${i}: ${error.message}`);
      }
    }

    console.log(`\n🔍 Found ${problematicAuctions.length} problematic auctions:`);
    problematicAuctions.forEach(auction => {
      console.log(`   Auction ${auction.id}: ${auction.blocksOverdue} blocks overdue, Winner: ${auction.auction.highestBidder}`);
    });

    if (problematicAuctions.length === 0) {
      console.log('✅ No problematic auctions found!');
      return;
    }

    // Try different approaches for each problematic auction
    for (const { id, auction } of problematicAuctions) {
      console.log(`\n🔧 Attempting to fix auction ${id}...`);
      
      // Approach 1: Try to end auction normally
      try {
        console.log(`   🎯 Approach 1: Normal endAuction call...`);
        const gasEstimate = await contract.endAuction.estimateGas(id);
        const tx = await contract.endAuction(id, { gasLimit: gasEstimate * 2n });
        await tx.wait();
        console.log(`   ✅ Auction ${id} ended successfully with normal call!`);
        continue;
      } catch (error) {
        console.log(`   ❌ Normal endAuction failed: ${error.message}`);
      }

      // Approach 2: Try with higher gas limit
      try {
        console.log(`   🎯 Approach 2: High gas limit endAuction call...`);
        const tx = await contract.endAuction(id, { gasLimit: 1000000n });
        await tx.wait();
        console.log(`   ✅ Auction ${id} ended successfully with high gas limit!`);
        continue;
      } catch (error) {
        console.log(`   ❌ High gas endAuction failed: ${error.message}`);
      }

      // Approach 3: Try cancelAuction instead (if available)
      try {
        console.log(`   🎯 Approach 3: Try cancelAuction...`);
        const gasEstimate = await contract.cancelAuction.estimateGas(id);
        const tx = await contract.cancelAuction(id, { gasLimit: gasEstimate * 2n });
        await tx.wait();
        console.log(`   ✅ Auction ${id} cancelled successfully!`);
        continue;
      } catch (error) {
        console.log(`   ❌ Cancel auction failed: ${error.message}`);
      }

      // Approach 4: Skip this auction and log for manual intervention
      console.log(`   ⚠️  All approaches failed for auction ${id}`);
      console.log(`   📝 Manual intervention required for auction ${id}`);
      console.log(`   💡 Consider:`);
      console.log(`      - Updating the smart contract`);
      console.log(`      - Manual state modification`);
      console.log(`      - Contract redeployment`);
    }

    console.log(`\n🎉 Cron service fix completed!`);
    console.log(`📊 Summary:`);
    console.log(`   Total auctions checked: ${auctionCounter}`);
    console.log(`   Problematic auctions found: ${problematicAuctions.length}`);
    console.log(`   Actions taken: See above for details`);

  } catch (error) {
    console.error('❌ Error in cron service fix:', error);
  }
}

if (require.main === module) {
  fixCronService();
}

module.exports = { fixCronService };
