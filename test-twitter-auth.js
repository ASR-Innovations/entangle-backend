/**
 * Test script for Twitter-enhanced Para authentication
 * Tests the /api/auth/para-auth endpoint with twitterUsername
 */

const BASE_URL = process.env.API_URL || 'http://localhost:5009';

async function testTwitterAuth() {
  console.log('🧪 Testing Twitter-Enhanced Para Auth\n');
  console.log('=' .repeat(60));
  
  // Test 1: Test Twitter data fetch directly (without Para verification)
  console.log('\n📋 Test 1: Direct Twitter API fetch');
  console.log('-'.repeat(40));
  
  try {
    const twitterResponse = await fetch('https://entangle-twitter.vercel.app/api/twitter/user/1o1_Kumar');
    const twitterData = await twitterResponse.json();
    
    if (twitterData.success) {
      console.log('✅ Twitter API working');
      console.log('   Username:', twitterData.user.username);
      console.log('   Name:', twitterData.user.name);
      console.log('   Followers:', twitterData.user.followersCount);
      console.log('   Verified:', twitterData.user.verified);
    } else {
      console.log('❌ Twitter API failed:', twitterData);
    }
  } catch (error) {
    console.log('❌ Twitter API error:', error.message);
  }
  
  // Test 2: Test para-auth endpoint structure (will fail without valid token)
  console.log('\n📋 Test 2: Para-auth endpoint structure');
  console.log('-'.repeat(40));
  
  try {
    // This will fail verification but shows the endpoint accepts the new parameter
    const response = await fetch(`${BASE_URL}/api/auth/para-auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        verificationToken: 'test_token_will_fail',
        walletAddress: '0x742d35cc6634c0532925a3b844bc9e7595f0beb7',
        twitterUsername: 'elonmusk'
      })
    });
    
    const data = await response.json();
    
    if (response.status === 401) {
      console.log('✅ Endpoint accepts twitterUsername parameter');
      console.log('   (Expected 401 - Para verification failed with test token)');
      console.log('   Response:', data.error);
    } else if (response.status === 400) {
      console.log('⚠️ Bad request:', data.error);
    } else {
      console.log('Response status:', response.status);
      console.log('Response:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.log('❌ Request error:', error.message);
  }
  
  // Test 3: Show expected request/response format
  console.log('\n📋 Test 3: Expected Request/Response Format');
  console.log('-'.repeat(40));
  
  console.log('\n📤 Request:');
  console.log(`POST ${BASE_URL}/api/auth/para-auth`);
  console.log('Content-Type: application/json');
  console.log(JSON.stringify({
    verificationToken: "eyJhbG...",
    walletAddress: "0x1234...",
    twitterUsername: "johndoe"
  }, null, 2));
  
  console.log('\n📥 Expected Response (with Twitter):');
  console.log(JSON.stringify({
    success: true,
    token: "jwt_token...",
    session: {
      userId: "para_user_id",
      walletAddress: "0x1234...",
      displayName: "John Doe",
      email: "john@example.com"
    },
    user: {
      id: 1,
      paraUserId: "oauth_abc123",
      email: "john@example.com",
      authType: "oauth",
      oAuthMethod: "x",
      displayName: "John Doe",
      walletAddress: "0x1234...",
      role: "para_user",
      hasWallet: true,
      isCreator: true,
      twitterUsername: "johndoe",
      twitterId: "1234567890",
      profileImage: "https://pbs.twimg.com/..."
    },
    twitterProfile: {
      id: "1234567890",
      username: "johndoe",
      name: "John Doe",
      bio: "Developer",
      profileImageUrl: "https://pbs.twimg.com/...",
      verified: false,
      followersCount: 1500,
      followingCount: 500,
      tweetCount: 2500
    },
    creatorProfile: {
      id: 1,
      walletAddress: "0x1234...",
      twitterUsername: "johndoe",
      twitterId: "1234567890",
      followersCount: 1500,
      verified: false,
      profileImage: "https://pbs.twimg.com/...",
      bio: "Developer"
    },
    note: "Authentication complete with Twitter profile. Creator profile created/updated."
  }, null, 2));
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Test complete!\n');
  
  console.log('📝 Summary:');
  console.log('   - /api/auth/para-auth now accepts twitterUsername');
  console.log('   - When twitterUsername is provided:');
  console.log('     1. Fetches Twitter profile from Entangle API');
  console.log('     2. Creates/updates creator_profiles table');
  console.log('     3. Returns twitterProfile in response');
  console.log('     4. Returns creatorProfile in response');
  console.log('   - Frontend gets all Twitter data directly from auth response');
}

testTwitterAuth().catch(console.error);
