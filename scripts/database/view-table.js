const { Pool } = require('pg');
require('dotenv').config();

// Database configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://entangle_user:entangle_secure_2024@209.38.123.139:5432/entangle_meetings',
  ssl: false,
  connectionTimeoutMillis: 10000
});

// Simple table viewer for any specific table
async function viewTable(tableName, limit = 10, orderBy = 'id') {
  let client;
  try {
    console.log(`🔍 Viewing table: ${tableName}`);
    client = await pool.connect();
    
    // Get table structure first
    const structureQuery = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = $1 
      ORDER BY ordinal_position
    `;
    
    const structureResult = await client.query(structureQuery, [tableName]);
    
    console.log(`\n📋 Table Structure: ${tableName}`);
    console.log('=' .repeat(80));
    
    if (structureResult.rows.length === 0) {
      console.log('❌ Table not found or no columns found');
      return;
    }
    
    // Display table structure
    structureResult.rows.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
      console.log(`  ${col.column_name.padEnd(20)} ${col.data_type.padEnd(15)} ${nullable}${defaultVal}`);
    });
    
    // Get table data
    const dataQuery = `SELECT * FROM ${tableName} ORDER BY ${orderBy} DESC LIMIT $1`;
    const dataResult = await client.query(dataQuery, [limit]);
    
    console.log(`\n📊 Table Data (${dataResult.rows.length} rows):`);
    console.log('=' .repeat(80));
    
    if (dataResult.rows.length === 0) {
      console.log('⚠️  No data found in table');
      return;
    }
    
    // Get column names
    const columns = Object.keys(dataResult.rows[0]);
    
    // Calculate column widths
    const colWidths = {};
    columns.forEach(col => {
      const maxContentLength = Math.max(
        col.length,
        ...dataResult.rows.map(row => String(row[col] || '').length)
      );
      colWidths[col] = Math.min(maxContentLength, 30); // Max width of 30
    });

    // Print header
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
    dataResult.rows.forEach((row, index) => {
      let rowStr = '│';
      columns.forEach(col => {
        let value = String(row[col] || '');
        if (value.length > 30) {
          value = value.substring(0, 27) + '...';
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
    
    console.log(`\n✅ Table ${tableName} displayed successfully!`);
    
  } catch (error) {
    console.error('❌ Error viewing table:', error.message);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Get command line arguments
const args = process.argv.slice(2);
const tableName = args[0] || 'users';
const limit = parseInt(args[1]) || 10;
const orderBy = args[2] || 'id';

// Show usage if no arguments
if (args.length === 0) {
  console.log('📋 Database Table Viewer');
  console.log('=' .repeat(50));
  console.log('Usage: node view-table.js <table_name> [limit] [order_by]');
  console.log('');
  console.log('Examples:');
  console.log('  node view-table.js users 5');
  console.log('  node view-table.js auctions 10 created_at');
  console.log('  node view-table.js meetings 20');
  console.log('');
  console.log('Available tables:');
  console.log('  - users');
  console.log('  - auctions');
  console.log('  - meetings');
  console.log('  - meeting_access_logs');
  console.log('  - notifications');
  console.log('  - para_sessions');
  console.log('  - lit_gate_passes');
  console.log('');
}

// Run the table viewer
if (args.length > 0) {
  viewTable(tableName, limit, orderBy);
}
