const { ethers } = require('ethers');
require('dotenv').config();

// Contract configuration
const CONTRACT_ADDRESS = '0x6fD65aE833C9679cBC571581CE0f5Cd73D565796';
const RPC_URL = 'https://api.avax-test.network/ext/bc/C/rpc';

// Contract ABI (simplified for testing)
const ABI = [
  "function createAuction(address _host, string memory _twitterId, uint256 _duration, uint256 _reservePrice, string memory _metadataIPFS, uint256 _meetingDuration, string memory _sellerName, string memory _eventName, uint256 _eventDate, uint256 _eventStartTime, uint256 _eventEndTime, string memory _profilePicture) external returns (uint256)",
  "function auctionCounter() external view returns (uint256)",
  "function getAuction(uint256 _auctionId) external view returns (tuple(uint256 id, address host, uint256 endBlock, uint256 reservePrice, uint256 highestBid, address highestBidder, string memory metadataIPFS, string memory hostTwitterId, bool ended, bool meetingScheduled, uint256 duration, uint256 nftTokenId, string memory sellerName, string memory eventName, uint256 eventDate, uint256 eventStartTime, uint256 eventEndTime, string memory profilePicture))"
];

async function createTestAuction() {
  try {
    console.log('🔗 Connecting to Avalanche Fuji testnet...');
    
    // Initialize provider
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    
    // Initialize contract
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
    
    console.log('✅ Contract connected successfully');
    
    // Get current auction counter
    const currentCounter = await contract.auctionCounter();
    console.log(`📊 Current auction counter: ${currentCounter.toString()}`);
    
    // Create a test auction
    console.log('\n🎯 Creating test auction...');
    
    const testAuction = {
      host: '0x0000000000000000000000000000000000000000', // Test address
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
    
    // Note: We can't actually create the auction without a private key
    // But we can simulate the transaction hash for testing the API
    const mockTransactionHash = '0x' + '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    
    console.log(`\n🎉 Mock transaction hash: ${mockTransactionHash}`);
    console.log('📋 Next step: Call the API to record this auction');
    
    return {
      auctionId: Number(currentCounter) + 1,
      transactionHash: mockTransactionHash,
      auction: testAuction
    };
    
  } catch (error) {
    console.error('❌ Error creating test auction:', error);
  }
}

// Run the test
createTestAuction();


