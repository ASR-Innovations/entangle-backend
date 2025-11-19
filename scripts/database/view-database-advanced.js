const { Pool } = require('pg');
require('dotenv').config();

// Database configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://entangle_user:entangle_secure_2024@209.38.123.139:5432/entangle_meetings',
  ssl: false,
  connectionTimeoutMillis: 10000
});

// Advanced table formatting with colors and better layout
function formatAdvancedTable(data, title, columns = null, options = {}) {
  if (!data || data.length === 0) {
    console.log(`\n📋 ${title}:`);
    console.log('=' .repeat(80));
    console.log('⚠️  No data found');
    return;
  }

  console.log(`\n📋 ${title}:`);
  console.log('=' .repeat(80));
  
  if (columns) {
    // Calculate column widths
    const colWidths = {};
    const maxWidth = options.maxWidth || 50;
    
    columns.forEach(col => {
      const maxContentLength = Math.max(
        col.length,
        ...data.map(row => String(row[col] || '').length)
      );
      colWidths[col] = Math.min(maxContentLength, maxWidth);
    });

    // Print header with styling
    let header = '│';
    columns.forEach(col => {
      const padded = col.padEnd(colWidths[col]);
      header += ` ${padded} │`;
    });
    console.log(header);
    
    // Print separator
    let separator = '├';
    columns.forEach((col, index) => {
      separator += '─'.repeat(colWidths[col] + 2);
      if (index < columns.length - 1) separator += '┼';
    });
    separator += '┤';
    console.log(separator);

    // Print rows
    data.forEach((row, index) => {
      let rowStr = '│';
      columns.forEach(col => {
        let value = String(row[col] || '');
        if (value.length > maxWidth) {
          value = value.substring(0, maxWidth - 3) + '...';
        }
        const padded = value.padEnd(colWidths[col]);
        rowStr += ` ${padded} │`;
      });
      console.log(rowStr);
    });

    // Print footer
    let footer = '└';
    columns.forEach((col, index) => {
      footer += '─'.repeat(colWidths[col] + 2);
      if (index < columns.length - 1) footer += '┴';
    });
    footer += '┘';
    console.log(footer);
  } else {
    // Simple list format
    data.forEach((row, index) => {
      console.log(`${index + 1}. ${JSON.stringify(row, null, 2)}`);
    });
  }
}

function formatSummaryCards(counts) {
  console.log('\n📊 DATABASE OVERVIEW:');
  console.log('=' .repeat(80));
  
  const cards = [
    { icon: '👥', label: 'Users', count: counts.users, color: 'blue' },
    { icon: '🎯', label: 'Auctions', count: counts.auctions, color: 'green' },
    { icon: '📹', label: 'Meetings', count: counts.meetings, color: 'yellow' },
    { icon: '🔐', label: 'Access Logs', count: counts.accessLogs, color: 'cyan' },
    { icon: '🔔', label: 'Notifications', count: counts.notifications, color: 'magenta' },
    { icon: '🔑', label: 'Para Sessions', count: counts.paraSessions, color: 'red' },
    { icon: '🎫', label: 'Lit Gate Passes', count: counts.litGatePasses, color: 'white' }
  ];

  // Display in a grid format
  cards.forEach(card => {
    const countStr = card.count.toString().padStart(6);
    console.log(`${card.icon} ${card.label.padEnd(15)}: ${countStr}`);
  });
}

async function viewDatabaseAdvanced() {
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

    // Show summary cards
    formatSummaryCards(countData);

    // Users table with better formatting
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
      LIMIT 8
    `);
    
    formatAdvancedTable(usersResult.rows, 'Recent Users', [
      'id', 'para_user_id', 'wallet_address', 'email', 'auth_type', 'display_name'
    ], { maxWidth: 20 });

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
      LIMIT 8
    `);
    
    formatAdvancedTable(auctionsResult.rows, 'Recent Auctions', [
      'id', 'creator_para_id', 'creator_wallet', 'title', 'jitsi_room_id', 'auto_ended'
    ], { maxWidth: 25 });

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
      LIMIT 8
    `);
    
    formatAdvancedTable(meetingsResult.rows, 'Recent Meetings', [
      'id', 'auction_id', 'jitsi_room_id', 'room_url'
    ], { maxWidth: 30 });

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
      LIMIT 8
    `);
    
    formatAdvancedTable(accessLogsResult.rows, 'Recent Access Logs', [
      'id', 'auction_id', 'user_para_id', 'wallet_address', 'nft_token_id', 'access_method'
    ], { maxWidth: 20 });

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
      LIMIT 8
    `);
    
    formatAdvancedTable(notificationsResult.rows, 'Recent Notifications', [
      'id', 'user_para_id', 'wallet_address', 'type', 'title', 'read'
    ], { maxWidth: 25 });

    // Para sessions
    const sessionsResult = await client.query(`
      SELECT 
        id, 
        para_user_id, 
        expires_at,
        created_at 
      FROM para_sessions 
      ORDER BY created_at DESC 
      LIMIT 8
    `);
    
    formatAdvancedTable(sessionsResult.rows, 'Recent Para Sessions', [
      'id', 'para_user_id', 'expires_at'
    ], { maxWidth: 30 });

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
      LIMIT 8
    `);
    
    formatAdvancedTable(litGatePassesResult.rows, 'Recent Lit Gate Passes', [
      'id', 'nonce', 'user_para_id', 'wallet_address', 'auction_id', 'used'
    ], { maxWidth: 20 });

    console.log('\n✅ Database viewing complete!');
    console.log('\n💡 Tips:');
    console.log('   • Use this script to monitor your database health');
    console.log('   • Check for any missing or incomplete records');
    console.log('   • Monitor user activity and auction performance');
    console.log('   • Look for patterns in access logs and notifications');

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

// Run the advanced database viewer
viewDatabaseAdvanced();
