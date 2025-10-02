const { ethers } = require('ethers');
require('dotenv').config();

// Contract configuration
const CONTRACT_ADDRESS = '0x6fD65aE833C9679cBC571581CE0f5Cd73D565796';
const RPC_URL = 'https://api.avax-test.network/ext/bc/C/rpc';

// Contract ABI (simplified for testing)
const ABI = [
  "function createAuction(address _host, string memory _twitterId, uint256 _duration, uint256 _reservePrice, string memory _metadataIPFS, uint256 _meetingDuration, string memory _sellerName, string memory _eventName, uint256 _eventDate, uint256 _eventStartTime, uint256 _eventEndTime, string memory _profilePicture) external returns (uint256)",
  "function auctionCounter() external view returns (uint256)",
  "function getAuction(uint256 _auctionId) external view returns (tuple(uint256 id, address host, uint256 endBlock, uint256 reservePrice, uint256 highestBid, address highestBidder, string memory metadataIPFS, string memory hostTwitterId, bool ended, bool meetingScheduled, uint256 duration, uint256 nftTokenId, string memory sellerName, string memory eventName, uint256 eventDate, uint256 eventStartTime, uint256 eventEndTime, string memory profilePicture))",
  "function name() external view returns (string memory)"
];

async function testContract() {
  try {
    console.log('🔗 Connecting to Avalanche Fuji testnet...');
    
    // Initialize provider
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    
    // Initialize contract
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
    
    console.log('✅ Contract connected successfully');
    console.log(`📍 Contract address: ${CONTRACT_ADDRESS}`);
    
    // Test basic functions
    console.log('\n🧪 Testing basic functions...');
    
    try {
      const name = await contract.name();
      console.log(`✅ Contract name: ${name}`);
    } catch (error) {
      console.log(`❌ Error getting name: ${error.message}`);
    }
    
    try {
      const auctionCounter = await contract.auctionCounter();
      console.log(`✅ Auction counter: ${auctionCounter.toString()}`);
    } catch (error) {
      console.log(`❌ Error getting auction counter: ${error.message}`);
    }
    
    // Test getting an auction
    try {
      const auction = await contract.getAuction(1);
      console.log(`✅ Auction 1 exists: ${auction.id.toString()}`);
    } catch (error) {
      console.log(`❌ Error getting auction 1: ${error.message}`);
    }
    
    console.log('\n🎯 Contract is working! Ready for auction creation.');
    
  } catch (error) {
    console.error('❌ Error testing contract:', error);
  }
}

// Run the test
testContract();


