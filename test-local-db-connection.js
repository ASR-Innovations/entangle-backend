#!/usr/bin/env node

/**
 * Test local database connection
 */

require('dotenv').config();
const { pool } = require('./src/config/database');

async function testConnection() {
  console.log('🧪 TESTING LOCAL DATABASE CONNECTION');
  console.log('='.repeat(60));
  console.log('');
  
  try {
    console.log('📡 Connecting to database...');
    console.log(`Database URL: ${process.env.DATABASE_URL}`);
    console.log('');
    
    // Test connection
    const client = await pool.connect();
    console.log('✅ Connection successful!');
    client.release();
    console.log('');
    
    // Test query
    console.log('📊 Testing queries...');
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN ended = FALSE THEN 1 END) as active,
        COUNT(CASE WHEN ended = TRUE THEN 1 END) as ended
      FROM auctions
    `);
    
    const stats = result.rows[0];
    console.log(`Total auctions: ${stats.total}`);
    console.log(`Active auctions: ${stats.active}`);
    console.log(`Ended auctions: ${stats.ended}`);
    console.log('');
    
    // Test specific auctions
    console.log('🔍 Checking specific auctions...');
    const auctions = await pool.query(`
      SELECT id, seller_name, highest_bid, ended 
      FROM auctions 
      WHERE id IN (96, 98, 99)
      ORDER BY id
    `);
    
    auctions.rows.forEach(auction => {
      console.log(`  Auction ${auction.id}: ${auction.seller_name} - ${auction.ended ? 'Ended' : 'Active'}`);
    });
    console.log('');
    
    console.log('✅ All tests passed!');
    console.log('🎉 Local database is working perfectly!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

testConnection().catch(console.error);
