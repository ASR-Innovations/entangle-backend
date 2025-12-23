/**
 * Run Creator Tables Migration
 * Adds creator_profiles, creator_tokens, and related tables
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🚀 Starting creator tables migration...');
    console.log('📊 Database:', process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'local');

    // Read migration file
    const migrationPath = path.join(__dirname, '003_add_creator_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📝 Executing migration SQL...');

    // Execute migration
    await pool.query(migrationSQL);

    console.log('✅ Migration completed successfully!');

    // Verify tables were created
    console.log('\n📋 Verifying tables...');
    
    const tables = [
      'creator_profiles',
      'creator_tokens',
      'token_price_history',
      'token_holders',
      'token_transactions',
      'telegram_rooms',
      'telegram_purchases',
      'creator_followers'
    ];

    for (const table of tables) {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = $1
        )
      `, [table]);

      const exists = result.rows[0].exists;
      console.log(`  ${exists ? '✅' : '❌'} ${table}`);
    }

    console.log('\n🎉 All creator tables created successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
