/**
 * Manually trigger token price update
 * Run this script to update all token prices immediately
 */

require('dotenv').config();
const { setupDatabase } = require('./src/config/database');
const { getTokenPriceCronService } = require('./src/services/TokenPriceCronService');
const logger = require('./src/utils/logger');

async function main() {
  try {
    logger.info('🚀 Starting manual price update...');

    // Setup database
    await setupDatabase();
    logger.info('✅ Database connected');

    // Get pool from database module
    const { pool } = require('./src/config/database');

    // Get price cron service
    const priceCron = getTokenPriceCronService(pool);

    // Run price update
    logger.info('💰 Running price update...');
    await priceCron.runPriceUpdate();

    logger.info('✅ Price update complete!');

    // Close database connection
    await pool.end();

    // Exit
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
