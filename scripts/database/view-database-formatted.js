const { Pool } = require('pg');
require('dotenv').config();

// Database configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://entangle_user:entangle_secure_2024@209.38.123.139:5432/entangle_meetings',
  ssl: false,
  connectionTimeoutMillis: 10000
});

// Table formatting utilities
function formatTable(data, title, columns = null) {
  if (!data || data.length === 0) {
    console.log(`\n📋 ${title}:`);
    console.log('=' .repeat(80));
    console.log('⚠️  No data found');
    return;
  }

  console.log(`\n📋 ${title}:`);
  console.log('=' .repeat(80));
  
  if (columns) {
    // Create a formatted table with specific columns
    const colWidths = {};
    columns.forEach(col => {
      colWidths[col] = Math.max(col.length, ...data.map(row => String(row[col] || '').length));
    });

    // Print header
    let header = '|';
    columns.forEach(col => {
      header += ` ${col.padEnd(colWidths[col])} |`;
    });
    console.log(header);
    console.log('|' + columns.map(() => '-'.repeat(colWidths[col] + 2)).join('|') + '|');

    // Print rows
    data.forEach((row, index) => {
      let rowStr = '|';
      columns.forEach(col => {
        const value = String(row[col] || '');
        rowStr += ` ${value.padEnd(colWidths[col])} |`;
      });
      console.log(rowStr);
    });
  } else {
    // Simple list format
    data.forEach((row, index) => {
      console.log(`${index + 1}. ${JSON.stringify(row, null, 2)}`);
    });
  }
}

function formatSummaryTable(counts) {
  console.log('\n📊 DATABASE SUMMARY:');
  console.log('=' .repeat(80));
  
  const summaryData = [
    { Table: 'Users', Count: counts.users },
    { Table: 'Auctions', Count: counts.auctions },
    { Table: 'Meetings', Count: counts.meetings },
    { Table: 'Access Logs', Count: counts.accessLogs },
    { Table: 'Notifications', Count: counts.notifications },
    { Table: 'Para Sessions', Count: counts.paraSessions },
    { Table: 'Lit Gate Passes', Count: counts.litGatePasses }
  ];

  formatTable(summaryData, 'Database Overview', ['Table', 'Count']);
}

async function viewDatabase() {
  let client;
  try {
    console.log('🔍 Connecting to database...');
    client = await pool.connect();
    console.log('✅ Connected successfully!\n');

    // Get all table counts first
    const counts = await Promise.all([
      client.query('SELECT COUNT(*) as count FROM users'),
      client.query('SELECT COUNT(*) as count FROM auctions'),
      client.query('SELECT COUNT(*) as count FROM meetings'),
      client.query('SELECT COUNT(*) as count FROM meeting_access_logs'),
      client.query('SELECT COUNT(*) as count FROM notifications'),
      client.query('SELECT COUNT(*) as count FROM para_sessions'),
      client.query('SELECT COUNT(*) as count FROM lit_gate_passes')
    ]);

    const countData = {
      users: counts[0].rows[0].count,
      auctions: counts[1].rows[0].count,
      meetings: counts[2].rows[0].count,
      accessLogs: counts[3].rows[0].count,
      notifications: counts[4].rows[0].count,
      paraSessions: counts[5].rows[0].count,
      litGatePasses: counts[6].rows[0].count
    };

    // Show summary first
    formatSummaryTable(countData);

    // Users table
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
    
    formatTable(usersResult.rows, 'Recent Users', [
      'id', 'para_user_id', 'wallet_address', 'email', 'auth_type', 'display_name', 'created_at'
    ]);

    // Auctions table
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
      LIMIT 10
    `);
    
    formatTable(auctionsResult.rows, 'Recent Auctions', [
      'id', 'creator_para_id', 'creator_wallet', 'title', 'jitsi_room_id', 'auto_ended', 'created_at'
    ]);

    // Meetings table
    const meetingsResult = await client.query(`
      SELECT 
        id, 
        auction_id, 
        jitsi_room_id, 
        room_url,
        created_at 
      FROM meetings 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    formatTable(meetingsResult.rows, 'Recent Meetings', [
      'id', 'auction_id', 'jitsi_room_id', 'room_url', 'created_at'
    ]);

    // Meeting access logs
    const accessLogsResult = await client.query(`
      SELECT 
        id, 
        auction_id, 
        user_para_id, 
        wallet_address, 
        nft_token_id,
        access_method,
        accessed_at 
      FROM meeting_access_logs 
      ORDER BY accessed_at DESC 
      LIMIT 10
    `);
    
    formatTable(accessLogsResult.rows, 'Recent Access Logs', [
      'id', 'auction_id', 'user_para_id', 'wallet_address', 'nft_token_id', 'access_method', 'accessed_at'
    ]);

    // Notifications
    const notificationsResult = await client.query(`
      SELECT 
        id, 
        user_para_id, 
        wallet_address, 
        type, 
        title, 
        read,
        created_at 
      FROM notifications 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    formatTable(notificationsResult.rows, 'Recent Notifications', [
      'id', 'user_para_id', 'wallet_address', 'type', 'title', 'read', 'created_at'
    ]);

    // Para sessions
    const sessionsResult = await client.query(`
      SELECT 
        id, 
        para_user_id, 
        expires_at,
        created_at 
      FROM para_sessions 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    formatTable(sessionsResult.rows, 'Recent Para Sessions', [
      'id', 'para_user_id', 'expires_at', 'created_at'
    ]);

    // Lit gate passes
    const litGatePassesResult = await client.query(`
      SELECT 
        id, 
        nonce, 
        user_para_id, 
        wallet_address, 
        auction_id,
        used,
        expires_at,
        created_at 
      FROM lit_gate_passes 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    formatTable(litGatePassesResult.rows, 'Recent Lit Gate Passes', [
      'id', 'nonce', 'user_para_id', 'wallet_address', 'auction_id', 'used', 'expires_at', 'created_at'
    ]);

    console.log('\n✅ Database viewing complete!');
    console.log('\n💡 Tips:');
    console.log('   • Use this script to monitor your database health');
    console.log('   • Check for any missing or incomplete records');
    console.log('   • Monitor user activity and auction performance');

  } catch (error) {
    console.error('❌ Error viewing database:', error.message);
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

// Run the database viewer
viewDatabase();
