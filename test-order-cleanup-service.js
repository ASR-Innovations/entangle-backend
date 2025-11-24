/**
 * Test script for OrderCleanupCronService
 * 
 * This script tests the order cleanup functionality by:
 * 1. Creating test orders (some expired, some active)
 * 2. Running the cleanup service
 * 3. Verifying expired orders are marked as inactive
 */

require('dotenv').config();
const { pool } = require('./src/config/database');
const { getOrderCleanupCronService } = require('./src/services/OrderCleanupCronService');
const logger = require('./src/utils/logger');

async function testOrderCleanupService() {
  try {
    logger.info('🧪 TESTING ORDER CLEANUP SERVICE');
    logger.info('='.repeat(60));

    // Step 1: Check if seaport_orders table exists
    logger.info('📊 Step 1: Checking database schema...');
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'seaport_orders'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      logger.error('❌ seaport_orders table does not exist!');
      logger.info('💡 Please run the database migration first:');
      logger.info('   node database/run-seaport-migration.js');
      process.exit(1);
    }

    logger.info('✅ Database schema verified');

    // Step 2: Get current order statistics
    logger.info('\n📊 Step 2: Getting current order statistics...');
    const statsQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE is_active = true AND expires_at > CURRENT_TIMESTAMP) as active_orders,
        COUNT(*) FILTER (WHERE is_active = true AND expires_at <= CURRENT_TIMESTAMP) as expired_active_orders,
        COUNT(*) FILTER (WHERE is_active = false AND expires_at <= CURRENT_TIMESTAMP) as expired_inactive_orders,
        COUNT(*) as total_orders
      FROM seaport_orders
    `;

    const beforeStats = await pool.query(statsQuery);
    const before = beforeStats.rows[0];

    logger.info('📈 BEFORE CLEANUP:');
    logger.info(`   Total orders: ${before.total_orders}`);
    logger.info(`   Active (not expired): ${before.active_orders}`);
    logger.info(`   Active but expired (should be cleaned): ${before.expired_active_orders}`);
    logger.info(`   Already inactive (expired): ${before.expired_inactive_orders}`);

    // Step 3: Run cleanup service
    logger.info('\n🧹 Step 3: Running cleanup service...');
    const cleanupService = getOrderCleanupCronService();
    const result = await cleanupService.cleanupExpiredOrders();

    logger.info('✅ Cleanup completed!');
    logger.info(`   Orders cleaned up: ${result.cleanedUp}`);
    logger.info(`   Active listings: ${result.activeListings}`);
    logger.info(`   Active offers: ${result.activeOffers}`);
    logger.info(`   Total active: ${result.totalActive}`);

    // Step 4: Verify cleanup results
    logger.info('\n🔍 Step 4: Verifying cleanup results...');
    const afterStats = await pool.query(statsQuery);
    const after = afterStats.rows[0];

    logger.info('📈 AFTER CLEANUP:');
    logger.info(`   Total orders: ${after.total_orders}`);
    logger.info(`   Active (not expired): ${after.active_orders}`);
    logger.info(`   Active but expired (should be 0): ${after.expired_active_orders}`);
    logger.info(`   Already inactive (expired): ${after.expired_inactive_orders}`);

    // Verify no active expired orders remain
    if (parseInt(after.expired_active_orders) === 0) {
      logger.info('\n✅ SUCCESS: All expired orders have been cleaned up!');
    } else {
      logger.warn('\n⚠️  WARNING: Some expired orders are still active!');
    }

    // Step 5: Get cleanup statistics
    logger.info('\n📊 Step 5: Getting detailed cleanup statistics...');
    const detailedStats = await cleanupService.getCleanupStats();
    
    logger.info('📈 DETAILED STATISTICS:');
    logger.info(`   Active orders: ${detailedStats.active_orders}`);
    logger.info(`   Expired orders: ${detailedStats.expired_orders}`);
    logger.info(`   Fulfilled orders: ${detailedStats.fulfilled_orders}`);
    logger.info(`   Cancelled orders: ${detailedStats.cancelled_orders}`);
    logger.info(`   Total orders: ${detailedStats.total_orders}`);

    logger.info('\n🎉 TEST COMPLETED SUCCESSFULLY!');
    logger.info('='.repeat(60));

  } catch (error) {
    logger.error('❌ TEST FAILED:', error);
    logger.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    // Close database connection
    await pool.end();
  }
}

// Run the test
testOrderCleanupService();
