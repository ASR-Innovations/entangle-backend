const axios = require('axios');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const API_URL = process.env.API_URL || 'http://localhost:5009/api';

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'meeting_auction',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function testCreateDirectMeeting() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 TESTING /meetings/create-direct API');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Step 1: Get or create test users
    console.log('📋 STEP 1: Setting up test users...');
    
    const jwtSecret = process.env.JWT_SECRET || 'test-secret-key-change-in-production';
    
    // Create host user
    let hostUser = await pool.query('SELECT * FROM users WHERE id = 1');
    if (hostUser.rows.length === 0) {
      const hostResult = await pool.query(`
        INSERT INTO users (para_user_id, wallet_address, display_name, email, auth_type)
        VALUES ($1, $2, $3, $4, 'externalWallet')
        RETURNING *
      `, ['test-host-direct', '0x1111111111111111111111111111111111111111', 'Test Host', 'host@test.com']);
      hostUser = hostResult;
    }
    
    const host = hostUser.rows[0];
    console.log('   ✅ Host User:', host.display_name, '-', host.wallet_address);
    
    // Create guest user
    let guestUser = await pool.query('SELECT * FROM users WHERE id = 2');
    if (guestUser.rows.length === 0) {
      const guestResult = await pool.query(`
        INSERT INTO users (para_user_id, wallet_address, display_name, email, auth_type)
        VALUES ($1, $2, $3, $4, 'externalWallet')
        RETURNING *
      `, ['test-guest-direct', '0x2222222222222222222222222222222222222222', 'Test Guest', 'guest@test.com']);
      guestUser = guestResult;
    }
    
    const guest = guestUser.rows[0];
    console.log('   ✅ Guest User:', guest.display_name, '-', guest.wallet_address);
    
    // Step 2: Generate JWT token for host
    console.log('\n🔐 STEP 2: Generating JWT token for host...');
    const token = jwt.sign(
      {
        userId: host.id,
        paraUserId: host.para_user_id,
        walletAddress: host.wallet_address,
        displayName: host.display_name,
        email: host.email,
        role: 'para_user',
        hasWallet: true
      },
      jwtSecret,
      { expiresIn: '24h' }
    );
    console.log('   ✅ JWT token generated');
    
    // Step 3: Call /create-direct API
    console.log('\n🎬 STEP 3: Calling /meetings/create-direct API...');
    console.log('   URL:', `${API_URL}/meetings/create-direct`);
    console.log('   Host:', host.id, '-', host.display_name);
    console.log('   Guest:', guest.id, '-', guest.display_name);
    
    const requestBody = {
      guestUserId: guest.id,
      meetingName: 'Direct Test Meeting',
      duration: 60
    };
    
    console.log('   Request body:', JSON.stringify(requestBody, null, 2));
    
    const response = await axios.post(
      `${API_URL}/meetings/create-direct`,
      requestBody,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('\n✅ API Response Status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    
    // Step 4: Verify meeting in database
    console.log('\n📊 STEP 4: Verifying meeting in database...');
    const meeting = response.data.meeting;
    
    const dbMeeting = await pool.query(
      'SELECT * FROM meetings WHERE id = $1',
      [meeting.id]
    );
    
    if (dbMeeting.rows.length > 0) {
      const m = dbMeeting.rows[0];
      console.log('   ✅ Meeting found in database!');
      console.log('   🚪 Room ID:', m.jitsi_room_id);
      console.log('   🔗 Room URL:', m.room_url);
      console.log('   👤 Host token:', m.creator_access_token ? 'EXISTS' : 'MISSING');
      console.log('   👥 Guest token:', m.bidder_access_token ? 'EXISTS' : 'MISSING');
      
      const config = JSON.parse(m.jitsi_room_config);
      console.log('   🔐 NFT Gated:', config.gated);
    } else {
      console.log('   ❌ Meeting NOT found in database!');
    }
    
    console.log('\n╔═══════════════════════════════════════════════╗');
    console.log('║   ✅ CREATE-DIRECT API TEST SUCCESSFUL!      ║');
    console.log('╚═══════════════════════════════════════════════╝');
    
    console.log('\n🎉 Both host and guest can now join the meeting!');
    console.log('   Host URL:', meeting.hostUrl || meeting.url);
    console.log('   Guest URL:', response.data.participants?.find(p => p.userId === guest.id)?.accessUrl || 'Check response');
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:');
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('   Error:', error.message);
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
  
  process.exit(0);
}

testCreateDirectMeeting();

