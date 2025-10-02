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

async function fixWalletCase() {
  try {
    console.log('🔧 Fixing wallet address case...');
    
    // Update the user record to have lowercase wallet address
    const updateQuery = `
      UPDATE users 
      SET wallet_address = LOWER(wallet_address), updated_at = CURRENT_TIMESTAMP
      WHERE para_user_id = $1
    `;
    
    const paraUserId = 'email_cm9oaXQucmFqc3Vy';
    
    const result = await pool.query(updateQuery, [paraUserId]);
    
    if (result.rowCount > 0) {
      console.log('✅ User wallet address case updated successfully');
    } else {
      console.log('❌ No user found to update');
    }
    
    // Verify the update
    const verifyQuery = 'SELECT * FROM users WHERE para_user_id = $1';
    const verifyResult = await pool.query(verifyQuery, [paraUserId]);
    
    if (verifyResult.rows.length > 0) {
      console.log('📋 User record:', verifyResult.rows[0]);
    }
    
  } catch (error) {
    console.error('❌ Error fixing wallet case:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix
fixWalletCase();


