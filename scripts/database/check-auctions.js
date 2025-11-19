const { Pool } = require('pg');
require('dotenv').config();

// Database configuration
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'meeting_auction',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function checkAuctions() {
  try {
    console.log('🔍 Checking auctions in database...');
    
    // Check all auctions
    const auctionsQuery = 'SELECT * FROM auctions ORDER BY id DESC LIMIT 10';
    const auctionsResult = await pool.query(auctionsQuery);
    
    console.log('📋 Recent auctions:');
    auctionsResult.rows.forEach(auction => {
      console.log(`  Auction ${auction.id}: ${auction.title} - ${auction.creator_wallet} - Auto ended: ${auction.auto_ended}`);
    });
    
    // Check meetings
    const meetingsQuery = 'SELECT * FROM meetings ORDER BY id DESC LIMIT 5';
    const meetingsResult = await pool.query(meetingsQuery);
    
    console.log('📋 Recent meetings:');
    meetingsResult.rows.forEach(meeting => {
      console.log(`  Meeting ${meeting.id}: Auction ${meeting.auction_id} - Room: ${meeting.jitsi_room_id}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking auctions:', error);
  } finally {
    await pool.end();
  }
}

// Run the check
checkAuctions();


