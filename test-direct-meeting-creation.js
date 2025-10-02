const axios = require('axios');
const { ethers } = require('ethers');
const { Pool } = require('pg');
require('dotenv').config();

const API_URL = process.env.API_URL || 'http://localhost:5000/api';
const CONTRACT_ADDRESS = '0x6fD65aE833C9679cBC571581CE0f5Cd73D565796';
const RPC_URL = 'https://api.avax-test.network/ext/bc/C/rpc';

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'meeting_auction',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function testCompleteFlow() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 TESTING COMPLETE FLOW: AUCTION 15 → MEETING CREATION');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Step 1: Get auction 15 data from blockchain
    console.log('📦 STEP 1: Fetching Auction 15 from Blockchain');
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const MeetingAuctionABI = require('./src/contracts/MeetingAuction.json');
    const contract = new ethers.Contract(CONTRACT_ADDRESS, MeetingAuctionABI, provider);
    
    const auction = await contract.getAuction(15);
    console.log('   ✅ Auction 15 found on blockchain');
    console.log('   Host:', auction.host);
    console.log('   Bidder:', auction.highestBidder);
    console.log('   Bid Amount:', ethers.formatEther(auction.highestBid), 'AVAX');
    console.log('   Event Name:', auction.eventName);
    console.log('   Seller Name:', auction.sellerName);
    console.log('   NFT Token ID:', auction.nftTokenId.toString());
    console.log('   Ended:', auction.ended);

    // Step 2: Check if users exist in database
    console.log('\n👥 STEP 2: Checking Users in Database');
    const hostWallet = auction.host.toLowerCase();
    const bidderWallet = auction.highestBidder.toLowerCase();
    
    const usersResult = await pool.query(
      'SELECT * FROM users WHERE wallet_address IN ($1, $2)',
      [hostWallet, bidderWallet]
    );
    
    console.log('   Found', usersResult.rows.length, 'users in database');
    
    // Create users if they don't exist
    const jwt = require('jsonwebtoken');
    const jwtSecret = process.env.JWT_SECRET || 'test-secret-key-change-in-production';
    
    let hostUser, bidderUser;
    
    // Check/Create Host
    const hostExists = usersResult.rows.find(u => u.wallet_address === hostWallet);
    if (!hostExists) {
      console.log('   ⚠️  Host not found - creating...');
      const hostParaId = `test-host-${Date.now()}`;
      const hostResult = await pool.query(`
        INSERT INTO users (para_user_id, wallet_address, display_name, auth_type, created_at)
        VALUES ($1, $2, $3, 'externalWallet', CURRENT_TIMESTAMP)
        RETURNING *
      `, [hostParaId, hostWallet, auction.sellerName || 'Host User']);
      hostUser = hostResult.rows[0];
      console.log('   ✅ Host user created:', hostUser.display_name);
    } else {
      hostUser = hostExists;
      console.log('   ✅ Host user exists:', hostUser.display_name);
    }
    
    // Check/Create Bidder
    const bidderExists = usersResult.rows.find(u => u.wallet_address === bidderWallet);
    if (!bidderExists) {
      console.log('   ⚠️  Bidder not found - creating...');
      const bidderParaId = `test-bidder-${Date.now()}`;
      const bidderResult = await pool.query(`
        INSERT INTO users (para_user_id, wallet_address, display_name, auth_type, created_at)
        VALUES ($1, $2, $3, 'externalWallet', CURRENT_TIMESTAMP)
        RETURNING *
      `, [bidderParaId, bidderWallet, 'Bidder User']);
      bidderUser = bidderResult.rows[0];
      console.log('   ✅ Bidder user created:', bidderUser.display_name);
    } else {
      bidderUser = bidderExists;
      console.log('   ✅ Bidder user exists:', bidderUser.display_name);
    }
    
    // Step 3: Create auction record in database
    console.log('\n💾 STEP 3: Creating Auction Record in Database');
    const auctionExists = await pool.query('SELECT * FROM auctions WHERE id = $1', [15]);
    
    if (auctionExists.rows.length > 0) {
      console.log('   ⚠️  Auction 15 already exists in database');
    } else {
      await pool.query(`
        INSERT INTO auctions (
          id, contract_address, creator_para_id, creator_wallet,
          title, description, meeting_duration, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
      `, [
        15,
        CONTRACT_ADDRESS,
        hostUser.para_user_id,
        hostWallet,
        auction.eventName,
        'Test auction created from script',
        Number(auction.duration) || 60
      ]);
      console.log('   ✅ Auction 15 recorded in database');
    }
    
    // Step 4: End auction if not ended
    if (!auction.ended) {
      console.log('\n🏁 STEP 4: Auction is still active - needs to be ended first');
      console.log('   ⚠️  Skipping meeting creation (auction must end first)');
      console.log('   💡 Run the cron service or manually end the auction on blockchain');
      
      console.log('\n📝 SUMMARY:');
      console.log('   ✅ Auction exists on blockchain');
      console.log('   ✅ Users created/verified in database');
      console.log('   ✅ Auction recorded in database');
      console.log('   ⏳ Waiting for auction to end...');
      console.log('\n   Next: Once auction ends, cron will create meeting automatically');
      
      await pool.end();
      process.exit(0);
    }
    
    // Step 5: Simulate cron processing to create meeting
    console.log('\n🎬 STEP 5: Creating NFT-Gated Meeting');
    const { getAuctionCronService } = require('./src/services/AuctionCronService');
    
    const cronService = getAuctionCronService();
    await cronService.initialize();
    
    await cronService.processSingleAuction(15, auction);
    
    // Step 6: Check if meeting was created
    console.log('\n🔍 STEP 6: Verifying Meeting Creation');
    const meetingResult = await pool.query(
      'SELECT * FROM meetings WHERE auction_id = $1',
      [15]
    );
    
    if (meetingResult.rows.length === 0) {
      throw new Error('Meeting was not created!');
    }
    
    const meeting = meetingResult.rows[0];
    console.log('   ✅ Meeting created successfully!');
    console.log('   🚪 Room ID:', meeting.jitsi_room_id);
    console.log('   🔗 Room URL:', meeting.room_url);
    console.log('   🎫 Host Token:', meeting.creator_access_token ? 'Generated' : 'Missing');
    console.log('   🎫 Bidder Token:', meeting.bidder_access_token ? 'Generated' : 'Missing');
    
    const roomConfig = JSON.parse(meeting.jitsi_room_config);
    console.log('   🔐 NFT Gated:', roomConfig.gated);
    console.log('   📜 NFT Contract:', roomConfig.nftContract);
    console.log('   🎨 NFT Token ID:', roomConfig.nftTokenId);
    
    console.log('\n╔═══════════════════════════════════════════════╗');
    console.log('║     ✅ COMPLETE FLOW TEST SUCCESSFUL!         ║');
    console.log('╚═══════════════════════════════════════════════╝');
    
    console.log('\n📋 MEETING ACCESS DETAILS:');
    console.log('─────────────────────────────────────────────────');
    console.log('HOST (Creator):');
    console.log('  User:', hostUser.display_name);
    console.log('  Wallet:', hostUser.wallet_address);
    console.log('  Can join:', meeting.creator_access_token ? 'YES' : 'NO');
    console.log('\nBIDDER (Winner):');
    console.log('  User:', bidderUser.display_name);
    console.log('  Wallet:', bidderUser.wallet_address);
    console.log('  Can join:', meeting.bidder_access_token ? 'YES' : 'NO');
    console.log('─────────────────────────────────────────────────');
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
  
  process.exit(0);
}

testCompleteFlow();

