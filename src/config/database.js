const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

// Build database config from individual vars OR connection string
const dbConfig = process.env.DATABASE_URL ? {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
} : {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'meeting_auction',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

const pool = new Pool({
  ...dbConfig,
  connectionTimeoutMillis: 30000, // 30 second timeout (increased for stability)
  query_timeout: 30000,
  statement_timeout: 30000,
  max: 20, // Connection pool size
  idleTimeoutMillis: 30000,
  allowExitOnIdle: false // Important for cron jobs
});

async function setupDatabase() {
  try {
    logger.info('🔍 Checking database configuration...');
    
    // Check if database URL is configured
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('demo_mode') || process.env.DATABASE_URL.includes('YOUR_')) {
      logger.warn('⚠️  Database not configured, running in demo mode');
      return;
    }
    
    logger.info('📡 Testing database connection...');
    
    // Add timeout wrapper to prevent hanging
    const connectWithTimeout = Promise.race([
      pool.connect(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout after 5 seconds')), 5000)
      )
    ]);
    
    // Test connection
    const client = await connectWithTimeout;
    client.release();
    logger.info('✅ PostgreSQL connection successful');
    
    // Create tables (skip if connection failed)
    logger.info('📋 Creating/verifying database tables...');
    await createTables();
    logger.info('✅ Database tables ready');
    
  } catch (error) {
    logger.error('❌ Database setup failed:', error.message);
    if (error.message.includes('timeout') || error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      logger.warn('⚠️  Database connection timed out or refused - likely remote DB not accessible from local machine');
    }
    logger.warn('⚠️  Server will continue in demo mode without database');
  }
}

async function createTables() {
  try {
    // Read the schema.sql file
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute the entire schema as one transaction
    await pool.query(schemaSQL);
    
    logger.info('Database tables created/verified from schema.sql');
  } catch (error) {
    logger.error('Failed to create tables from schema.sql:', error);
    throw error;
  }
}

// Migration function for existing databases
async function migrate() {
  try {
    logger.info('Starting database migration...');
    
    // Check if old tables exist and migrate data if needed
    const oldTablesExist = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'users' 
        AND table_schema = 'public'
      );
    `);
    
    if (oldTablesExist.rows[0].exists) {
      logger.info('Old tables detected, migration not needed');
      return;
    }
    
    logger.info('Migration completed successfully');
  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  }
}

module.exports = { pool, setupDatabase, migrate };