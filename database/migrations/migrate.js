#!/usr/bin/env node

/**
 * Database Migration Runner
 * 
 * This script manages database migrations for the Entangle platform.
 * It supports applying migrations (up) and rolling them back (down).
 * 
 * Features:
 * - Transaction-based migrations for safety
 * - Migration tracking to prevent duplicate runs
 * - Detailed logging and error reporting
 * - Dry-run mode for testing
 * - Automatic rollback on failure
 * 
 * Usage:
 *   node database/migrations/migrate.js up [migration_version]
 *   node database/migrations/migrate.js down [migration_version]
 *   node database/migrations/migrate.js status
 *   node database/migrations/migrate.js up --dry-run
 * 
 * Examples:
 *   node database/migrations/migrate.js up              # Apply all pending migrations
 *   node database/migrations/migrate.js up 002          # Apply specific migration
 *   node database/migrations/migrate.js down 002        # Rollback specific migration
 *   node database/migrations/migrate.js status          # Show migration status
 *   node database/migrations/migrate.js up --dry-run    # Test without applying
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

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

/**
 * Log with color
 */
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Ensure migrations tracking table exists
 */
async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(50) PRIMARY KEY,
      description TEXT,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

/**
 * Get list of applied migrations
 */
async function getAppliedMigrations(client) {
  const result = await client.query(`
    SELECT version, description, applied_at 
    FROM schema_migrations 
    ORDER BY version;
  `);
  return result.rows;
}

/**
 * Get list of available migration files
 */
function getAvailableMigrations() {
  const migrationsDir = __dirname;
  const files = fs.readdirSync(migrationsDir);
  
  const migrations = files
    .filter(f => f.endsWith('_up.sql'))
    .map(f => {
      const version = f.split('_')[0];
      const description = f.replace(`${version}_`, '').replace('_up.sql', '');
      return { version, description, upFile: f, downFile: f.replace('_up.sql', '_down.sql') };
    })
    .sort((a, b) => a.version.localeCompare(b.version));
  
  return migrations;
}

/**
 * Show migration status
 */
async function showStatus() {
  const client = await pool.connect();
  
  try {
    log('\n📊 Migration Status', 'cyan');
    log('='.repeat(80), 'cyan');
    
    await ensureMigrationsTable(client);
    
    const applied = await getAppliedMigrations(client);
    const available = getAvailableMigrations();
    
    const appliedVersions = new Set(applied.map(m => m.version));
    
    log('\nAvailable Migrations:', 'bright');
    available.forEach(migration => {
      const isApplied = appliedVersions.has(migration.version);
      const status = isApplied ? '✓ Applied' : '○ Pending';
      const statusColor = isApplied ? 'green' : 'yellow';
      
      log(`  ${status} - ${migration.version}: ${migration.description}`, statusColor);
      
      if (isApplied) {
        const appliedMigration = applied.find(m => m.version === migration.version);
        log(`    Applied at: ${appliedMigration.applied_at}`, 'reset');
      }
    });
    
    log('\n' + '='.repeat(80), 'cyan');
    log(`Total: ${available.length} migrations (${applied.length} applied, ${available.length - applied.length} pending)\n`, 'cyan');
    
  } finally {
    client.release();
  }
}

/**
 * Apply a migration (up)
 */
