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

async function fixAuctionContract() {
  try {
    console.log('🔧 Fixing auction contract address...');
    
    // Update the auction record to use the correct contract address
    const updateQuery = `
      UPDATE auctions 
      SET contract_address = $1
      WHERE id = $2
    `;
    
    const newContractAddress = '0x6fD65aE833C9679cBC571581CE0f5Cd73D565796';
    const auctionId = 1;
    
    const result = await pool.query(updateQuery, [newContractAddress, auctionId]);
    
    if (result.rowCount > 0) {
      console.log('✅ Auction contract address updated successfully');
      console.log(`📍 New contract: ${newContractAddress}`);
    } else {
      console.log('❌ No auction found to update');
    }
    
    // Verify the update
    const verifyQuery = 'SELECT * FROM auctions WHERE id = $1';
    const verifyResult = await pool.query(verifyQuery, [auctionId]);
    
    if (verifyResult.rows.length > 0) {
      console.log('📋 Auction record:', verifyResult.rows[0]);
    }
    
  } catch (error) {
    console.error('❌ Error fixing auction contract:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix
fixAuctionContract();
