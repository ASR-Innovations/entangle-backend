/**
 * Test Order Event Logging
 * 
 * Verifies that all order events are properly logged to the order_events table
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */

require('dotenv').config();
const { pool } = require('./src/config/database');
const { getOrderService } = require('./src/services/OrderService');

async function testOrderEventLogging() {
  console.log('='.repeat(80));
  console.log('Testing Order Event Logging');
  console.log('='.repeat(80));

  const orderService = getOrderService();
  await orderService.initialize();

  try {
    // Clean up any existing test data
    console.log('\n1. Cleaning up test data...');
    await pool.query("DELETE FROM order_events WHERE order_hash LIKE 'test_%'");
    await pool.query("DELETE FROM seaport_orders WHERE order_hash LIKE 'test_%'");
    console.log('✓ Test data cleaned');

    // Test 1: order:created event
    console.log('\n2. Testing order:created event...');
    const testOrderHash = 'test_order_' + Date.now();
    await orderService.logOrderEvent({
      orderHash: testOrderHash,
      eventType: 'order:created',
      actor: '0x1234567890123456789012345678901234567890',
      eventData: {
        orderType: 'listing',
        tokenId: '1',
        price: '1000000000000000000'
      }
    });

    const createdEvent = await pool.query(
      "SELECT * FROM order_events WHERE order_hash = $1 AND event_type = 'order:created'",
      [testOrderHash]
    );
    
    if (createdEvent.rows.length === 0) {
      throw new Error('order:created event not logged');
    }
    console.log('✓ order:created event logged successfully');
    console.log('  Event data:', JSON.stringify(createdEvent.rows[0], null, 2));

    // Test 2: order:cancelled event
    console.log('\n3. Testing order:cancelled event...');
    await orderService.logOrderEvent({
      orderHash: testOrderHash,
      eventType: 'order:cancelled',
      actor: '0x1234567890123456789012345678901234567890',
      eventData: {
        reason: 'User requested cancellation',
        transactionHash: '0xabc123'
      }
    });

    const cancelledEvent = await pool.query(
      "SELECT * FROM order_events WHERE order_hash = $1 AND event_type = 'order:cancelled'",
      [testOrderHash]
    );
    
    if (cancelledEvent.rows.length === 0) {
      throw new Error('order:cancelled event not logged');
    }
    console.log('✓ order:cancelled event logged successfully');
    console.log('  Event data:', JSON.stringify(cancelledEvent.rows[0], null, 2));

    // Test 3: order:fulfilled event
    console.log('\n4. Testing order:fulfilled event...');
    await orderService.logOrderEvent({
      orderHash: testOrderHash,
      eventType: 'order:fulfilled',
      actor: '0x9876543210987654321098765432109876543210',
      eventData: {
        transactionHash: '0xdef456',
        blockNumber: 12345,
        amountPaid: '1000000000000000000',
        platformFeePaid: '25000000000000000'
      }
    });

    const fulfilledEvent = await pool.query(
      "SELECT * FROM order_events WHERE order_hash = $1 AND event_type = 'order:fulfilled'",
      [testOrderHash]
    );
    
    if (fulfilledEvent.rows.length === 0) {
      throw new Error('order:fulfilled event not logged');
    }
    console.log('✓ order:fulfilled event logged successfully');
    console.log('  Event data:', JSON.stringify(fulfilledEvent.rows[0], null, 2));

    // Test 4: order:validation_failed event
    console.log('\n5. Testing order:validation_failed event...');
    await orderService.logOrderEvent({
      orderHash: testOrderHash,
      eventType: 'order:validation_failed',
      actor: '0x1234567890123456789012345678901234567890',
      eventData: {
        errors: ['Invalid signature', 'Price must be greater than zero'],
        orderType: 'offer'
      }
    });

    const validationFailedEvent = await pool.query(
      "SELECT * FROM order_events WHERE order_hash = $1 AND event_type = 'order:validation_failed'",
      [testOrderHash]
    );
    
    if (validationFailedEvent.rows.length === 0) {
      throw new Error('order:validation_failed event not logged');
    }
    console.log('✓ order:validation_failed event logged successfully');
    console.log('  Event data:', JSON.stringify(validationFailedEvent.rows[0], null, 2));

    // Test 5: Verify all events are stored with correct structure
    console.log('\n6. Verifying event structure...');
    const allEvents = await pool.query(
      "SELECT * FROM order_events WHERE order_hash = $1 ORDER BY created_at",
      [testOrderHash]
    );

    console.log(`✓ Total events logged: ${allEvents.rows.length}`);
    
    for (const event of allEvents.rows) {
      // Verify required fields
      if (!event.id) throw new Error('Event missing id');
      if (!event.order_hash) throw new Error('Event missing order_hash');
      if (!event.event_type) throw new Error('Event missing event_type');
      if (!event.actor) throw new Error('Event missing actor');
      if (!event.event_data) throw new Error('Event missing event_data');
      if (!event.created_at) throw new Error('Event missing created_at');
      
      console.log(`  ✓ Event ${event.id}: ${event.event_type} - structure valid`);
    }

    // Test 6: Query events by type
    console.log('\n7. Testing event queries by type...');
    const eventTypes = ['order:created', 'order:cancelled', 'order:fulfilled', 'order:validation_failed'];
    
    for (const eventType of eventTypes) {
      const result = await pool.query(
        "SELECT COUNT(*) FROM order_events WHERE event_type = $1",
        [eventType]
      );
      console.log(`  ✓ ${eventType}: ${result.rows[0].count} events found`);
    }

    // Test 7: Query events by order hash
    console.log('\n8. Testing event queries by order hash...');
    const orderEvents = await pool.query(
      "SELECT event_type, actor, created_at FROM order_events WHERE order_hash = $1 ORDER BY created_at",
      [testOrderHash]
    );
    
    console.log(`  ✓ Found ${orderEvents.rows.length} events for order ${testOrderHash}`);
    orderEvents.rows.forEach((event, index) => {
      console.log(`    ${index + 1}. ${event.event_type} by ${event.actor} at ${event.created_at}`);
    });

    // Clean up test data
    console.log('\n9. Cleaning up test data...');
    await pool.query("DELETE FROM order_events WHERE order_hash = $1", [testOrderHash]);
    console.log('✓ Test data cleaned');

    console.log('\n' + '='.repeat(80));
    console.log('✅ ALL ORDER EVENT LOGGING TESTS PASSED');
    console.log('='.repeat(80));
    console.log('\nVerified:');
    console.log('  ✓ order:created events are logged (Requirement 8.1)');
    console.log('  ✓ order:cancelled events are logged (Requirement 8.2)');
    console.log('  ✓ order:fulfilled events are logged (Requirement 8.3)');
    console.log('  ✓ order:validation_failed events are logged (Requirement 8.4)');
    console.log('  ✓ Events include order hash, actor, and event data (Requirement 8.5)');
    console.log('  ✓ Events are stored in order_events table');
    console.log('  ✓ Events can be queried by order hash and event type');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run tests
testOrderEventLogging();