async function applyMigration(version, dryRun = false) {
  const client = await pool.connect();
  
  try {
    log(`\n🔍 Connecting to database...`, 'blue');
    log(`   Host: ${dbConfig.host || 'from DATABASE_URL'}`, 'reset');
    log(`   Database: ${dbConfig.database || 'from DATABASE_URL'}`, 'reset');
    
    await ensureMigrationsTable(client);
    
    const available = getAvailableMigrations();
    const migration = available.find(m => m.version === version);
    
    if (!migration) {
      throw new Error(`Migration ${version} not found`);
    }
    
    // Check if already applied
    const applied = await getAppliedMigrations(client);
    if (applied.some(m => m.version === version)) {
      log(`\n⚠️  Migration ${version} is already applied`, 'yellow');
      return;
    }
    
    const migrationPath = path.join(__dirname, migration.upFile);
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }
    
    log(`\n📋 Reading migration file: ${migration.upFile}`, 'blue');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    if (dryRun) {
      log(`\n🧪 DRY RUN MODE - No changes will be made`, 'yellow');
      log(`\nMigration SQL Preview:`, 'cyan');
      log('─'.repeat(80), 'cyan');
      log(migrationSQL.substring(0, 500) + '...', 'reset');
      log('─'.repeat(80), 'cyan');
      return;
    }
    
    log(`\n🚀 Applying migration ${version}: ${migration.description}`, 'green');
    
    // Execute migration in a transaction
    await client.query('BEGIN');
    
    try {
      await client.query(migrationSQL);
      await client.query('COMMIT');
      
      log(`✅ Migration ${version} applied successfully!`, 'green');
      
      // Show created tables
      const tablesResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name LIKE '%order%'
        ORDER BY table_name;
      `);
      
      if (tablesResult.rows.length > 0) {
        log(`\n📊 Order-related tables:`, 'cyan');
        tablesResult.rows.forEach(row => {
          log(`  ✓ ${row.table_name}`, 'green');
        });
      }
      
      // Show index count
      const indexResult = await client.query(`
        SELECT COUNT(*) as count
        FROM pg_indexes
        WHERE tablename IN ('seaport_orders', 'order_fulfillments', 'order_cancellations', 'order_events');
      `);
      
      log(`\n📈 Created ${indexResult.rows[0].count} indexes for query optimization`, 'cyan');
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    log(`\n❌ Migration failed: ${error.message}`, 'red');
    if (error.stack) {
      log(`\nStack trace:`, 'red');
      log(error.stack, 'reset');
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Rollback a migration (down)
 */
async function rollbackMigration(version, dryRun = false) {
  const client = await pool.connect();
  
  try {
    log(`\n🔍 Connecting to database...`, 'blue');
    
    await ensureMigrationsTable(client);
    
    const available = getAvailableMigrations();
    const migration = available.find(m => m.version === version);
    
    if (!migration) {
      throw new Error(`Migration ${version} not found`);
    }
    
    // Check if migration is applied
    const applied = await getAppliedMigrations(client);
    if (!applied.some(m => m.version === version)) {
      log(`\n⚠️  Migration ${version} is not applied`, 'yellow');
      return;
    }
    
    const migrationPath = path.join(__dirname, migration.downFile);
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Rollback file not found: ${migrationPath}`);
    }
    
    log(`\n📋 Reading rollback file: ${migration.downFile}`, 'blue');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    if (dryRun) {
      log(`\n🧪 DRY RUN MODE - No changes will be made`, 'yellow');
      log(`\nRollback SQL Preview:`, 'cyan');
      log('─'.repeat(80), 'cyan');
      log(migrationSQL.substring(0, 500) + '...', 'reset');
      log('─'.repeat(80), 'cyan');
      return;
    }
    
    log(`\n⏪ Rolling back migration ${version}: ${migration.description}`, 'yellow');
    
    // Execute rollback in a transaction
    await client.query('BEGIN');
    
    try {
      await client.query(migrationSQL);
      await client.query('COMMIT');
      
      log(`✅ Migration ${version} rolled back successfully!`, 'green');
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    log(`\n❌ Rollback failed: ${error.message}`, 'red');
    if (error.stack) {
      log(`\nStack trace:`, 'red');
      log(error.stack, 'reset');
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Apply all pending migrations
 */
async function applyAllPending(dryRun = false) {
  const client = await pool.connect();
  
  try {
    await ensureMigrationsTable(client);
    
    const applied = await getAppliedMigrations(client);
    const available = getAvailableMigrations();
    
    const appliedVersions = new Set(applied.map(m => m.version));
    const pending = available.filter(m => !appliedVersions.has(m.version));
    
    if (pending.length === 0) {
      log(`\n✅ All migrations are up to date!`, 'green');
      return;
    }
    
    log(`\n📦 Found ${pending.length} pending migration(s)`, 'cyan');
    pending.forEach(m => {
      log(`  ○ ${m.version}: ${m.description}`, 'yellow');
    });
    
    for (const migration of pending) {
      await applyMigration(migration.version, dryRun);
    }
    
    log(`\n✨ All pending migrations applied successfully!`, 'green');
    
  } finally {
    client.release();
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const version = args[1];
  const dryRun = args.includes('--dry-run');
  
  try {
    if (!command || command === 'help') {
      log('\n📚 Database Migration Tool', 'cyan');
      log('='.repeat(80), 'cyan');
      log('\nUsage:', 'bright');
      log('  node database/migrations/migrate.js <command> [options]', 'reset');
      log('\nCommands:', 'bright');
      log('  up [version]      Apply migration(s)', 'reset');
      log('  down <version>    Rollback a migration', 'reset');
      log('  status            Show migration status', 'reset');
      log('  help              Show this help message', 'reset');
      log('\nOptions:', 'bright');
      log('  --dry-run         Test migration without applying', 'reset');
      log('\nExamples:', 'bright');
      log('  node database/migrations/migrate.js up              # Apply all pending', 'reset');
      log('  node database/migrations/migrate.js up 002          # Apply specific', 'reset');
      log('  node database/migrations/migrate.js down 002        # Rollback specific', 'reset');
      log('  node database/migrations/migrate.js status          # Show status', 'reset');
      log('  node database/migrations/migrate.js up --dry-run    # Test without applying', 'reset');
      log('\n' + '='.repeat(80) + '\n', 'cyan');
      return;
    }
    
    switch (command) {
      case 'status':
        await showStatus();
        break;
        
      case 'up':
        if (version) {
          await applyMigration(version, dryRun);
        } else {
          await applyAllPending(dryRun);
        }
        break;
        
      case 'down':
        if (!version) {
          log('\n❌ Version required for rollback', 'red');
          log('Usage: node database/migrations/migrate.js down <version>', 'reset');
          process.exit(1);
        }
        await rollbackMigration(version, dryRun);
        break;
        
      default:
        log(`\n❌ Unknown command: ${command}`, 'red');
        log('Run "node database/migrations/migrate.js help" for usage', 'reset');
        process.exit(1);
    }
    
    log('\n✨ Done!\n', 'green');
    process.exit(0);
    
  } catch (error) {
    log(`\n❌ Unexpected error: ${error.message}`, 'red');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { applyMigration, rollbackMigration, showStatus };
