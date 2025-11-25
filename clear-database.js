#!/usr/bin/env node

/**
 * Clear Local Database Script
 * 
 * This script deletes all data from your local PostgreSQL database
 * while keeping the table structure intact.
 * 
 * This is useful when migrating networks (e.g., Ethereum Sepolia to Arbitrum Sepolia)
 * to remove old blockchain data.
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false // Local database doesn't need SSL
});

async function clearDatabase() {
  console.log('🗑️  Starting database cleanup...\n');
  
  try {
    // Test connection
    const client = await pool.connect();
    console.log('✅ Connected to database\n');
    
    // Get current counts before deletion
    console.log('📊 Current data counts:');
    const beforeCounts = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM auctions) as auctions,
        (SELECT COUNT(*) FROM users) as users,
        (SELECT COUNT(*) FROM meetings) as meetings,
        (SELECT COUNT(*) FROM bids) as bids,
        (SELECT COUNT(*) FROM orders) as orders
    `);
    
    console.log(`   - Auctions: ${beforeCounts.rows[0].auctions}`);
    console.log(`   - Users: ${beforeCounts.rows[0].users}`);
    console.log(`   - Meetings: ${beforeCounts.rows[0].meetings}`);
    console.log(`   - Bids: ${beforeCounts.rows[0].bids}`);
    console.log(`   - Orders: ${beforeCounts.rows[0].orders}`);
    console.log('');
    
    // Ask for confirmation
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise(resolve => {
      readline.question('⚠️  Are you sure you want to delete ALL data? (yes/no): ', resolve);
    });
    
    readline.close();
    
    if (answer.toLowerCase() !== 'yes') {
      console.log('\n❌ Operation cancelled');
      client.release();
      await pool.end();
      process.exit(0);
    }
    
    console.log('\n🗑️  Deleting all data...\n');
    
    // Delete data from all tables (in correct order due to foreign keys)
    await client.query('BEGIN');
    
    try {
      // Delete in order to respect foreign key constraints
      await client.query('DELETE FROM bids');
      console.log('✅ Cleared bids table');
      
      await client.query('DELETE FROM meetings');
      console.log('✅ Cleared meetings table');
      
      await client.query('DELETE FROM orders');
      console.log('✅ Cleared orders table');
      
      await client.query('DELETE FROM auctions');
      console.log('✅ Cleared auctions table');
      
      await client.query('DELETE FROM users');
      console.log('✅ Cleared users table');
      
      // Reset sequences (auto-increment counters)
      await client.query('ALTER SEQUENCE IF EXISTS auctions_id_seq RESTART WITH 1');
      await client.query('ALTER SEQUENCE IF EXISTS users_id_seq RESTART WITH 1');
      await client.query('ALTER SEQUENCE IF EXISTS meetings_id_seq RESTART WITH 1');
      await client.query('ALTER SEQUENCE IF EXISTS bids_id_seq RESTART WITH 1');
      await client.query('ALTER SEQUENCE IF EXISTS orders_id_seq RESTART WITH 1');
      console.log('✅ Reset auto-increment sequences');
      
      await client.query('COMMIT');
      console.log('\n✅ Transaction committed successfully');
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('\n❌ Error during deletion, rolled back:', error.message);
      throw error;
    }
    
    // Verify deletion
    console.log('\n📊 Final data counts:');
    const afterCounts = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM auctions) as auctions,
        (SELECT COUNT(*) FROM users) as users,
        (SELECT COUNT(*) FROM meetings) as meetings,
        (SELECT COUNT(*) FROM bids) as bids,
        (SELECT COUNT(*) FROM orders) as orders
    `);
    
    console.log(`   - Auctions: ${afterCounts.rows[0].auctions}`);
    console.log(`   - Users: ${afterCounts.rows[0].users}`);
    console.log(`   - Meetings: ${afterCounts.rows[0].meetings}`);
    console.log(`   - Bids: ${afterCounts.rows[0].bids}`);
    console.log(`   - Orders: ${afterCounts.rows[0].orders}`);
    
    console.log('\n✨ Database cleared successfully!');
    console.log('📋 Table structure preserved - ready for Arbitrum Sepolia data\n');
    
    client.release();
    
  } catch (error) {
    console.error('\n❌ Failed to clear database:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Make sure PostgreSQL is running:');
      console.error('   - Check if PostgreSQL service is started');
      console.error('   - Verify DATABASE_URL in .env is correct');
    }
    
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the script
clearDatabase();
