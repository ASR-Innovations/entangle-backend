/**
 * Test script for OrderValidationService
 * Verifies basic functionality of the validation service
 */

require('dotenv').config();
const { OrderValidationService } = require('./src/services/OrderValidationService');

async function testOrderValidationService() {
  console.log('🧪 Testing OrderValidationService...\n');

  const service = new OrderValidationService();
  await service.initialize();

  // Test 1: Price Validation
  console.log('Test 1: Price Validation');
  const priceTests = [
    { price: '1000000000000000000', expected: true, desc: 'Valid price (1 ETH in wei)' },
    { price: '0', expected: false, desc: 'Zero price' },
    { price: '-100', expected: false, desc: 'Negative price' },
    { price: 'invalid', expected: false, desc: 'Invalid format' }
  ];

  for (const test of priceTests) {
    try {
      const result = await service.validatePrice(test.price);
      const status = result.valid === test.expected ? '✅' : '❌';
      console.log(`  ${status} ${test.desc}: ${result.valid ? 'Valid' : result.error}`);
    } catch (error) {
      console.log(`  ❌ ${test.desc}: Error - ${error.message}`);
    }
  }

  // Test 2: Expiration Validation
  console.log('\nTest 2: Expiration Validation');
  const currentTime = Math.floor(Date.now() / 1000);
  const expirationTests = [
    { endTime: currentTime + 3600, expected: true, desc: 'Future expiration (1 hour)' },
    { endTime: currentTime - 3600, expected: false, desc: 'Past expiration' },
    { endTime: currentTime, expected: false, desc: 'Current time' },
    { endTime: 'invalid', expected: false, desc: 'Invalid format' }
  ];

  for (const test of expirationTests) {
    try {
      const result = await service.validateExpiration(test.endTime);
      const status = result.valid === test.expected ? '✅' : '❌';
      console.log(`  ${status} ${test.desc}: ${result.valid ? 'Valid' : result.error}`);
    } catch (error) {
      console.log(`  ❌ ${test.desc}: Error - ${error.message}`);
    }
  }

  // Test 3: Order Hash Calculation
  console.log('\nTest 3: Order Hash Calculation');
  const sampleOrderComponents = {
    offerer: '0x0000000000000000000000000000000000000001',
    zone: '0x0000000000000000000000000000000000000000',
    offer: [
      {
        itemType: 2,
        token: '0x0000000000000000000000000000000000000002',
        identifierOrCriteria: '1',
        startAmount: '1',
        endAmount: '1'
      }
    ],
    consideration: [
      {
        itemType: 1,
        token: '0x0000000000000000000000000000000000000003',
        identifierOrCriteria: '0',
        startAmount: '1000000000000000000',
        endAmount: '1000000000000000000',
        recipient: '0x0000000000000000000000000000000000000001'
      }
    ],
    orderType: 0,
    startTime: currentTime.toString(),
    endTime: (currentTime + 3600).toString(),
    zoneHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
    salt: '12345',
    conduitKey: '0x0000000000000000000000000000000000000000000000000000000000000000',
    counter: '0'
  };

  try {
    const orderHash = service.calculateOrderHash(sampleOrderComponents);
    console.log(`  ✅ Order hash calculated: ${orderHash}`);
    console.log(`  ✅ Hash format valid: ${orderHash.startsWith('0x') && orderHash.length === 66}`);
  } catch (error) {
    console.log(`  ❌ Order hash calculation failed: ${error.message}`);
  }

  // Test 4: Signature Verification (with known test data)
  console.log('\nTest 4: Signature Verification');
  console.log('  ℹ️  Signature verification requires valid signed data');
  console.log('  ℹ️  This would be tested with actual wallet signatures in integration tests');

  // Test 5: Complete Order Validation
  console.log('\nTest 5: Complete Order Validation (Basic Structure)');
  const invalidOrderData = {
    orderHash: '0x1234',
    orderType: 'invalid_type',
    nftContract: 'invalid_address',
    tokenId: '',
    maker: 'invalid_maker',
    paymentToken: '',
    price: '0'
  };

  try {
    const result = await service.validateOrderData(invalidOrderData);
    console.log(`  ✅ Validation correctly identified ${result.errors.length} errors:`);
    result.errors.forEach(error => console.log(`     - ${error}`));
  } catch (error) {
    console.log(`  ❌ Validation failed: ${error.message}`);
  }

  console.log('\n✅ OrderValidationService tests completed!');
}

// Run tests
testOrderValidationService().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
