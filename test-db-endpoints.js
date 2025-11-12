const axios = require('axios');

const BASE_URL = 'http://localhost:5009';

async function testEndpoints() {
  console.log('🧪 Testing Database Auction Endpoints\n');
  console.log('='.repeat(60));

  try {
    // Test 1: Get all active auctions from DB
    console.log('\n📊 Test 1: GET /api/auctions/active/db');
    console.log('-'.repeat(60));
    const activeResponse = await axios.get(`${BASE_URL}/api/auctions/active/db?limit=10`);
    console.log(`✅ Status: ${activeResponse.status}`);
    console.log(`📦 Total auctions: ${activeResponse.data.auctions.length}`);
    
    if (activeResponse.data.auctions.length > 0) {
      const firstAuction = activeResponse.data.auctions[0];
      console.log('\n📋 First Auction Sample:');
      console.log(`   ID: ${firstAuction.id}`);
      console.log(`   Seller: ${firstAuction.sellerName}`);
      console.log(`   Title: ${firstAuction.title}`);
      console.log(`   Price: ${firstAuction.price} USDC (${firstAuction.priceLabel})`);
      console.log(`   Time Left: ${firstAuction.timeLeft}`);
      console.log(`   Badge: ${firstAuction.badge}`);
      console.log(`   Has Highest Bid: ${firstAuction.hasHighestBid}`);
      
      // Test 2: Get specific auction by ID
      console.log('\n📊 Test 2: GET /api/auctions/db/:auctionId');
      console.log('-'.repeat(60));
      const auctionId = firstAuction.id;
      const singleResponse = await axios.get(`${BASE_URL}/api/auctions/db/${auctionId}`);
      console.log(`✅ Status: ${singleResponse.status}`);
      console.log(`📦 Auction ID: ${singleResponse.data.auction.id}`);
      console.log(`   Seller: ${singleResponse.data.auction.sellerName}`);
      console.log(`   Title: ${singleResponse.data.auction.title}`);
      console.log(`   Price: ${singleResponse.data.auction.price} USDC (${singleResponse.data.auction.priceLabel})`);
      console.log(`   Floor Price: ${(parseFloat(singleResponse.data.auction.floorPrice) / 1e18).toFixed(3)} USDC`);
      console.log(`   Highest Bid: ${singleResponse.data.auction.highestBid ? (parseFloat(singleResponse.data.auction.highestBid) / 1e18).toFixed(3) : 'None'} USDC`);
      console.log(`   Time Left: ${singleResponse.data.auction.timeLeft}`);
      console.log(`   Badge: ${singleResponse.data.auction.badge}`);
      console.log(`   Event Date: ${singleResponse.data.auction.eventDate}`);
      console.log(`   Event Time: ${singleResponse.data.auction.eventStartTime} - ${singleResponse.data.auction.eventEndTime}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests passed!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run tests
testEndpoints().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
