/**
 * Comprehensive test for OrderCleanupCronService with test data
 * 
 * This script:
 * 1. Creates test orders (some expired, some active)
 * 2. Runs the cleanup service
 * 3. Verifies only expired orders are marked as inactive
 * 4. Cleans up test data
 */

require('dotenv').config();
const { pool } = require('./src/config/database');
const { getOrderCleanupCronService } = require('./src/services/OrderCleanupCronService');
const logger = require('./src/utils/logger');

// Test data with proper 42-character Ethereum addresses
const TEST_ORDERS = [
  {
    order_hash: '0xtest1111111111111111111111111111111111111111111111111111111111',
    order_type: 'listing',
    nft_contract: '0x1234567890123456789012345678901234567890',
    token_id: '1',
    maker: '0x1111111111111111111111111111111111111111',
    payment_token: '0x2222222222222222222222222222222222222222',
    price: '1000000000000000000',
    start_time: Math.floor(Date.now() / 1000) - 3600,
    end_time: Math.floor(Date.now() / 1000) - 1800, // Expired 30 minutes ago
    order_components: { test: 'data' },
    signature: '0xsignature1',
    is_active: true
  },
  {
    order_hash: '0xtest2222222222222222222222222222222222222222222222222222222222',
    order_type: 'offer',
    nft_contract: '0x1234567890123456789012345678901234567890',
    token_id: '2',
    maker: '0x3333333333333333333333333333333333333333',
    payment_token: '0x2222222222222222222222222222222222222222',
    price: '2000000000000000000',
    start_time: Math.floor(Date.now() / 1000) - 3600,
    end_time: Math.floor(Date.now() / 1000) - 600, // Expired 10 minutes ago
    order_components: { test: 'data' },
    signature: '0xsignature2',
    is_active: true
  },
  {
    order_hash: '0xtest3333333333333333333333333333333333333333333333333333333333',
    order_type: 'listing',
    nft_contract: '0x1234567890123456789012345678901234567890',
    token_id: '3',
    maker: '0x4444444444444444444444444444444444444444',
    payment_token: '0x2222222222222222222222222222222222222222',
    price: '3000000000000000000',
    start_time: Math.floor(Date.now() / 1000),
    end_time: Math.floor(Date.now() / 1000) + 3600, // Expires in 1 hour (active)
    order_components: { test: 'data' },
    signature: '0xsignature3',
    is_active: true
  },
  {
    order_hash: '0xtest4444444444444444444444444444444444444444444444444444444444',
    order_type: 'offer',
    nft_contract: '0x1234567890123456789012345678901234567890',
    token_id: '4',
    maker: '0x5555555555555555555555555555555555555555',
    payment_token: '0x2222222222222222222222222222222222222222',
    price: '4000000000000000000',
    start_time: Math.floor(Date.now() / 1000),
    end_time: Math.floor(Date.now() / 1000) + 7200, // Expires in 2 hours (active)
    order_components: { test: 'data' },
    signature: '0xsignature4',
    is_active: true
  }
];

async function insertTestOrders() {
  logger.info('📝 Inserting test orders...');
  
  for (const order of TEST_ORDERS) {
    const expiresAt = new Date(order.end_time * 1000);
    
    await pool.query(`
      INSERT INTO seaport_orders (
        order_hash, order_type, nft_contract, token_id, maker,
        payment_token, price, start_time, end_time, expires_at,
        order_components, signature, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (order_hash) DO NOTHING
    `, [
      order.order_hash,
      order.order_type,
      order.nft_contract,
      order.token_id,
      order.maker,
      order.payment_token,
      order.price,
      order.start_time,
      order.end_time,
      expiresAt,
      JSON.stringify(order.order_components),
      order.signature,
      order.is_active
    ]);
    
    const status = order.end_time < Math.floor(Date.now() / 1000) ? '❌ EXPIRED' : '✅ ACTIVE';
    logger.info(`   ${status} Order ${order.order_hash.substring(0, 12)}... (${order.order_type})`);
  }
  
  logger.info('✅ Test orders inserted');
}

async function cleanupTestOrders() {
  logger.info('🧹 Cleaning up test orders...');
  
  await pool.query(`
    DELETE FROM seaport_orders
    WHERE order_hash LIKE '0xtest%'
  `);
  
  logger.info('✅ Test orders cleaned up');
}

