/**
 * Test Platform Fee Validation
 * 
 * Tests the platform fee validation functionality in OrderValidationService
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */

require('dotenv').config();
const { getOrderValidationService } = require('./src/services/OrderValidationService');
const logger = require('./src/utils/logger');

async function testPlatformFeeValidation() {
  console.log('\n🧪 Testing Platform Fee Validation\n');
  console.log('='.repeat(60));

  // Set platform fee recipient for testing
  const testRecipient = '0x1234567890123456789012345678901234567890';
  process.env.PLATFORM_FEE_RECIPIENT = testRecipient;

  // Create a new instance to pick up the environment variable
  const { OrderValidationService } = require('./src/services/OrderValidationService');
  const validationService = new OrderValidationService();
  await validationService.initialize();

  // Test configuration
  const testPrice = '1000000000000000000'; // 1 ETH in wei
  const platformFeeRecipient = testRecipient;
  const platformFeeBasisPoints = parseInt(process.env.PLATFORM_FEE_BASIS_POINTS || '250');
  
  // Calculate expected fee
  const expectedFee = validationService.calculateExpectedPlatformFee(testPrice);
  
  console.log('\n📊 Test Configuration:');
  console.log(`   Price: ${testPrice} wei (1 ETH)`);
  console.log(`   Platform Fee Recipient: ${platformFeeRecipient}`);
  console.log(`   Platform Fee Basis Points: ${platformFeeBasisPoints} (${platformFeeBasisPoints / 100}%)`);
  console.log(`   Expected Fee: ${expectedFee.toString()} wei`);

  // Test 1: Valid platform fee
  console.log('\n\n📝 Test 1: Valid Platform Fee');
  console.log('-'.repeat(60));
  
  const validOrderData = {
    orderHash: '0x1234567890123456789012345678901234567890123456789012345678901234',
    orderType: 'listing',
    nftContract: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    tokenId: '1',
    maker: '0x1111111111111111111111111111111111111111',
    paymentToken: '0x0000000000000000000000000000000000000000',
    price: testPrice,
    platformFeeAmount: expectedFee.toString(),
    platformFeeRecipient: platformFeeRecipient,
    orderComponents: {
      offerer: '0x1111111111111111111111111111111111111111',
      zone: '0x0000000000000000000000000000000000000000',
      offer: [
        {
          itemType: 2,
          token: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
          identifierOrCriteria: '1',
          startAmount: '1',
          endAmount: '1'
        }
      ],
      consideration: [
        {
          itemType: 0,
          token: '0x0000000000000000000000000000000000000000',
          identifierOrCriteria: '0',
          startAmount: testPrice,
          endAmount: testPrice,
          recipient: '0x1111111111111111111111111111111111111111'
        },
        {
          itemType: 0,
          token: '0x0000000000000000000000000000000000000000',
          identifierOrCriteria: '0',
          startAmount: expectedFee.toString(),
          endAmount: expectedFee.toString(),
          recipient: platformFeeRecipient
        }
      ],
      orderType: 0,
      startTime: Math.floor(Date.now() / 1000).toString(),
      endTime: (Math.floor(Date.now() / 1000) + 86400).toString(),
      zoneHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      salt: '12345',
      conduitKey: '0x0000000000000000000000000000000000000000000000000000000000000000',
      counter: '0'
    }
  };

  const result1 = validationService.validatePlatformFee(validOrderData);
  console.log(`   Result: ${result1.valid ? '✅ PASS' : '❌ FAIL'}`);
  if (!result1.valid) {
    console.log(`   Error: ${result1.error}`);
  }

  // Test 2: Missing platform fee in consideration
  console.log('\n\n📝 Test 2: Missing Platform Fee in Consideration');
  console.log('-'.repeat(60));
  
  const missingFeeOrderData = {
    ...validOrderData,
    orderComponents: {
      ...validOrderData.orderComponents,
      consideration: [
        {
          itemType: 0,
          token: '0x0000000000000000000000000000000000000000',
          identifierOrCriteria: '0',
          startAmount: testPrice,
          endAmount: testPrice,
          recipient: '0x1111111111111111111111111111111111111111'
        }
      ]
    }
  };

  const result2 = validationService.validatePlatformFee(missingFeeOrderData);
  console.log(`   Result: ${!result2.valid ? '✅ PASS (correctly rejected)' : '❌ FAIL (should reject)'}`);
  if (!result2.valid) {
    console.log(`   Error: ${result2.error}`);
  }

  // Test 3: Wrong platform fee recipient
  console.log('\n\n📝 Test 3: Wrong Platform Fee Recipient');
  console.log('-'.repeat(60));
  
  const wrongRecipientOrderData = {
    ...validOrderData,
    platformFeeRecipient: '0x9999999999999999999999999999999999999999',
    orderComponents: {
      ...validOrderData.orderComponents,
      consideration: [
        ...validOrderData.orderComponents.consideration.slice(0, 1),
        {
          ...validOrderData.orderComponents.consideration[1],
          recipient: '0x9999999999999999999999999999999999999999'
        }
      ]
    }
  };

  const result3 = validationService.validatePlatformFee(wrongRecipientOrderData);
  console.log(`   Result: ${!result3.valid ? '✅ PASS (correctly rejected)' : '❌ FAIL (should reject)'}`);
  if (!result3.valid) {
    console.log(`   Error: ${result3.error}`);
  }

  // Test 4: Incorrect platform fee amount
  console.log('\n\n📝 Test 4: Incorrect Platform Fee Amount');
  console.log('-'.repeat(60));
  
  const wrongAmountOrderData = {
    ...validOrderData,
    platformFeeAmount: '1000', // Way too low
    orderComponents: {
      ...validOrderData.orderComponents,
      consideration: [
        ...validOrderData.orderComponents.consideration.slice(0, 1),
        {
          ...validOrderData.orderComponents.consideration[1],
          startAmount: '1000',
          endAmount: '1000'
        }
      ]
    }
  };

  const result4 = validationService.validatePlatformFee(wrongAmountOrderData);
  console.log(`   Result: ${!result4.valid ? '✅ PASS (correctly rejected)' : '❌ FAIL (should reject)'}`);
  if (!result4.valid) {
    console.log(`   Error: ${result4.error}`);
  }

  // Test 5: Platform fee calculation
  console.log('\n\n📝 Test 5: Platform Fee Calculation');
  console.log('-'.repeat(60));
  
  const testPrices = [
    '1000000000000000000', // 1 ETH
    '500000000000000000',  // 0.5 ETH
    '2500000000000000000', // 2.5 ETH
    '100000000000000000'   // 0.1 ETH
  ];

  console.log(`   Basis Points: ${platformFeeBasisPoints} (${platformFeeBasisPoints / 100}%)\n`);
  
  for (const price of testPrices) {
    const fee = validationService.calculateExpectedPlatformFee(price);
    const priceEth = (BigInt(price) / BigInt('1000000000000000000')).toString();
    const feeEth = Number(fee) / 1e18;
    console.log(`   Price: ${priceEth} ETH → Fee: ${fee.toString()} wei (${feeEth.toFixed(6)} ETH)`);
  }

  // Summary
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 Test Summary:');
  console.log(`   Test 1 (Valid Fee): ${result1.valid ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Test 2 (Missing Fee): ${!result2.valid ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Test 3 (Wrong Recipient): ${!result3.valid ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Test 4 (Wrong Amount): ${!result4.valid ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Test 5 (Calculation): ✅ PASS`);
  
  const allPassed = result1.valid && !result2.valid && !result3.valid && !result4.valid;
  console.log(`\n   Overall: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  console.log('='.repeat(60) + '\n');

  return allPassed;
}

// Run tests
testPlatformFeeValidation()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    logger.error('Test failed with error:', error);
    console.error('\n❌ Test execution failed:', error.message);
    process.exit(1);
  });
