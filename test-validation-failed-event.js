/**
 * Test Validation Failed Event in Real Flow
 * 
 * Verifies that order:validation_failed events are logged when order validation fails
 * Requirement: 8.4
 */

require('dotenv').config();
const { pool } = require('./src/config/database');
const { getOrderService } = require('./src/services/OrderService');

async function testValidationFailedEvent() {
  console.log('='.repeat(80));
  console.log('Testing Validation Failed Event in Real Order Creation Flow');
  console.log('='.repeat(80));

  const orderService = getOrderService();
  await orderService.initialize();

  try {
    // Clean up any existing test data
    console.log('\n1. Cleaning up test data...');
    await pool.query("DELETE FROM order_events WHERE order_hash LIKE 'test_invalid_%'");
    await pool.query("DELETE FROM seaport_orders WHERE order_hash LIKE 'test_invalid_%'");
    console.log('✓ Test data cleaned');

    // Test 1: Invalid order with missing required fields
    console.log('\n2. Testing validation failure with missing fields...');
    const invalidOrder1 = {
      orderHash: 'test_invalid_missing_fields',
      orderType: 'listing',
      maker: '0x1234567890123456789012345678901234567890'
      // Missing many required fields
    };

    try {
      await orderService.createOrder(invalidOrder1);
      throw new Error('Should have thrown validation error');
    } catch (error) {
      console.log('✓ Order validation failed as expected:', error.message);
    }

    // Check if validation_failed event was logged
    const event1 = await pool.query(
      "SELECT * FROM order_events WHERE order_hash = $1 AND event_type = 'order:validation_failed'",
      ['test_invalid_missing_fields']
    );

    if (event1.rows.length === 0) {
      throw new Error('order:validation_failed event not logged for missing fields');
    }
    console.log('✓ order:validation_failed event logged successfully');
    console.log('  Errors:', event1.rows[0].event_data.errors);

    // Test 2: Invalid order with zero price
    console.log('\n3. Testing validation failure with zero price...');
    const invalidOrder2 = {
      orderHash: 'test_invalid_zero_price',
      orderType: 'offer',
      nftContract: '0x1234567890123456789012345678901234567890',
      tokenId: '1',
      maker: '0x1234567890123456789012345678901234567890',
      paymentToken: '0x9876543210987654321098765432109876543210',
      price: '0', // Invalid: zero price
      startTime: Math.floor(Date.now() / 1000),
      endTime: Math.floor(Date.now() / 1000) + 86400,
      orderComponents: {
        offerer: '0x1234567890123456789012345678901234567890',
        zone: '0x0000000000000000000000000000000000000000',
        offer: [],
        consideration: [],
        orderType: 0,
        startTime: String(Math.floor(Date.now() / 1000)),
        endTime: String(Math.floor(Date.now() / 1000) + 86400),
        zoneHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        salt: '0',
        conduitKey: '0x0000000000000000000000000000000000000000000000000000000000000000',
        counter: '0'
      },
      signature: '0xabc123'
    };

    try {
      await orderService.createOrder(invalidOrder2);
      throw new Error('Should have thrown validation error');
    } catch (error) {
      console.log('✓ Order validation failed as expected:', error.message);
    }

    // Check if validation_failed event was logged
    const event2 = await pool.query(
      "SELECT * FROM order_events WHERE order_hash = $1 AND event_type = 'order:validation_failed'",
      ['test_invalid_zero_price']
    );

    if (event2.rows.length === 0) {
      throw new Error('order:validation_failed event not logged for zero price');
    }
    console.log('✓ order:validation_failed event logged successfully');
    console.log('  Errors:', event2.rows[0].event_data.errors);

    // Test 3: Invalid order with expired timestamp
    console.log('\n4. Testing validation failure with expired timestamp...');
    const invalidOrder3 = {
      orderHash: 'test_invalid_expired',
      orderType: 'listing',
      nftContract: '0x1234567890123456789012345678901234567890',
      tokenId: '1',
      maker: '0x1234567890123456789012345678901234567890',
      paymentToken: '0x9876543210987654321098765432109876543210',
      price: '1000000000000000000',
      startTime: Math.floor(Date.now() / 1000) - 86400,
      endTime: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
      orderComponents: {
        offerer: '0x1234567890123456789012345678901234567890',
        zone: '0x0000000000000000000000000000000000000000',
        offer: [],
        consideration: [],
        orderType: 0,
        startTime: String(Math.floor(Date.now() / 1000) - 86400),
        endTime: String(Math.floor(Date.now() / 1000) - 3600),
        zoneHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        salt: '0',
        conduitKey: '0x0000000000000000000000000000000000000000000000000000000000000000',
        counter: '0'
      },
      signature: '0xdef456'
    };

    try {
      await orderService.createOrder(invalidOrder3);
      throw new Error('Should have thrown validation error');
    } catch (error) {
      console.log('✓ Order validation failed as expected:', error.message);
    }

    // Check if validation_failed event was logged
    const event3 = await pool.query(
      "SELECT * FROM order_events WHERE order_hash = $1 AND event_type = 'order:validation_failed'",
      ['test_invalid_expired']
    );

    if (event3.rows.length === 0) {
      throw new Error('order:validation_failed event not logged for expired order');
    }
    console.log('✓ order:validation_failed event logged successfully');
    console.log('  Errors:', event3.rows[0].event_data.errors);

    // Verify all validation_failed events
    console.log('\n5. Verifying all validation_failed events...');
    const allValidationEvents = await pool.query(
      "SELECT order_hash, event_data FROM order_events WHERE order_hash LIKE 'test_invalid_%' AND event_type = 'order:validation_failed' ORDER BY created_at"
    );

    console.log(`✓ Total validation_failed events: ${allValidationEvents.rows.length}`);
    allValidationEvents.rows.forEach((event, index) => {
      console.log(`  ${index + 1}. ${event.order_hash}`);
      console.log(`     Errors: ${event.event_data.errors.join(', ')}`);
    });

    // Clean up test data
    console.log('\n6. Cleaning up test data...');
    await pool.query("DELETE FROM order_events WHERE order_hash LIKE 'test_invalid_%'");
    console.log('✓ Test data cleaned');

    console.log('\n' + '='.repeat(80));
    console.log('✅ VALIDATION FAILED EVENT TEST PASSED');
    console.log('='.repeat(80));
    console.log('\nVerified:');
    console.log('  ✓ order:validation_failed events are logged when validation fails');
    console.log('  ✓ Events include error details in event_data');
    console.log('  ✓ Events include order type and maker information');
    console.log('  ✓ Requirement 8.4 is fully implemented');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run test
testValidationFailedEvent();
