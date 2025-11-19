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

async function checkWallet() {
  try {
    console.log('🔍 Checking wallet addresses in database...');
    
    // Check users table
    const usersQuery = 'SELECT id, para_user_id, wallet_address FROM users WHERE para_user_id = $1';
    const usersResult = await pool.query(usersQuery, ['email_cm9oaXQucmFqc3Vy']);
    
    if (usersResult.rows.length > 0) {
      console.log('👤 User record:', usersResult.rows[0]);
      console.log('📍 Wallet address:', usersResult.rows[0].wallet_address);
      console.log('📍 Wallet length:', usersResult.rows[0].wallet_address?.length);
    } else {
      console.log('❌ No user found');
    }
    
    // Check if there are any auctions
    const auctionsQuery = 'SELECT id, creator_wallet FROM auctions ORDER BY id DESC LIMIT 5';
    const auctionsResult = await pool.query(auctionsQuery);
    
    console.log('📋 Recent auctions:');
    auctionsResult.rows.forEach(auction => {
      console.log(`  Auction ${auction.id}: ${auction.creator_wallet}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking wallet:', error);
  } finally {
    await pool.end();
  }
}

// Run the check
checkWallet();


