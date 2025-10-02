const axios = require('axios');
require('dotenv').config();

const BASE_URL = "http://localhost:5009";

// Test data
const TEST_DATA = {
  paraAuth: {
    verificationToken: '1db0ccca-fcb4-42ed-8b15-1c4dbf9d95b8',
    walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1' // Different wallet to avoid conflict
  },
  auction: {
    transactionHash: '0x61184d926e20e8dbda4bd41b8c5e4e384df7ba6298fbf939a534cd5ce6a3caf9',
    title: '1-on-1 Strategy Session',
    description: 'Exclusive meeting with expert',
    duration: 1000,
    reservePrice: 0.1,
    meetingDuration: 60,
    creatorWallet: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1' // Match the wallet address
  }
};

async function testCompleteFlow() {
  console.log('🚀 TESTING COMPLETE AUCTION CREATION FLOW\n');
  console.log('='.repeat(60));
  
  let authToken = null;
  
  try {
    // ==========================================
    // STEP 1: Test Para Auth API
    // ==========================================
    console.log('\n📝 STEP 1: Testing Para Auth API');
    console.log('─'.repeat(60));
    
    console.log('Request URL:', `${BASE_URL}/api/auth/para-auth`);
    console.log('Request Body:', JSON.stringify(TEST_DATA.paraAuth, null, 2));
    
    try {
      const authResponse = await axios.post(`${BASE_URL}/api/auth/para-auth`, TEST_DATA.paraAuth);
      
      console.log('\n✅ Para Auth Response:');
      console.log(JSON.stringify(authResponse.data, null, 2));
      
      if (authResponse.data.success && authResponse.data.token) {
        authToken = authResponse.data.token;
        console.log('\n🔑 Auth Token obtained:', authToken.substring(0, 50) + '...');
        
        // Verify session object
        if (authResponse.data.session) {
          console.log('\n📦 Session Object:');
          console.log('  - userId:', authResponse.data.session.userId);
          console.log('  - walletAddress:', authResponse.data.session.walletAddress);
          console.log('  - displayName:', authResponse.data.session.displayName);
          console.log('  - email:', authResponse.data.session.email);
        }
    } else {
        console.log('\n❌ Failed to get auth token from response');
        return;
      }
      
    } catch (error) {
      console.log('\n❌ Para Auth API Error:');
      if (error.response) {
        console.log('Status:', error.response.status);
        console.log('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
        console.log('Error:', error.message);
      }
      
      // For testing purposes, let's try to continue with a mock token
      console.log('\n⚠️  Attempting to continue with test user creation...');
      authToken = await createTestUserAndGetToken();
      if (!authToken) {
        console.log('❌ Could not obtain auth token. Stopping test.');
        return;
      }
    }
    
    // ==========================================
    // STEP 2: Test Auction Creation API
    // ==========================================
    console.log('\n\n📝 STEP 2: Testing Auction Creation API');
    console.log('─'.repeat(60));
    
    console.log('Request URL:', `${BASE_URL}/api/auctions/created`);
    console.log('Request Headers:', { Authorization: `Bearer ${authToken.substring(0, 20)}...` });
    console.log('Request Body:', JSON.stringify(TEST_DATA.auction, null, 2));
    
    try {
      const auctionResponse = await axios.post(
        `${BASE_URL}/api/auctions/created`,
        TEST_DATA.auction,
        {
      headers: {
            'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
        }
      );
      
      console.log('\n✅ Auction Creation Response:');
      console.log(JSON.stringify(auctionResponse.data, null, 2));
      
      if (auctionResponse.data.success) {
        console.log('\n🎉 SUCCESS! Auction created successfully!');
        console.log('Auction ID:', auctionResponse.data.auction?.id);
        console.log('Blockchain Auction ID:', auctionResponse.data.auction?.blockchain_auction_id);
      }
      
  } catch (error) {
      console.log('\n❌ Auction Creation API Error:');
      if (error.response) {
        console.log('Status:', error.response.status);
        console.log('Response:', JSON.stringify(error.response.data, null, 2));
        
        // Log more details for debugging
        if (error.response.data.message) {
          console.log('\n🔍 Error Details:', error.response.data.message);
        }
        if (error.response.data.details) {
          console.log('📋 Additional Details:', error.response.data.details);
        }
      } else {
        console.log('Error:', error.message);
        console.log('Stack:', error.stack);
      }
    }
    
  } catch (error) {
    console.log('\n❌ UNEXPECTED ERROR:', error.message);
    console.log(error.stack);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🏁 TEST COMPLETED\n');
}

/**
 * Create a test user directly in database and get token
 */
async function createTestUserAndGetToken() {
  try {
    const { pool } = require('./src/config/database');
    const jwt = require('jsonwebtoken');
    
    console.log('\n🔧 Creating test user in database...');
    
    const walletAddress = TEST_DATA.paraAuth.walletAddress.toLowerCase();
    const paraUserId = `test-user-${Date.now()}`;
    
    // Insert or update user
    const userQuery = `
      INSERT INTO users (para_user_id, wallet_address, email, auth_type, display_name, created_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      ON CONFLICT (wallet_address) DO UPDATE 
      SET para_user_id = $1, updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    
    const result = await pool.query(userQuery, [
      paraUserId,
      walletAddress,
      'test@example.com',
      'test',
      'Test User'
    ]);
    
    const user = result.rows[0];
    console.log('✅ Test user created/updated:', user.para_user_id);
    
    // Generate JWT token
    const token = jwt.sign({
      userId: user.id,
      paraUserId: user.para_user_id,
      authType: user.auth_type,
      email: user.email,
      displayName: user.display_name,
      walletAddress: user.wallet_address,
      role: 'para_user',
      hasWallet: true
    }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    console.log('✅ Token generated for test user');
    return token;
    
  } catch (error) {
    console.log('❌ Failed to create test user:', error.message);
    return null;
  }
}

// Run the test
testCompleteFlow().catch(console.error);
