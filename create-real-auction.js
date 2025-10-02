const { ethers } = require('ethers');
require('dotenv').config();

// Contract configuration
const CONTRACT_ADDRESS = '0x6fD65aE833C9679cBC571581CE0f5Cd73D565796';
const RPC_URL = 'https://api.avax-test.network/ext/bc/C/rpc';

// You need to set your private key in environment variable
const PRIVATE_KEY = process.env.PRIVATE_KEY || '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

// Contract ABI (simplified for testing)
const ABI = [
  "function createAuction(address _host, string memory _twitterId, uint256 _duration, uint256 _reservePrice, string memory _metadataIPFS, uint256 _meetingDuration, string memory _sellerName, string memory _eventName, uint256 _eventDate, uint256 _eventStartTime, uint256 _eventEndTime, string memory _profilePicture) external returns (uint256)",
  "function auctionCounter() external view returns (uint256)",
  "function getAuction(uint256 _auctionId) external view returns (tuple(uint256 id, address host, uint256 endBlock, uint256 reservePrice, uint256 highestBid, address highestBidder, string memory metadataIPFS, string memory hostTwitterId, bool ended, bool meetingScheduled, uint256 duration, uint256 nftTokenId, string memory sellerName, string memory eventName, uint256 eventDate, uint256 eventStartTime, uint256 eventEndTime, string memory profilePicture))"
];

async function createRealAuction() {
  try {
    console.log('🔗 Connecting to Avalanche Fuji testnet...');
    
    // Initialize provider and wallet
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    
    // Initialize contract
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);
    
    console.log('✅ Contract connected successfully');
    console.log(`📍 Contract address: ${CONTRACT_ADDRESS}`);
    console.log(`👤 Wallet address: ${wallet.address}`);
    
    // Get current auction counter
    const currentCounter = await contract.auctionCounter();
    console.log(`📊 Current auction counter: ${currentCounter.toString()}`);
    
    // Create a test auction
    console.log('\n🎯 Creating real auction...');
    
    const testAuction = {
      host: wallet.address, // Use the wallet address as host
      twitterId: 'test_user_123',
      duration: 100, // 100 blocks
      reservePrice: ethers.parseEther('0.1'), // 0.1 AVAX
      metadataIPFS: 'QmTest123456789',
      meetingDuration: 30, // 30 minutes
      sellerName: 'Test User',
      eventName: 'Test Meeting',
      eventDate: Math.floor(Date.now() / 1000) + 86400, // Tomorrow
      eventStartTime: 14 * 3600, // 2 PM
      eventEndTime: 15 * 3600, // 3 PM
      profilePicture: 'https://example.com/profile.jpg'
    };
    
    console.log('📝 Auction details:', {
      ...testAuction,
      reservePrice: ethers.formatEther(testAuction.reservePrice)
    });
    
    // Estimate gas
    const gasEstimate = await contract.createAuction.estimateGas(
      testAuction.host,
      testAuction.twitterId,
      testAuction.duration,
      testAuction.reservePrice,
      testAuction.metadataIPFS,
      testAuction.meetingDuration,
      testAuction.sellerName,
      testAuction.eventName,
      testAuction.eventDate,
      testAuction.eventStartTime,
      testAuction.eventEndTime,
      testAuction.profilePicture
    );
    
    console.log(`⛽ Gas estimate: ${gasEstimate.toString()}`);
    
    // Create the auction
    const tx = await contract.createAuction(
      testAuction.host,
      testAuction.twitterId,
      testAuction.duration,
      testAuction.reservePrice,
      testAuction.metadataIPFS,
      testAuction.meetingDuration,
      testAuction.sellerName,
      testAuction.eventName,
      testAuction.eventDate,
      testAuction.eventStartTime,
      testAuction.eventEndTime,
      testAuction.profilePicture,
      { gasLimit: gasEstimate * 2n } // Add some buffer
    );
    
    console.log(`🚀 Transaction sent: ${tx.hash}`);
    console.log('⏳ Waiting for confirmation...');
    
    const receipt = await tx.wait();
    console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
    console.log(`🎉 Auction created successfully!`);
    console.log(`📋 Transaction hash: ${tx.hash}`);
    
    // Get the new auction counter
    const newCounter = await contract.auctionCounter();
    console.log(`📊 New auction counter: ${newCounter.toString()}`);
    
    return {
      auctionId: Number(newCounter),
      transactionHash: tx.hash,
      auction: testAuction
    };
    
  } catch (error) {
    console.error('❌ Error creating auction:', error);
    
    if (error.code === 'INSUFFICIENT_FUNDS') {
      console.log('💡 Make sure your wallet has enough AVAX for gas fees');
    } else if (error.code === 'INVALID_ARGUMENT') {
      console.log('💡 Check your private key and contract address');
    }
  }
}

// Run the test
createRealAuction();


