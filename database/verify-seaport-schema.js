#!/usr/bin/env node

/**
 * Verification script for Seaport Orderbook schema
 * Checks that all tables, indexes, and constraints are properly created
 */

require('dotenv').config();
const { Pool } = require('pg');

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

async function verifySchema() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Verifying Seaport Orderbook Schema\n');
    
    // 1. Check tables exist
    console.log('📋 Checking tables...');
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name IN ('seaport_orders', 'order_fulfillments', 'order_cancellations', 'order_events')
        AND table_schema = 'public'
      ORDER BY table_name;
    `);
    
    const expectedTables = ['order_cancellations', 'order_events', 'order_fulfillments', 'seaport_orders'];
    const foundTables = tablesResult.rows.map(r => r.table_name);
    
    expectedTables.forEach(table => {
      if (foundTables.includes(table)) {
        console.log(`  ✓ ${table}`);
      } else {
        console.log(`  ✗ ${table} - MISSING!`);
      }
    });
    
    // 2. Check seaport_orders columns
    console.log('\n📊 Checking seaport_orders columns...');
    const columnsResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'seaport_orders'
      ORDER BY ordinal_position;
    `);
    
    const criticalColumns = [
      'order_hash', 'order_type', 'nft_contract', 'token_id', 'maker', 
      'price', 'order_components', 'signature', 'is_active', 'expires_at'
    ];
    
    const foundColumns = columnsResult.rows.map(r => r.column_name);
    criticalColumns.forEach(col => {
      if (foundColumns.includes(col)) {
        console.log(`  ✓ ${col}`);
      } else {
        console.log(`  ✗ ${col} - MISSING!`);
      }
    });
    
    // 3. Check foreign key constraints
    console.log('\n🔗 Checking foreign key constraints...');
    const fkResult = await client.query(`
      SELECT
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name IN ('seaport_orders', 'order_fulfillments', 'order_cancellations')
      ORDER BY tc.table_name;
    `);
    
    if (fkResult.rows.length > 0) {
      fkResult.rows.forEach(row => {
        console.log(`  ✓ ${row.table_name}.${row.column_name} → ${row.foreign_table_name}.${row.foreign_column_name}`);
      });
    } else {
      console.log('  ⚠️  No foreign key constraints found');
    }
    
    // 4. Check indexes
    console.log('\n📈 Checking indexes...');
    const indexResult = await client.query(`
      SELECT tablename, indexname
      FROM pg_indexes
      WHERE tablename IN ('seaport_orders', 'order_fulfillments', 'order_cancellations', 'order_events')
      ORDER BY tablename, indexname;
    `);
    
    const indexesByTable = {};
    indexResult.rows.forEach(row => {
      if (!indexesByTable[row.tablename]) {
        indexesByTable[row.tablename] = [];
      }
      indexesByTable[row.tablename].push(row.indexname);
    });
    
    Object.keys(indexesByTable).sort().forEach(table => {
      console.log(`  ${table}: ${indexesByTable[table].length} indexes`);
    });
    
    // 5. Check triggers
    console.log('\n⚡ Checking triggers...');
    const triggerResult = await client.query(`
      SELECT trigger_name, event_manipulation, event_object_table
      FROM information_schema.triggers
      WHERE event_object_table = 'seaport_orders'
      ORDER BY trigger_name;
    `);
    
    if (triggerResult.rows.length > 0) {
      triggerResult.rows.forEach(row => {
        console.log(`  ✓ ${row.trigger_name} on ${row.event_object_table}`);
      });
    } else {
      console.log('  ⚠️  No triggers found');
    }
    
    // 6. Check constraints
    console.log('\n✅ Checking table constraints...');
    const constraintResult = await client.query(`
      SELECT
        tc.table_name,
        tc.constraint_name,
        tc.constraint_type
      FROM information_schema.table_constraints AS tc
      WHERE tc.table_name IN ('seaport_orders', 'order_fulfillments', 'order_cancellations', 'order_events')
        AND tc.constraint_type IN ('CHECK', 'UNIQUE', 'PRIMARY KEY')
      ORDER BY tc.table_name, tc.constraint_type;
    `);
    
    const constraintsByTable = {};
    constraintResult.rows.forEach(row => {
      if (!constraintsByTable[row.table_name]) {
        constraintsByTable[row.table_name] = {};
      }
      if (!constraintsByTable[row.table_name][row.constraint_type]) {
        constraintsByTable[row.table_name][row.constraint_type] = 0;
      }
      constraintsByTable[row.table_name][row.constraint_type]++;
    });
    
    Object.keys(constraintsByTable).sort().forEach(table => {
      const constraints = constraintsByTable[table];
      console.log(`  ${table}:`);
      Object.keys(constraints).forEach(type => {
        console.log(`    - ${type}: ${constraints[type]}`);
      });
    });
    
    console.log('\n✨ Schema verification complete!');
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

verifySchema()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
