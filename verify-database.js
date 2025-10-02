const { Pool } = require('pg');
require('dotenv').config();

// Use the remote database URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://entangle_user:entangle_secure_2024@209.38.123.139:5432/entangle_meetings',
  ssl: false,
  connectionTimeoutMillis: 10000
});

async function verifyDatabase() {
  let client;
  try {
    console.log('🔍 Connecting to database...');
    client = await pool.connect();
    console.log('✅ Connected successfully!\n');

    // Check users table
    console.log('👥 USERS TABLE:');
    console.log('=' .repeat(80));
    const usersResult = await client.query(`
      SELECT 
        id, 
        para_user_id, 
        wallet_address, 
        email, 
        auth_type, 
        display_name,
        created_at 
      FROM users 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    if (usersResult.rows.length === 0) {
      console.log('⚠️  No users found in database');
    } else {
      console.log(`Found ${usersResult.rows.length} users:\n`);
      usersResult.rows.forEach((user, index) => {
        console.log(`User ${index + 1}:`);
        console.log(`  ID: ${user.id}`);
        console.log(`  Para User ID: ${user.para_user_id}`);
        console.log(`  Wallet: ${user.wallet_address || 'Not connected'}`);
        console.log(`  Email: ${user.email || 'N/A'}`);
        console.log(`  Display Name: ${user.display_name || 'N/A'}`);
        console.log(`  Auth Type: ${user.auth_type || 'N/A'}`);
        console.log(`  Created: ${user.created_at}`);
        console.log('');
      });
    }

    // Check auctions table
    console.log('\n🎯 AUCTIONS TABLE:');
    console.log('=' .repeat(80));
    const auctionsResult = await client.query(`
      SELECT 
        id, 
        creator_para_id, 
        creator_wallet, 
        title, 
        jitsi_room_id,
        auto_ended,
        created_at 
      FROM auctions 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    if (auctionsResult.rows.length === 0) {
      console.log('⚠️  No auctions found in database');
    } else {
      console.log(`Found ${auctionsResult.rows.length} auctions:\n`);
      auctionsResult.rows.forEach((auction, index) => {
        console.log(`Auction ${index + 1}:`);
        console.log(`  ID: ${auction.id}`);
        console.log(`  Title: ${auction.title || 'N/A'}`);
        console.log(`  Creator Para ID: ${auction.creator_para_id}`);
        console.log(`  Creator Wallet: ${auction.creator_wallet}`);
        console.log(`  Jitsi Room: ${auction.jitsi_room_id || 'Not created'}`);
        console.log(`  Auto Ended: ${auction.auto_ended}`);
        console.log(`  Created: ${auction.created_at}`);
        console.log('');
      });
    }

    // Check meetings table
    console.log('\n📹 MEETINGS TABLE:');
    console.log('=' .repeat(80));
    const meetingsResult = await client.query(`
      SELECT 
        id, 
        auction_id, 
        jitsi_room_id, 
        room_url,
        created_at 
      FROM meetings 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    if (meetingsResult.rows.length === 0) {
      console.log('⚠️  No meetings found in database');
    } else {
      console.log(`Found ${meetingsResult.rows.length} meetings:\n`);
      meetingsResult.rows.forEach((meeting, index) => {
        console.log(`Meeting ${index + 1}:`);
        console.log(`  ID: ${meeting.id}`);
        console.log(`  Auction ID: ${meeting.auction_id}`);
        console.log(`  Jitsi Room: ${meeting.jitsi_room_id}`);
        console.log(`  Room URL: ${meeting.room_url}`);
        console.log(`  Created: ${meeting.created_at}`);
        console.log('');
      });
    }

    // Check para_sessions table
    console.log('\n🔑 PARA SESSIONS TABLE:');
    console.log('=' .repeat(80));
    const sessionsResult = await client.query(`
      SELECT 
        id, 
        para_user_id, 
        expires_at,
        created_at 
      FROM para_sessions 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    if (sessionsResult.rows.length === 0) {
      console.log('⚠️  No Para sessions found in database');
    } else {
      console.log(`Found ${sessionsResult.rows.length} sessions:\n`);
      sessionsResult.rows.forEach((session, index) => {
        console.log(`Session ${index + 1}:`);
        console.log(`  Para User ID: ${session.para_user_id}`);
        console.log(`  Expires: ${session.expires_at}`);
        console.log(`  Created: ${session.created_at}`);
        console.log('');
      });
    }

    // Get table counts
    console.log('\n📊 DATABASE SUMMARY:');
    console.log('=' .repeat(80));
    const counts = await Promise.all([
      client.query('SELECT COUNT(*) FROM users'),
      client.query('SELECT COUNT(*) FROM auctions'),
      client.query('SELECT COUNT(*) FROM meetings'),
      client.query('SELECT COUNT(*) FROM meeting_access_logs'),
      client.query('SELECT COUNT(*) FROM notifications'),
      client.query('SELECT COUNT(*) FROM para_sessions')
    ]);

    console.log(`Total Users: ${counts[0].rows[0].count}`);
    console.log(`Total Auctions: ${counts[1].rows[0].count}`);
    console.log(`Total Meetings: ${counts[2].rows[0].count}`);
    console.log(`Total Access Logs: ${counts[3].rows[0].count}`);
    console.log(`Total Notifications: ${counts[4].rows[0].count}`);
    console.log(`Total Para Sessions: ${counts[5].rows[0].count}`);

    console.log('\n✅ Database verification complete!');

  } catch (error) {
    console.error('❌ Error verifying database:', error.message);
    if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
      console.log('\n⚠️  Database connection timed out.');
      console.log('💡 This script needs to be run on the server (209.38.123.139) not locally.');
      console.log('💡 You can upload this script to the server and run it there.');
    }
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

verifyDatabase();

