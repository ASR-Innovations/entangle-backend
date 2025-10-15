require('dotenv').config();
const { ethers } = require('ethers');

const CONTRACT_ADDRESS = '0x6fD65aE833C9679cBC571581CE0f5Cd73D565796';
const RPC_URL = 'https://avax-fuji.g.alchemy.com/v2/Yo4enHB113igpnycl13On';

// Extended ABI for detailed contract inspection
const CONTRACT_ABI = [
  'function getAuction(uint256 _auctionId) external view returns (tuple(uint256 id, address host, uint256 endBlock, uint256 reservePrice, uint256 highestBid, address highestBidder, string metadataIPFS, string hostTwitterId, bool ended, bool meetingScheduled, uint256 duration))',
  'function auctionCounter() external view returns (uint256)',
  'function owner() external view returns (address)',
  'function platformFee() external view returns (uint256)',
  'function pendingReturns(uint256 _auctionId, address _bidder) external view returns (uint256)',
  'function balanceOf(address _address) external view returns (uint256)',
  'function totalSupply() external view returns (uint256)',
  'function nftCounter() external view returns (uint256)',
  'function nftMetadata(uint256 _tokenId) external view returns (tuple(uint256 auctionId, address host, string hostTwitterId, string metadataIPFS, uint256 duration))',
  'function nftUsedForMeeting(uint256 _tokenId) external view returns (bool)',
  'function userBidStats(uint256 _auctionId, address _user) external view returns (tuple(uint256 bidCount, uint256 firstBidTime, uint256 lastBidTime, uint256 currentBid, bool hasWon))',
  'function bidHistory(uint256 _auctionId, uint256 _index) external view returns (tuple(uint256 amount, uint256 timestamp, address bidder))',
  'function getBidHistory(uint256 _auctionId) external view returns (tuple(uint256 amount, uint256 timestamp, address bidder)[])',
  'function getBidCount(uint256 _auctionId) external view returns (uint256)'
];

async function diagnoseContract() {
  console.log('🔍 Starting detailed contract diagnosis...');
  
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

  try {
    console.log(`📝 Contract: ${CONTRACT_ADDRESS}`);
    
    // Basic contract info
    const owner = await contract.owner();
    const platformFee = await contract.platformFee();
    const auctionCounter = await contract.auctionCounter();
    const nftCounter = await contract.nftCounter();
    
    console.log(`👤 Owner: ${owner}`);
    console.log(`💰 Platform Fee: ${platformFee} (${Number(platformFee)/100}%)`);
    console.log(`🏷️  Auction Counter: ${auctionCounter}`);
    console.log(`🎨 NFT Counter: ${nftCounter}`);
    
    // Check contract balance
    const contractBalance = await provider.getBalance(CONTRACT_ADDRESS);
    console.log(`🏦 Contract Balance: ${ethers.formatEther(contractBalance)} AVAX`);
    
    // Analyze problematic auctions
    const problematicAuctions = [35, 36];
    
    for (const auctionId of problematicAuctions) {
      console.log(`\n🔍 Detailed analysis of auction ${auctionId}:`);
      
      try {
        const auction = await contract.getAuction(auctionId);
        
        console.log(`   📊 Basic Info:`);
        console.log(`      ID: ${auction.id}`);
        console.log(`      Host: ${auction.host}`);
        console.log(`      End Block: ${auction.endBlock}`);
        console.log(`      Ended: ${auction.ended}`);
        console.log(`      Meeting Scheduled: ${auction.meetingScheduled}`);
        console.log(`      Duration: ${auction.duration}`);
        
        console.log(`   💰 Financial Info:`);
        console.log(`      Reserve Price: ${ethers.formatEther(auction.reservePrice)} AVAX`);
        console.log(`      Highest Bid: ${ethers.formatEther(auction.highestBid)} AVAX`);
        console.log(`      Winner: ${auction.highestBidder}`);
        
        // Calculate expected transfers
        const highestBid = auction.highestBid;
        const platformFeeAmount = (highestBid * platformFee) / 10000n;
        const hostAmount = highestBid - platformFeeAmount;
        
        console.log(`   🧮 Expected Transfers:`);
        console.log(`      Total Bid: ${ethers.formatEther(highestBid)} AVAX`);
        console.log(`      Platform Fee (${Number(platformFee)/100}%): ${ethers.formatEther(platformFeeAmount)} AVAX`);
        console.log(`      Host Amount: ${ethers.formatEther(hostAmount)} AVAX`);
        console.log(`      Contract Balance: ${ethers.formatEther(contractBalance)} AVAX`);
        console.log(`      Sufficient Balance: ${contractBalance >= highestBid ? '✅ Yes' : '❌ No'}`);
        
        // Check if winner has pending returns
        if (auction.highestBidder !== ethers.ZeroAddress) {
          const pendingReturns = await contract.pendingReturns(auctionId, auction.highestBidder);
          console.log(`   💳 Winner Pending Returns: ${ethers.formatEther(pendingReturns)} AVAX`);
        }
        
        // Check bid history
        try {
          const bidCount = await contract.getBidCount(auctionId);
          console.log(`   📈 Bid Count: ${bidCount}`);
          
          if (bidCount > 0) {
            const bidHistory = await contract.getBidHistory(auctionId);
            console.log(`   📋 Bid History (last 3 bids):`);
            const lastBids = bidHistory.slice(-3);
            lastBids.forEach((bid, index) => {
              console.log(`      Bid ${bidHistory.length - lastBids.length + index + 1}: ${ethers.formatEther(bid.amount)} AVAX by ${bid.bidder} at block ${bid.timestamp}`);
            });
          }
        } catch (error) {
          console.log(`   ⚠️  Could not fetch bid history: ${error.message}`);
        }
        
        // Check if NFT was minted
        if (auction.ended) {
          try {
            const nftMetadata = await contract.nftMetadata(auctionId);
            console.log(`   🎨 NFT Metadata: Auction ${nftMetadata.auctionId}, Host ${nftMetadata.host}`);
          } catch (error) {
            console.log(`   ⚠️  No NFT metadata found`);
          }
        }
        
      } catch (error) {
        console.error(`   ❌ Failed to analyze auction ${auctionId}: ${error.message}`);
      }
    }
    
    console.log(`\n🔍 Contract State Summary:`);
    console.log(`   Contract has sufficient balance: ${contractBalance > ethers.parseEther('0.5') ? '✅ Yes' : '❌ No'}`);
    console.log(`   Total auctions: ${auctionCounter}`);
    console.log(`   Total NFTs minted: ${nftCounter}`);
    
    console.log(`\n💡 Diagnosis Complete!`);
    console.log(`   The "Token transfer failed" error suggests:`);
    console.log(`   1. Contract internal logic issue in endAuction function`);
    console.log(`   2. Possible state corruption in auction data`);
    console.log(`   3. Contract may need to be updated or redeployed`);
    console.log(`   4. Manual intervention may be required`);

  } catch (error) {
    console.error('❌ Error in contract diagnosis:', error);
  }
}

if (require.main === module) {
  diagnoseContract();
}

module.exports = { diagnoseContract };
