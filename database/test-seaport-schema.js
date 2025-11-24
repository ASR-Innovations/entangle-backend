#!/usr/bin/env node

/**
 * Test script for Seaport Orderbook schema
 * Performs basic CRUD operations to verify the schema works correctly
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

async function testSchema() {
  const client = await pool.connect();
  
  try {
    console.log('🧪 Testing Seaport Orderbook Schema\n');
    
    // Test 1: Insert a test order
    console.log('1️⃣  Testing order insertion...');
    const testOrderHash = '0x' + '1'.repeat(64);
    const testMaker = '0x' + '2'.repeat(40);
    const testNftContract = '0x' + '3'.repeat(40);
    const testTokenId = '123';
    const testPrice = '1000000000000000000'; // 1 ETH in wei
    const testPaymentToken = '0x' + '4'.repeat(40);
    
    const orderComponents = {
      offerer: testMaker,
      zone: '0x0000000000000000000000000000000000000000',
      offer: [{
        itemType: 2,
        token: testNftContract,
        identifierOrCriteria: testTokenId,
        startAmount: '1',
        endAmount: '1'
      }],
      consideration: [{
        itemType: 1,
        token: testPaymentToken,
        identifierOrCriteria: '0',
        startAmount: testPrice,
        endAmount: testPrice,
        recipient: testMaker
      }],
      orderType: 0,
      startTime: Math.floor(Date.now() / 1000).toString(),
      endTime: (Math.floor(Date.now() / 1000) + 86400).toString(),
      zoneHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      salt: '12345',
      conduitKey: '0x0000000000000000000000000000000000000000000000000000000000000000',
      counter: '0'
    };
    
    const insertResult = await client.query(`
      INSERT INTO seaport_orders (
        order_hash, order_type, nft_contract, token_id, maker,
        payment_token, price, price_decimal, start_time, end_time,
        expires_at, order_components, signature, is_active
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
      )
      RETURNING order_hash, order_type, is_active;
    `, [
      testOrderHash,
      'listing',
      testNftContract,
      testTokenId,
      testMaker,
      testPaymentToken,
      testPrice,
      '1.0',
      Math.floor(Date.now() / 1000),
      Math.floor(Date.now() / 1000) + 86400,
      new Date(Date.now() + 86400000),
      JSON.stringify(orderComponents),
      '0xsignature',
      true
    ]);
    
    console.log(`  ✓ Inserted order: ${insertResult.rows[0].order_hash.substring(0, 10)}...`);
    
    // Test 2: Query the order
    console.log('\n2️⃣  Testing order retrieval...');
    const selectResult = await client.query(`
      SELECT order_hash, order_type, token_id, maker, price, is_active
      FROM seaport_orders
      WHERE order_hash = $1;
    `, [testOrderHash]);
    
    if (selectResult.rows.length > 0) {
      console.log(`  ✓ Retrieved order successfully`);
      console.log(`    - Type: ${selectResult.rows[0].order_type}`);
      console.log(`    - Token ID: ${selectResult.rows[0].token_id}`);
      console.log(`    - Price: ${selectResult.rows[0].price}`);
    } else {
      throw new Error('Order not found after insertion');
    }
    
    // Test 3: Query by token ID (common pattern)
    console.log('\n3️⃣  Testing token ID query...');
    const tokenQueryResult = await client.query(`
      SELECT order_hash, order_type, maker, price
      FROM seaport_orders
      WHERE token_id = $1 AND nft_contract = $2 AND is_active = true;
    `, [testTokenId, testNftContract]);
    
    console.log(`  ✓ Found ${tokenQueryResult.rows.length} active order(s) for token ${testTokenId}`);
    
    // Test 4: Insert fulfillment record
    console.log('\n4️⃣  Testing fulfillment insertion...');
    const testFulfiller = '0x' + '5'.repeat(40);
    const testTxHash = '0x' + '6'.repeat(64);
    
    const fulfillmentResult = await client.query(`
      INSERT INTO order_fulfillments (
        order_hash, fulfiller, transaction_hash, block_number, amount_paid
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING id, order_hash;
    `, [testOrderHash, testFulfiller, testTxHash, 12345678, testPrice]);
    
    console.log(`  ✓ Inserted fulfillment record (ID: ${fulfillmentResult.rows[0].id})`);
    
    // Test 5: Update order status
    console.log('\n5️⃣  Testing order update...');
    const updateResult = await client.query(`
      UPDATE seaport_orders
      SET is_fulfilled = true, fulfilled_by = $2, fulfillment_tx_hash = $3, fulfilled_at = NOW()
      WHERE order_hash = $1
      RETURNING order_hash, is_fulfilled, updated_at;
    `, [testOrderHash, testFulfiller, testTxHash]);
    
    console.log(`  ✓ Updated order status to fulfilled`);
    console.log(`    - Updated at: ${updateResult.rows[0].updated_at}`);
    
    // Test 6: Insert event log
    console.log('\n6️⃣  Testing event logging...');
    const eventResult = await client.query(`
      INSERT INTO order_events (
        order_hash, event_type, actor, event_data
      ) VALUES ($1, $2, $3, $4)
      RETURNING id, event_type;
    `, [
      testOrderHash,
      'order:fulfilled',
      testFulfiller,
      JSON.stringify({ txHash: testTxHash, blockNumber: 12345678 })
    ]);
    
    console.log(`  ✓ Logged event: ${eventResult.rows[0].event_type}`);
    
    // Test 7: Query with JOIN
    console.log('\n7️⃣  Testing JOIN query...');
    const joinResult = await client.query(`
      SELECT 
        o.order_hash,
        o.order_type,
        o.price,
        f.fulfiller,
        f.transaction_hash,
        f.fulfilled_at
      FROM seaport_orders o
      LEFT JOIN order_fulfillments f ON o.order_hash = f.order_hash
      WHERE o.order_hash = $1;
    `, [testOrderHash]);
    
    if (joinResult.rows.length > 0 && joinResult.rows[0].fulfiller) {
      console.log(`  ✓ JOIN query successful`);
      console.log(`    - Order fulfilled by: ${joinResult.rows[0].fulfiller.substring(0, 10)}...`);
    } else {
      throw new Error('JOIN query failed');
    }
    
    // Test 8: Test CHECK constraint
    console.log('\n8️⃣  Testing CHECK constraint...');
    try {
      await client.query(`
        INSERT INTO seaport_orders (
          order_hash, order_type, nft_contract, token_id, maker,
          payment_token, price, start_time, end_time, expires_at,
          order_components, signature
        ) VALUES (
          $1, 'invalid_type', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
        );
      `, [
        '0x' + '7'.repeat(64),
        testNftContract,
        '456',
        testMaker,
        testPaymentToken,
        testPrice,
        Math.floor(Date.now() / 1000),
        Math.floor(Date.now() / 1000) + 86400,
        new Date(Date.now() + 86400000),
        JSON.stringify(orderComponents),
        '0xsignature'
      ]);
      console.log('  ✗ CHECK constraint failed - invalid order type was accepted!');
    } catch (error) {
      if (error.message.includes('check constraint')) {
        console.log('  ✓ CHECK constraint working correctly');
      } else {
        throw error;
      }
    }
    
    // Cleanup: Delete test data
    console.log('\n🧹 Cleaning up test data...');
    await client.query('DELETE FROM order_events WHERE order_hash = $1', [testOrderHash]);
    await client.query('DELETE FROM order_fulfillments WHERE order_hash = $1', [testOrderHash]);
    await client.query('DELETE FROM seaport_orders WHERE order_hash = $1', [testOrderHash]);
    console.log('  ✓ Test data cleaned up');
    
    console.log('\n✨ All tests passed!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

testSchema()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