async function testOrderCleanupWithData() {
  try {
    logger.info('🧪 TESTING ORDER CLEANUP SERVICE WITH TEST DATA');
    logger.info('='.repeat(60));

    // Step 1: Check database schema
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
      logger.info('💡 Please run the database migration first');
      process.exit(1);
    }

    logger.info('✅ Database schema verified');

    // Step 2: Clean up any existing test data
    logger.info('\n🧹 Step 2: Cleaning up any existing test data...');
    await cleanupTestOrders();

    // Step 3: Insert test orders
    logger.info('\n📝 Step 3: Creating test orders...');
    await insertTestOrders();

    // Step 4: Verify test data
    logger.info('\n🔍 Step 4: Verifying test data...');
    const beforeQuery = `
      SELECT 
        order_hash,
        order_type,
        is_active,
        expires_at,
        CASE 
          WHEN expires_at <= CURRENT_TIMESTAMP THEN 'EXPIRED'
          ELSE 'ACTIVE'
        END as status
      FROM seaport_orders
      WHERE order_hash LIKE '0xtest%'
      ORDER BY order_hash
    `;
    
    const beforeResult = await pool.query(beforeQuery);
    
    logger.info('📋 TEST ORDERS BEFORE CLEANUP:');
    beforeResult.rows.forEach(row => {
      const statusIcon = row.status === 'EXPIRED' ? '❌' : '✅';
      const activeIcon = row.is_active ? '🟢' : '🔴';
      logger.info(`   ${statusIcon} ${activeIcon} ${row.order_hash.substring(0, 12)}... (${row.order_type}) - ${row.status}`);
    });

    const expiredCount = beforeResult.rows.filter(r => r.status === 'EXPIRED').length;
    const activeCount = beforeResult.rows.filter(r => r.status === 'ACTIVE').length;
    
    logger.info(`\n   Expected to clean up: ${expiredCount} expired orders`);
    logger.info(`   Expected to keep active: ${activeCount} active orders`);

    // Step 5: Run cleanup service
    logger.info('\n🧹 Step 5: Running cleanup service...');
    const cleanupService = getOrderCleanupCronService();
    const result = await cleanupService.cleanupExpiredOrders();

    logger.info('✅ Cleanup completed!');
    logger.info(`   Orders cleaned up: ${result.cleanedUp}`);

    // Step 6: Verify cleanup results
    logger.info('\n🔍 Step 6: Verifying cleanup results...');
    const afterResult = await pool.query(beforeQuery);
    
    logger.info('📋 TEST ORDERS AFTER CLEANUP:');
    afterResult.rows.forEach(row => {
      const statusIcon = row.status === 'EXPIRED' ? '❌' : '✅';
      const activeIcon = row.is_active ? '🟢' : '🔴';
      logger.info(`   ${statusIcon} ${activeIcon} ${row.order_hash.substring(0, 12)}... (${row.order_type}) - ${row.status}`);
    });

    // Step 7: Validate results
    logger.info('\n✅ Step 7: Validating results...');
    
    const expiredButActive = afterResult.rows.filter(r => r.status === 'EXPIRED' && r.is_active);
    const activeAndActive = afterResult.rows.filter(r => r.status === 'ACTIVE' && r.is_active);
    const expiredAndInactive = afterResult.rows.filter(r => r.status === 'EXPIRED' && !r.is_active);
    
    logger.info(`   ✅ Active orders still active: ${activeAndActive.length} (expected: ${activeCount})`);
    logger.info(`   ✅ Expired orders now inactive: ${expiredAndInactive.length} (expected: ${expiredCount})`);
    logger.info(`   ❌ Expired orders still active: ${expiredButActive.length} (expected: 0)`);

    let success = true;

    if (expiredButActive.length > 0) {
      logger.error('\n❌ FAILURE: Some expired orders are still active!');
      success = false;
    }

    if (activeAndActive.length !== activeCount) {
      logger.error('\n❌ FAILURE: Some active orders were incorrectly marked inactive!');
      success = false;
    }

    if (expiredAndInactive.length !== expiredCount) {
      logger.error('\n❌ FAILURE: Not all expired orders were marked inactive!');
      success = false;
    }

    if (result.cleanedUp !== expiredCount) {
      logger.error(`\n❌ FAILURE: Cleanup count mismatch! Expected ${expiredCount}, got ${result.cleanedUp}`);
      success = false;
    }

    // Step 8: Clean up test data
    logger.info('\n🧹 Step 8: Cleaning up test data...');
    await cleanupTestOrders();

    if (success) {
      logger.info('\n🎉 ALL TESTS PASSED!');
      logger.info('✅ OrderCleanupCronService is working correctly');
    } else {
      logger.error('\n❌ SOME TESTS FAILED!');
      process.exit(1);
    }

    logger.info('='.repeat(60));

  } catch (error) {
    logger.error('❌ TEST FAILED:', error);
    logger.error('Stack trace:', error.stack);
    
    // Clean up test data even on failure
    try {
      await cleanupTestOrders();
    } catch (cleanupError) {
      logger.error('Failed to clean up test data:', cleanupError);
    }
    
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the test
testOrderCleanupWithData();
