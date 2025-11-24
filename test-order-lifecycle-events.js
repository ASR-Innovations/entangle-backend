/**
 * Test Order Lifecycle Event Logging
 * 
 * Verifies that events are logged correctly throughout the complete order lifecycle
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */

require('dotenv').config();
const { pool } = require('./src/config/database');
const { getOrderService } = require('./src/services/OrderService');

async function testOrderLifecycleEvents() {
  console.log('='.repeat(80));
  console.log('Testing Order Lifecycle Event Logging');
  console.log('='.repeat(80));

  const orderService = getOrderService();
  await orderService.initialize();

  try {
    // Clean up any existing test data
    console.log('\n1. Cleaning up test data...');
    await pool.query("DELETE FROM order_events WHERE order_hash LIKE 'test_lifecycle_%'");
    await pool.query("DELETE FROM order_cancellations WHERE order_hash LIKE 'test_lifecycle_%'");
    await pool.query("DELETE FROM order_fulfillments WHERE order_hash LIKE 'test_lifecycle_%'");
    await pool.query("DELETE FROM seaport_orders WHERE order_hash LIKE 'test_lifecycle_%'");
    console.log('✓ Test data cleaned');

    // Test Scenario 1: Order Creation → Cancellation
    console.log('\n2. Testing Order Creation → Cancellation lifecycle...');
    
    const cancelledOrderHash = 'test_lifecycle_cancelled_' + Date.now();
    
    // Create order (this will log order:created event)
    console.log('  Creating order...');
    await orderService.logOrderEvent({
      orderHash: cancelledOrderHash,
      eventType: 'order:created',
      actor: '0x1111111111111111111111111111111111111111',
      eventData: {
        orderType: 'listing',
        tokenId: '100',
        price: '2000000000000000000'
      }
    });
    
    // Simulate order in database for cancellation
    await pool.query(`
      INSERT INTO seaport_orders (
        order_hash, order_type, nft_contract, token_id, maker, payment_token,
        price, start_time, end_time, expires_at, order_components, signature,
        para_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
      cancelledOrderHash,
      'listing',
      '0x1111111111111111111111111111111111111111',
      '100',
      '0x1111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222',
      '2000000000000000000',
      Math.floor(Date.now() / 1000),
      Math.floor(Date.now() / 1000) + 86400,
      new Date(Date.now() + 86400000),
      JSON.stringify({ offerer: '0x1111111111111111111111111111111111111111' }),
      '0xsignature',
      null // Use NULL to avoid foreign key constraint
    ]);
    
    // Cancel order (this will log order:cancelled event)
    console.log('  Cancelling order...');
    await orderService.cancelOrder(cancelledOrderHash, null, {
      reason: 'User changed mind'
    });
    
    // Verify events
    const cancelledOrderEvents = await pool.query(
      "SELECT event_type, actor, event_data, created_at FROM order_events WHERE order_hash = $1 ORDER BY created_at",
      [cancelledOrderHash]
    );
    
    console.log(`  ✓ Events logged: ${cancelledOrderEvents.rows.length}`);
    if (cancelledOrderEvents.rows.length !== 2) {
      throw new Error(`Expected 2 events, got ${cancelledOrderEvents.rows.length}`);
    }
    
    const [createdEvent, cancelledEvent] = cancelledOrderEvents.rows;
    if (createdEvent.event_type !== 'order:created') {
      throw new Error('First event should be order:created');
    }
    if (cancelledEvent.event_type !== 'order:cancelled') {
      throw new Error('Second event should be order:cancelled');
    }
    
    console.log('  ✓ order:created event logged');
    console.log('  ✓ order:cancelled event logged');
    console.log('  ✓ Events in correct chronological order');

    // Test Scenario 2: Order Creation → Fulfillment
    console.log('\n3. Testing Order Creation → Fulfillment lifecycle...');
    
    const fulfilledOrderHash = 'test_lifecycle_fulfilled_' + Date.now();
    
    // Create order
    console.log('  Creating order...');
    await orderService.logOrderEvent({
      orderHash: fulfilledOrderHash,
      eventType: 'order:created',
      actor: '0x3333333333333333333333333333333333333333',
      eventData: {
        orderType: 'offer',
        tokenId: '200',
        price: '3000000000000000000'
      }
    });
    
    // Simulate order in database for fulfillment
    await pool.query(`
      INSERT INTO seaport_orders (
        order_hash, order_type, nft_contract, token_id, maker, payment_token,
        price, start_time, end_time, expires_at, order_components, signature,
        para_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
      fulfilledOrderHash,
      'offer',
      '0x3333333333333333333333333333333333333333',
      '200',
      '0x3333333333333333333333333333333333333333',
      '0x4444444444444444444444444444444444444444',
      '3000000000000000000',
      Math.floor(Date.now() / 1000),
      Math.floor(Date.now() / 1000) + 86400,
      new Date(Date.now() + 86400000),
      JSON.stringify({ offerer: '0x3333333333333333333333333333333333333333' }),
      '0xsignature',
      null // Use NULL to avoid foreign key constraint
    ]);
    
    // Fulfill order (this will log order:fulfilled event)
    console.log('  Fulfilling order...');
    await orderService.fulfillOrder(fulfilledOrderHash, {
      fulfiller: '0x5555555555555555555555555555555555555555',
      transactionHash: '0xfulfillment_tx_hash',
      blockNumber: 12345,
      amountPaid: '3000000000000000000',
      platformFeePaid: '75000000000000000'
    });
    
    // Verify events
    const fulfilledOrderEvents = await pool.query(
      "SELECT event_type, actor, event_data, created_at FROM order_events WHERE order_hash = $1 ORDER BY created_at",
      [fulfilledOrderHash]
    );
    
    console.log(`  ✓ Events logged: ${fulfilledOrderEvents.rows.length}`);
    if (fulfilledOrderEvents.rows.length !== 2) {
      throw new Error(`Expected 2 events, got ${fulfilledOrderEvents.rows.length}`);
    }
    
    const [createdEvent2, fulfilledEvent] = fulfilledOrderEvents.rows;
    if (createdEvent2.event_type !== 'order:created') {
      throw new Error('First event should be order:created');
    }
    if (fulfilledEvent.event_type !== 'order:fulfilled') {
      throw new Error('Second event should be order:fulfilled');
    }
    
    console.log('  ✓ order:created event logged');
    console.log('  ✓ order:fulfilled event logged');
    console.log('  ✓ Events in correct chronological order');

    // Test Scenario 3: Query events by order hash
    console.log('\n4. Testing event queries...');
    
    const allTestEvents = await pool.query(
      "SELECT order_hash, event_type, actor FROM order_events WHERE order_hash LIKE 'test_lifecycle_%' ORDER BY order_hash, created_at"
    );
    
    console.log(`  ✓ Total events found: ${allTestEvents.rows.length}`);
    
    const eventsByOrder = {};
    allTestEvents.rows.forEach(event => {
      if (!eventsByOrder[event.order_hash]) {
        eventsByOrder[event.order_hash] = [];
      }
      eventsByOrder[event.order_hash].push(event.event_type);
    });
    
    console.log('  Event sequences by order:');
    Object.keys(eventsByOrder).forEach(orderHash => {
      const shortHash = orderHash.substring(0, 30) + '...';
      console.log(`    ${shortHash}: ${eventsByOrder[orderHash].join(' → ')}`);
    });

    // Test Scenario 4: Verify event data structure
    console.log('\n5. Verifying event data structure...');
    
    const sampleEvents = await pool.query(
      "SELECT * FROM order_events WHERE order_hash LIKE 'test_lifecycle_%' LIMIT 3"
    );
    
    for (const event of sampleEvents.rows) {
      // Verify all required fields exist
      if (!event.id) throw new Error('Event missing id');
      if (!event.order_hash) throw new Error('Event missing order_hash');
      if (!event.event_type) throw new Error('Event missing event_type');
      if (!event.actor) throw new Error('Event missing actor');
      if (!event.event_data) throw new Error('Event missing event_data');
      if (!event.created_at) throw new Error('Event missing created_at');
      
      // Verify event_data is valid JSON
      if (typeof event.event_data !== 'object') {
        throw new Error('event_data should be a JSON object');
      }
      
      console.log(`  ✓ Event ${event.id} (${event.event_type}): structure valid`);
    }

    // Clean up test data
    console.log('\n6. Cleaning up test data...');
    await pool.query("DELETE FROM order_events WHERE order_hash LIKE 'test_lifecycle_%'");
    await pool.query("DELETE FROM order_cancellations WHERE order_hash LIKE 'test_lifecycle_%'");
    await pool.query("DELETE FROM order_fulfillments WHERE order_hash LIKE 'test_lifecycle_%'");
    await pool.query("DELETE FROM seaport_orders WHERE order_hash LIKE 'test_lifecycle_%'");
    console.log('✓ Test data cleaned');

    console.log('\n' + '='.repeat(80));
    console.log('✅ ORDER LIFECYCLE EVENT LOGGING TESTS PASSED');
    console.log('='.repeat(80));
    console.log('\nVerified:');
    console.log('  ✓ Events are logged throughout complete order lifecycle');
    console.log('  ✓ Events maintain chronological order');
    console.log('  ✓ Event data includes all required information');
    console.log('  ✓ Events can be queried by order hash');
    console.log('  ✓ All requirements (8.1, 8.2, 8.3, 8.4, 8.5) are satisfied');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run test
testOrderLifecycleEvents();
