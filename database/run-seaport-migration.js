#!/usr/bin/env node

/**
 * Seaport Orderbook Migration Runner
 * 
 * This script applies the Seaport orderbook database migration.
 * It can be run in two modes:
 * - apply: Creates the new tables and indexes
 * - rollback: Removes all Seaport orderbook tables
 * 
 * Usage:
 *   node database/run-seaport-migration.js apply
 *   node database/run-seaport-migration.js rollback
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration
const dbConfig = process.env.DATABASE_URL ? {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
} : {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'meeting_auction',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  ssl: false
};

const pool = new Pool(dbConfig);

async function runMigration(mode = 'apply') {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Connecting to database...');
    
    // Determine which migration file to use
    const migrationFile = mode === 'rollback' 
      ? '002_rollback_seaport_orderbook.sql'
      : '002_add_seaport_orderbook.sql';
    
    const migrationPath = path.join(__dirname, migrationFile);
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }
    
    console.log(`📋 Reading migration file: ${migrationFile}`);
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log(`🚀 ${mode === 'rollback' ? 'Rolling back' : 'Applying'} migration...`);
    
    // Execute migration in a transaction
    await client.query('BEGIN');
    await client.query(migrationSQL);
    await client.query('COMMIT');
    
    console.log(`✅ Migration ${mode === 'rollback' ? 'rolled back' : 'applied'} successfully!`);
    
    // Show table summary
    if (mode === 'apply') {
      console.log('\n📊 Verifying tables...');
      const result = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name IN ('seaport_orders', 'order_fulfillments', 'order_cancellations', 'order_events')
          AND table_schema = 'public'
        ORDER BY table_name;
      `);
      
      console.log('\nCreated tables:');
      result.rows.forEach(row => {
        console.log(`  ✓ ${row.table_name}`);
      });
      
      // Show index count
      const indexResult = await client.query(`
        SELECT COUNT(*) as count
        FROM pg_indexes
        WHERE tablename IN ('seaport_orders', 'order_fulfillments', 'order_cancellations', 'order_events');
      `);
      
      console.log(`\n📈 Created ${indexResult.rows[0].count} indexes for query optimization`);
    }
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Parse command line arguments
const mode = process.argv[2] || 'apply';

if (!['apply', 'rollback'].includes(mode)) {
  console.error('❌ Invalid mode. Use "apply" or "rollback"');
  console.log('\nUsage:');
  console.log('  node database/run-seaport-migration.js apply');
  console.log('  node database/run-seaport-migration.js rollback');
  process.exit(1);
}

// Run migration
runMigration(mode)
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });
