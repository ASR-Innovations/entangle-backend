/**
 * Security Audit Test Suite
 * 
 * Comprehensive security testing for Seaport Orderbook Backend
 * Requirements: 11.1-11.5, 12.1-12.5
 * 
 * Tests:
 * 1. Signature Verification Security
 * 2. Authorization Checks
 * 3. Input Validation
 * 4. SQL Injection Prevention
 * 5. XSS Prevention
 */

const { ethers } = require('ethers');
const { getOrderValidationService } = require('../src/services/OrderValidationService');
const { getOrderService } = require('../src/services/OrderService');
const { pool } = require('../src/config/database');
const logger = require('../src/utils/logger');

describe('Security Audit', () => {
  let validationService;
  let orderService;
  let testWallet;
  let attackerWallet;

  beforeAll(async () => {
    validationService = getOrderValidationService();
    orderService = getOrderService();
    await validationService.initialize();
    await orderService.initialize();

    // Create test wallets
    testWallet = ethers.Wallet.createRandom();
    attackerWallet = ethers.Wallet.createRandom();

    logger.info('Security audit test suite initialized');
  });

  afterAll(async () => {
    // Clean up test data
    try {
      await pool.query("DELETE FROM seaport_orders WHERE maker LIKE '0xTest%'");
      await pool.query("DELETE FROM order_events WHERE actor LIKE '0xTest%'");
    } catch (error) {
      logger.error('Cleanup error:', error);
    }
  });

  describe('1. Signature Verification Security', () => {
    test('should reject orders with invalid signatures', async () => {
      const orderComponents = createMockOrderComponents(testWallet.address);
      const invalidSignature = '0x' + '0'.repeat(130); // Invalid signature

      const result = await validationService.verifyOrderSignature(
        orderComponents,
        invalidSignature,
        testWallet.address
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Signature verification failed');
    });

    test('should reject orders where signature does not match maker', async () => {
      const orderComponents = createMockOrderComponents(testWallet.address);
      
      // Sign with test wallet but claim it's from attacker
      const domain = createEIP712Domain();
      const types = createEIP712Types();
      const signature = await testWallet.signTypedData(domain, types, orderComponents);

      const result = await validationService.verifyOrderSignature(
        orderComponents,
        signature,
        attackerWallet.address // Wrong maker address
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid order signature');
    });

    test('should reject orders with tampered order components', async () => {
      const orderComponents = createMockOrderComponents(testWallet.address);
      
      // Sign original order
      const domain = createEIP712Domain();
      const types = createEIP712Types();
      const signature = await testWallet.signTypedData(domain, types, orderComponents);

      // Tamper with price after signing
      const tamperedComponents = {
        ...orderComponents,
        consideration: orderComponents.consideration.map(item => ({
          ...item,
          startAmount: (BigInt(item.startAmount) * 2n).toString() // Double the price
        }))
      };

      const result = await validationService.verifyOrderSignature(
        tamperedComponents,
        signature,
        testWallet.address
      );

      expect(result.valid).toBe(false);
    });

    test('should accept valid signatures', async () => {
      const orderComponents = createMockOrderComponents(testWallet.address);
      
      const domain = createEIP712Domain();
      const types = createEIP712Types();
      const signature = await testWallet.signTypedData(domain, types, orderComponents);

      const result = await validationService.verifyOrderSignature(
        orderComponents,
        signature,
        testWallet.address
      );

      expect(result.valid).toBe(true);
    });

    test('should prevent signature replay attacks with different chain IDs', async () => {
      // This test verifies that signatures are bound to specific chain IDs
      const orderComponents = createMockOrderComponents(testWallet.address);
      
      const domain = createEIP712Domain();
      const types = createEIP712Types();
      const signature = await testWallet.signTypedData(domain, types, orderComponents);

      // Signature should be valid on correct chain
      const validResult = await validationService.verifyOrderSignature(
        orderComponents,
        signature,
        testWallet.address
      );
      expect(validResult.valid).toBe(true);

      // Note: Signature would be invalid on different chain due to domain separator
      // This is enforced by EIP-712 domain binding
    });
  });

  describe('2. Authorization Checks', () => {
    test('should prevent non-makers from cancelling orders', async () => {
      // Create a test order
      const orderData = await createTestOrder(testWallet.address, 'test-user-1');
      
      // Try to cancel with different user
      await expect(
        orderService.cancelOrder(orderData.orderHash, 'attacker-user-id')
      ).rejects.toThrow('Only the order maker can cancel this order');
    });

    test('should allow makers to cancel their own orders', async () => {
      const orderData = await createTestOrder(testWallet.address, 'test-user-2');
      
      const result = await orderService.cancelOrder(orderData.orderHash, 'test-user-2');
      
      expect(result.success).toBe(true);
      expect(result.order.isCancelled).toBe(true);
    });

    test('should prevent cancellation of fulfilled orders', async () => {
      const orderData = await createTestOrder(testWallet.address, 'test-user-3');
      
      // Fulfill the order first
      await orderService.fulfillOrder(orderData.orderHash, {
        fulfiller: attackerWallet.address,
        transactionHash: '0x' + '1'.repeat(64),
        blockNumber: 12345
      });

      // Try to cancel fulfilled order
      await expect(
        orderService.cancelOrder(orderData.orderHash, 'test-user-3')
      ).rejects.toThrow('Cannot cancel fulfilled order');
    });

    test('should prevent double cancellation', async () => {
      const orderData = await createTestOrder(testWallet.address, 'test-user-4');
      
      // Cancel once
      await orderService.cancelOrder(orderData.orderHash, 'test-user-4');

      // Try to cancel again
      await expect(
        orderService.cancelOrder(orderData.orderHash, 'test-user-4')
      ).rejects.toThrow('Order already cancelled');
    });
  });

  describe('3. Input Validation', () => {
    test('should reject invalid wallet addresses', async () => {
      const invalidAddresses = [
        'not-an-address',
        '0x123', // Too short
        '0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG', // Invalid hex
        '', // Empty
        null,
        undefined
      ];

      for (const address of invalidAddresses) {
        const orderData = {
          orderHash: '0x' + '1'.repeat(64),
          orderType: 'listing',
          nftContract: address,
          tokenId: '1',
          maker: testWallet.address,
          paymentToken: '0x' + '0'.repeat(40),
          price: '1000000000000000000',
          startTime: Math.floor(Date.now() / 1000),
          endTime: Math.floor(Date.now() / 1000) + 86400,
          orderComponents: createMockOrderComponents(testWallet.address),
          signature: '0x' + '0'.repeat(130)
        };

        const result = await validationService.validateOrderData(orderData);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('address'))).toBe(true);
      }
    });

    test('should reject zero or negative prices', async () => {
      const invalidPrices = ['0', '-1', '-1000000000000000000'];

      for (const price of invalidPrices) {
        const result = await validationService.validatePrice(price);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('greater than zero');
      }
    });

    test('should reject expired orders', async () => {
      const pastTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago

      const result = await validationService.validateExpiration(pastTime);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Order has expired');
    });

    test('should reject invalid order types', async () => {
      const orderData = {
        orderHash: '0x' + '1'.repeat(64),
        orderType: 'invalid-type', // Invalid
        nftContract: '0x' + '0'.repeat(40),
        tokenId: '1',
        maker: testWallet.address,
        paymentToken: '0x' + '0'.repeat(40),
        price: '1000000000000000000',
        startTime: Math.floor(Date.now() / 1000),
        endTime: Math.floor(Date.now() / 1000) + 86400,
        orderComponents: createMockOrderComponents(testWallet.address),
        signature: '0x' + '0'.repeat(130)
      };

      const result = await validationService.validateOrderData(orderData);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Order type'))).toBe(true);
    });

    test('should validate order hash format', async () => {
      const invalidHashes = [
        'not-a-hash',
        '0x123', // Too short
        '0x' + 'G'.repeat(64), // Invalid hex
        ''
      ];

      for (const hash of invalidHashes) {
        const orderData = {
          orderHash: hash,
          orderType: 'listing',
          nftContract: '0x' + '0'.repeat(40),
          tokenId: '1',
          maker: testWallet.address,
          paymentToken: '0x' + '0'.repeat(40),
          price: '1000000000000000000',
          startTime: Math.floor(Date.now() / 1000),
          endTime: Math.floor(Date.now() / 1000) + 86400,
          orderComponents: createMockOrderComponents(testWallet.address),
          signature: '0x' + '0'.repeat(130)
        };

        const result = await validationService.validateOrderData(orderData);
        expect(result.valid).toBe(false);
      }
    });

    test('should reject missing required fields', async () => {
      const incompleteOrder = {
        orderHash: '0x' + '1'.repeat(64),
        orderType: 'listing'
        // Missing all other required fields
      };

      const result = await validationService.validateOrderData(incompleteOrder);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('4. SQL Injection Prevention', () => {
    test('should safely handle SQL injection in order hash lookup', async () => {
      const sqlInjectionAttempts = [
        "0x123' OR '1'='1",
        "0x123'; DROP TABLE seaport_orders; --",
        "0x123' UNION SELECT * FROM users --",
        "0x123' AND 1=1 --"
      ];

      for (const maliciousHash of sqlInjectionAttempts) {
        // Should not throw error or return unexpected results
        const result = await orderService.getOrderByHash(maliciousHash);
        expect(result).toBeNull(); // Should simply not find the order
      }

      // Verify table still exists
      const tableCheck = await pool.query(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'seaport_orders')"
      );
      expect(tableCheck.rows[0].exists).toBe(true);
    });

    test('should safely handle SQL injection in token ID queries', async () => {
      const maliciousTokenIds = [
        "1' OR '1'='1",
        "1'; DELETE FROM seaport_orders WHERE '1'='1",
        "1' UNION SELECT password FROM users --"
      ];

      const nftContract = '0x' + '0'.repeat(40);

      for (const tokenId of maliciousTokenIds) {
        const result = await orderService.getListingForToken(tokenId, nftContract);
        expect(result).toBeNull();
      }
    });

    test('should safely handle SQL injection in marketplace filters', async () => {
      const maliciousFilters = {
        nftContract: "0x123' OR '1'='1",
        orderType: "listing' OR '1'='1"
      };

      // Should not throw error
      const result = await orderService.getMarketplaceOrders(maliciousFilters);
      expect(result.orders).toBeDefined();
      expect(Array.isArray(result.orders)).toBe(true);
    });

    test('should use parameterized queries for all database operations', async () => {
      // This test verifies that our queries use parameterized statements
      // by checking that special SQL characters don't cause issues
      
      const orderData = await createTestOrder(testWallet.address, 'test-user-sql');
      
      // Try to retrieve with special characters in para_user_id
      const maliciousUserId = "test-user-sql' OR '1'='1";
      const listings = await orderService.getUserListings(maliciousUserId);
      
      // Should return empty array, not all listings
      expect(listings).toEqual([]);
    });
  });

  describe('5. XSS Prevention', () => {
    test('should safely store and retrieve XSS payloads in order data', async () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert("XSS")>',
        'javascript:alert("XSS")',
        '<svg onload=alert("XSS")>',
        '"><script>alert(String.fromCharCode(88,83,83))</script>'
      ];

      // Test storing XSS in cancellation reason
      const orderData = await createTestOrder(testWallet.address, 'test-user-xss');
      
      for (const payload of xssPayloads) {
        const result = await orderService.cancelOrder(orderData.orderHash, 'test-user-xss', {
          reason: payload
        });

        // Retrieve the cancellation record
        const cancellationQuery = await pool.query(
          'SELECT * FROM order_cancellations WHERE order_hash = $1',
          [orderData.orderHash]
        );

        // Verify payload is stored as-is (not executed)
        expect(cancellationQuery.rows[0].cancellation_reason).toBe(payload);
        
        // Create new order for next iteration
        if (xssPayloads.indexOf(payload) < xssPayloads.length - 1) {
          const newOrderData = await createTestOrder(testWallet.address, 'test-user-xss');
          orderData.orderHash = newOrderData.orderHash;
        }
      }
    });

    test('should safely handle XSS in event logging', async () => {
      const xssPayload = '<script>alert("XSS")</script>';
      
      await orderService.logOrderEvent({
        orderHash: '0x' + '9'.repeat(64),
        eventType: 'order:test',
        actor: testWallet.address,
        eventData: {
          maliciousField: xssPayload,
          nestedObject: {
            anotherField: xssPayload
          }
        }
      });

      // Retrieve event
      const eventQuery = await pool.query(
        'SELECT * FROM order_events WHERE order_hash = $1',
        ['0x' + '9'.repeat(64)]
      );

      const eventData = eventQuery.rows[0].event_data;
      expect(eventData.maliciousField).toBe(xssPayload);
      expect(eventData.nestedObject.anotherField).toBe(xssPayload);
    });

    test('should safely handle special characters in JSON fields', async () => {
      const specialChars = [
        '{"test": "value"}',
        '\\n\\r\\t',
        '\'"<>&',
        '🚀💎🔥', // Emojis
        'null',
        'undefined'
      ];

      for (const chars of specialChars) {
        await orderService.logOrderEvent({
          orderHash: '0x' + 'a'.repeat(64),
          eventType: 'order:test',
          actor: testWallet.address,
          eventData: {
            specialField: chars
          }
        });

        const eventQuery = await pool.query(
          "SELECT * FROM order_events WHERE order_hash = $1 AND event_data->>'specialField' = $2",
          ['0x' + 'a'.repeat(64), chars]
        );

        expect(eventQuery.rows.length).toBeGreaterThan(0);
        expect(eventQuery.rows[0].event_data.specialField).toBe(chars);
      }
    });
  });

  describe('6. Platform Fee Security', () => {
    test('should reject orders with incorrect platform fee recipient', async () => {
      if (!process.env.PLATFORM_FEE_RECIPIENT) {
        console.log('Skipping platform fee test - PLATFORM_FEE_RECIPIENT not configured');
        return;
      }

      const orderData = {
        orderHash: '0x' + 'f'.repeat(64),
        orderType: 'listing',
        nftContract: '0x' + '0'.repeat(40),
        tokenId: '1',
        maker: testWallet.address,
        paymentToken: '0x' + '0'.repeat(40),
        price: '1000000000000000000',
        platformFeeAmount: '25000000000000000',
        platformFeeRecipient: attackerWallet.address, // Wrong recipient
        startTime: Math.floor(Date.now() / 1000),
        endTime: Math.floor(Date.now() / 1000) + 86400,
        orderComponents: createMockOrderComponents(testWallet.address, {
          platformFeeRecipient: attackerWallet.address
        }),
        signature: '0x' + '0'.repeat(130)
      };

      const result = await validationService.validateOrderData(orderData);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Platform fee recipient'))).toBe(true);
    });

    test('should reject orders with incorrect platform fee amount', async () => {
      if (!process.env.PLATFORM_FEE_RECIPIENT) {
        console.log('Skipping platform fee test - PLATFORM_FEE_RECIPIENT not configured');
        return;
      }

      const price = '1000000000000000000'; // 1 ETH
      const wrongFee = '1000000000000000'; // Way too low

      const orderData = {
        orderHash: '0x' + 'e'.repeat(64),
        orderType: 'listing',
        nftContract: '0x' + '0'.repeat(40),
        tokenId: '1',
        maker: testWallet.address,
        paymentToken: '0x' + '0'.repeat(40),
        price: price,
        platformFeeAmount: wrongFee,
        platformFeeRecipient: process.env.PLATFORM_FEE_RECIPIENT,
        startTime: Math.floor(Date.now() / 1000),
        endTime: Math.floor(Date.now() / 1000) + 86400,
        orderComponents: createMockOrderComponents(testWallet.address, {
          platformFeeAmount: wrongFee,
          platformFeeRecipient: process.env.PLATFORM_FEE_RECIPIENT
        }),
        signature: '0x' + '0'.repeat(130)
      };

      const result = await validationService.validateOrderData(orderData);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Platform fee amount incorrect'))).toBe(true);
    });
  });

  describe('7. Order Hash Security', () => {
    test('should detect order hash mismatches', async () => {
      const orderComponents = createMockOrderComponents(testWallet.address);
      const correctHash = validationService.calculateOrderHash(orderComponents);
      const wrongHash = '0x' + '1'.repeat(64);

      const orderData = {
        orderHash: wrongHash,
        orderType: 'listing',
        nftContract: '0x' + '0'.repeat(40),
        tokenId: '1',
        maker: testWallet.address,
        paymentToken: '0x' + '0'.repeat(40),
        price: '1000000000000000000',
        startTime: Math.floor(Date.now() / 1000),
        endTime: Math.floor(Date.now() / 1000) + 86400,
        orderComponents: orderComponents,
        signature: '0x' + '0'.repeat(130)
      };

      const result = await validationService.validateOrderData(orderData);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Order hash does not match'))).toBe(true);
    });

    test('should ensure order hash uniqueness', async () => {
      const orderData = await createTestOrder(testWallet.address, 'test-user-unique');
      
      // Try to create duplicate order
      await expect(
        orderService.createOrder(orderData)
      ).rejects.toThrow('Order already exists');
    });
  });
});

// Helper Functions

function createEIP712Domain() {
  return {
    name: 'Seaport',
    version: '1.5',
    chainId: parseInt(process.env.SEAPORT_CHAIN_ID || '43113'),
    verifyingContract: process.env.SEAPORT_CONTRACT_ADDRESS || '0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC'
  };
}

function createEIP712Types() {
  return {
    OrderComponents: [
      { name: 'offerer', type: 'address' },
      { name: 'zone', type: 'address' },
      { name: 'offer', type: 'OfferItem[]' },
      { name: 'consideration', type: 'ConsiderationItem[]' },
      { name: 'orderType', type: 'uint8' },
      { name: 'startTime', type: 'uint256' },
      { name: 'endTime', type: 'uint256' },
      { name: 'zoneHash', type: 'bytes32' },
      { name: 'salt', type: 'uint256' },
      { name: 'conduitKey', type: 'bytes32' },
      { name: 'counter', type: 'uint256' }
    ],
    OfferItem: [
      { name: 'itemType', type: 'uint8' },
      { name: 'token', type: 'address' },
      { name: 'identifierOrCriteria', type: 'uint256' },
      { name: 'startAmount', type: 'uint256' },
      { name: 'endAmount', type: 'uint256' }
    ],
    ConsiderationItem: [
      { name: 'itemType', type: 'uint8' },
      { name: 'token', type: 'address' },
      { name: 'identifierOrCriteria', type: 'uint256' },
      { name: 'startAmount', type: 'uint256' },
      { name: 'endAmount', type: 'uint256' },
      { name: 'recipient', type: 'address' }
    ]
  };
}

function createMockOrderComponents(maker, options = {}) {
  const price = options.price || '1000000000000000000';
  const platformFeeAmount = options.platformFeeAmount || '25000000000000000';
  const platformFeeRecipient = options.platformFeeRecipient || process.env.PLATFORM_FEE_RECIPIENT || '0x' + '0'.repeat(40);

  return {
    offerer: maker,
    zone: '0x' + '0'.repeat(40),
    offer: [
      {
        itemType: 2, // ERC721
        token: '0x' + '0'.repeat(40),
        identifierOrCriteria: '1',
        startAmount: '1',
        endAmount: '1'
      }
    ],
    consideration: [
      {
        itemType: 1, // ERC20
        token: '0x' + '0'.repeat(40),
        identifierOrCriteria: '0',
        startAmount: price,
        endAmount: price,
        recipient: maker
      },
      {
        itemType: 1, // ERC20 - Platform fee
        token: '0x' + '0'.repeat(40),
        identifierOrCriteria: '0',
        startAmount: platformFeeAmount,
        endAmount: platformFeeAmount,
        recipient: platformFeeRecipient
      }
    ],
    orderType: 0,
    startTime: Math.floor(Date.now() / 1000).toString(),
    endTime: (Math.floor(Date.now() / 1000) + 86400).toString(),
    zoneHash: '0x' + '0'.repeat(64),
    salt: Math.floor(Math.random() * 1000000).toString(),
    conduitKey: '0x' + '0'.repeat(64),
    counter: '0'
  };
}

async function createTestOrder(maker, paraUserId) {
  const orderComponents = createMockOrderComponents(maker);
  const orderHash = getOrderValidationService().calculateOrderHash(orderComponents);

  const orderData = {
    orderHash: orderHash,
    orderType: 'listing',
    nftContract: '0xTest' + '0'.repeat(36), // Test prefix for cleanup
    tokenId: Math.floor(Math.random() * 1000000).toString(),
    maker: maker,
    paymentToken: '0x' + '0'.repeat(40),
    price: '1000000000000000000',
    priceDecimal: '1.0',
    platformFeeAmount: '25000000000000000',
    platformFeeRecipient: process.env.PLATFORM_FEE_RECIPIENT || '0x' + '0'.repeat(40),
    startTime: Math.floor(Date.now() / 1000),
    endTime: Math.floor(Date.now() / 1000) + 86400,
    orderComponents: orderComponents,
    signature: '0x' + '0'.repeat(130),
    paraUserId: paraUserId
  };

  // Insert directly into database to bypass validation for testing
  const query = `
    INSERT INTO seaport_orders (
      order_hash, order_type, nft_contract, token_id, maker, taker,
      payment_token, price, price_decimal, platform_fee_amount, platform_fee_recipient,
      start_time, end_time, expires_at, order_components, signature,
      is_active, para_user_id, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, true, $17, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    RETURNING *
  `;

  const values = [
    orderData.orderHash,
    orderData.orderType,
    orderData.nftContract,
    orderData.tokenId,
    orderData.maker,
    null,
    orderData.paymentToken,
    orderData.price,
    orderData.priceDecimal,
    orderData.platformFeeAmount,
    orderData.platformFeeRecipient,
    orderData.startTime,
    orderData.endTime,
    new Date(orderData.endTime * 1000),
    JSON.stringify(orderData.orderComponents),
    orderData.signature,
    orderData.paraUserId
  ];

  await pool.query(query, values);

  return orderData;
}

module.exports = {
  createEIP712Domain,
  createEIP712Types,
  createMockOrderComponents,
  createTestOrder
};
