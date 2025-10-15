const { Pool } = require('pg');
require('dotenv').config();

// Database configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://entangle_user:entangle_secure_2024@209.38.123.139:5432/entangle_meetings',
  ssl: false,
  connectionTimeoutMillis: 10000
});

// Dashboard with comprehensive database analysis
async function databaseDashboard() {
  let client;
  try {
    console.log('🚀 ENTANGLE DATABASE DASHBOARD');
    console.log('=' .repeat(80));
    console.log('🔍 Connecting to database...');
    
    client = await pool.connect();
    console.log('✅ Connected successfully!\n');

    // 1. Database Overview
    console.log('📊 DATABASE OVERVIEW');
    console.log('=' .repeat(80));
    
    const counts = await Promise.all([
      client.query('SELECT COUNT(*) as count FROM users'),
      client.query('SELECT COUNT(*) as count FROM auctions'),
      client.query('SELECT COUNT(*) as count FROM meetings'),
      client.query('SELECT COUNT(*) as count FROM meeting_access_logs'),
      client.query('SELECT COUNT(*) as count FROM notifications'),
      client.query('SELECT COUNT(*) as count FROM para_sessions'),
      client.query('SELECT COUNT(*) as count FROM lit_gate_passes')
    ]);

    const overview = {
      users: counts[0].rows[0].count,
      auctions: counts[1].rows[0].count,
      meetings: counts[2].rows[0].count,
      accessLogs: counts[3].rows[0].count,
      notifications: counts[4].rows[0].count,
      paraSessions: counts[5].rows[0].count,
      litGatePasses: counts[6].rows[0].count
    };

    // Display overview in a nice format
    console.log('┌─────────────────┬─────────┐');
    console.log('│ Table           │ Count   │');
    console.log('├─────────────────┼─────────┤');
    console.log(`│ Users           │ ${overview.users.toString().padStart(7)} │`);
    console.log(`│ Auctions        │ ${overview.auctions.toString().padStart(7)} │`);
    console.log(`│ Meetings        │ ${overview.meetings.toString().padStart(7)} │`);
    console.log(`│ Access Logs     │ ${overview.accessLogs.toString().padStart(7)} │`);
    console.log(`│ Notifications   │ ${overview.notifications.toString().padStart(7)} │`);
    console.log(`│ Para Sessions   │ ${overview.paraSessions.toString().padStart(7)} │`);
    console.log(`│ Lit Gate Passes │ ${overview.litGatePasses.toString().padStart(7)} │`);
    console.log('└─────────────────┴─────────┘');

    // 2. Recent Activity
    console.log('\n🕒 RECENT ACTIVITY');
    console.log('=' .repeat(80));
    
    // Recent users
    const recentUsers = await client.query(`
      SELECT para_user_id, wallet_address, auth_type, created_at 
      FROM users 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    console.log('👥 Recent Users:');
    recentUsers.rows.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.para_user_id} (${user.auth_type}) - ${user.created_at}`);
    });

    // Recent auctions
    const recentAuctions = await client.query(`
      SELECT id, title, creator_para_id, auto_ended, created_at 
      FROM auctions 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    console.log('\n🎯 Recent Auctions:');
    recentAuctions.rows.forEach((auction, index) => {
      const status = auction.auto_ended ? '🔴 Ended' : '🟢 Active';
      console.log(`  ${index + 1}. #${auction.id} ${auction.title} ${status} - ${auction.created_at}`);
    });

    // 3. System Health Check
    console.log('\n🏥 SYSTEM HEALTH CHECK');
    console.log('=' .repeat(80));
    
    // Check for orphaned records
    const orphanedMeetings = await client.query(`
      SELECT COUNT(*) as count 
      FROM meetings m 
      LEFT JOIN auctions a ON m.auction_id = a.id 
      WHERE a.id IS NULL
    `);
    
    const orphanedAccessLogs = await client.query(`
      SELECT COUNT(*) as count 
      FROM meeting_access_logs mal 
      LEFT JOIN auctions a ON mal.auction_id = a.id 
      WHERE a.id IS NULL
    `);
    
    console.log(`🔍 Orphaned Meetings: ${orphanedMeetings.rows[0].count}`);
    console.log(`🔍 Orphaned Access Logs: ${orphanedAccessLogs.rows[0].count}`);
    
    // Check for expired sessions
    const expiredSessions = await client.query(`
      SELECT COUNT(*) as count 
      FROM para_sessions 
      WHERE expires_at < NOW()
    `);
    
    console.log(`⏰ Expired Para Sessions: ${expiredSessions.rows[0].count}`);
    
    // Check for unused lit gate passes
    const unusedGatePasses = await client.query(`
      SELECT COUNT(*) as count 
      FROM lit_gate_passes 
      WHERE used = false AND expires_at < NOW()
    `);
    
    console.log(`🎫 Expired Unused Gate Passes: ${unusedGatePasses.rows[0].count}`);

    // 4. User Analytics
    console.log('\n📈 USER ANALYTICS');
    console.log('=' .repeat(80));
    
    // Auth type distribution
    const authTypes = await client.query(`
      SELECT auth_type, COUNT(*) as count 
      FROM users 
      GROUP BY auth_type 
      ORDER BY count DESC
    `);
    
    console.log('🔐 Authentication Methods:');
    authTypes.rows.forEach(auth => {
      console.log(`  ${auth.auth_type}: ${auth.count} users`);
    });
    
    // Users with wallets
    const usersWithWallets = await client.query(`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE wallet_address IS NOT NULL
    `);
    
    console.log(`\n💰 Users with Wallets: ${usersWithWallets.rows[0].count}/${overview.users}`);

    // 5. Auction Analytics
    console.log('\n🎯 AUCTION ANALYTICS');
    console.log('=' .repeat(80));
    
    // Active vs ended auctions
    const activeAuctions = await client.query(`
      SELECT COUNT(*) as count 
      FROM auctions 
      WHERE auto_ended = false
    `);
    
    const endedAuctions = await client.query(`
      SELECT COUNT(*) as count 
      FROM auctions 
      WHERE auto_ended = true
    `);
    
    console.log(`🟢 Active Auctions: ${activeAuctions.rows[0].count}`);
    console.log(`🔴 Ended Auctions: ${endedAuctions.rows[0].count}`);
    
    // Auctions with meetings
    const auctionsWithMeetings = await client.query(`
      SELECT COUNT(DISTINCT a.id) as count 
      FROM auctions a 
      INNER JOIN meetings m ON a.id = m.auction_id
    `);
    
    console.log(`📹 Auctions with Meetings: ${auctionsWithMeetings.rows[0].count}`);

    // 6. Performance Metrics
    console.log('\n⚡ PERFORMANCE METRICS');
    console.log('=' .repeat(80));
    
    // Average meeting duration (if we have that data)
    const avgMeetingDuration = await client.query(`
      SELECT AVG(meeting_duration) as avg_duration 
      FROM auctions 
      WHERE meeting_duration IS NOT NULL
    `);
    
    console.log(`⏱️  Average Meeting Duration: ${Math.round(avgMeetingDuration.rows[0].avg_duration || 0)} minutes`);
    
    // Most active users
    const mostActiveUsers = await client.query(`
      SELECT creator_para_id, COUNT(*) as auction_count 
      FROM auctions 
      GROUP BY creator_para_id 
      ORDER BY auction_count DESC 
      LIMIT 3
    `);
    
    console.log('\n🏆 Most Active Users:');
    mostActiveUsers.rows.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.creator_para_id}: ${user.auction_count} auctions`);
    });

    console.log('\n✅ Database dashboard complete!');
    console.log('\n💡 Recommendations:');
    console.log('   • Monitor orphaned records and clean them up');
    console.log('   • Check expired sessions and remove them');
    console.log('   • Monitor user engagement and auction success rates');
    console.log('   • Consider archiving old data to improve performance');

  } catch (error) {
    console.error('❌ Error generating dashboard:', error.message);
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

// Run the dashboard
databaseDashboard();
