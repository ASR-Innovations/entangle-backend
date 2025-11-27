const { pool } = require('../config/database');
const { getOrderValidationService } = require('./OrderValidationService');
const logger = require('../utils/logger');
const {
  ValidationError,
  NotFoundError,
  AuthorizationError,
  DuplicateOrderError,
  OrderStateError,
  DatabaseError
} = require('../utils/errors');

/**
 * OrderService
 * 
 * Manages Seaport order operations including creation, retrieval, cancellation,
 * and fulfillment tracking. Handles database operations for the orderbook.
 * 
 * Requirements: 1.1, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 5.1, 5.2, 5.3, 6.3, 6.4, 9.1, 9.2, 9.3, 9.4, 9.5
 */
class OrderService {
  constructor() {
    this.validationService = getOrderValidationService();
    this.initialized = false;
  }

  async initialize() {
    if (!this.initialized) {
      await this.validationService.initialize();
      this.initialized = true;
      logger.info('OrderService initialized');
    }
  }

  /**
   * Create a new order (listing or offer)
   * Requirements: 1.1, 2.1-2.7
   * 
   * @param {Object} orderData - Complete order data
   * @returns {Object} Created order
   */
  async createOrder(orderData) {
    try {
      await this.initialize();

      logger.info('Creating new order', {
        orderHash: orderData.orderHash,
        orderType: orderData.orderType,
        maker: orderData.maker
      });

      // Validate order data
      const validation = await this.validationService.validateOrderData(orderData);
      if (!validation.valid) {
        logger.warn('Order validation failed', { errors: validation.errors });
        
        // Log validation failure event (Requirement 8.4)
        await this.logOrderEvent({
          orderHash: orderData.orderHash || 'unknown',
          eventType: 'order:validation_failed',
          actor: orderData.maker || 'unknown',
          eventData: {
            errors: validation.errors,
            orderType: orderData.orderType
          }
        });
        
        throw new ValidationError(
          'Order validation failed',
          validation.errors.join(', ')
        );
      }

      // Check if order already exists
      const existingOrder = await this.getOrderByHash(orderData.orderHash);
      if (existingOrder) {
        throw new DuplicateOrderError(orderData.orderHash);
      }

      // Calculate expires_at timestamp from endTime
      const expiresAt = new Date(parseInt(orderData.endTime) * 1000);

      // Insert order into database
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
        orderData.taker || null,
        orderData.paymentToken,
        orderData.price,
        orderData.priceDecimal || null,
        orderData.platformFeeAmount || null,
        orderData.platformFeeRecipient || null,
        orderData.startTime,
        orderData.endTime,
        expiresAt,
        JSON.stringify(orderData.orderComponents),
        orderData.signature,
        orderData.paraUserId || null
      ];

      const result = await pool.query(query, values);
      const order = result.rows[0];

      // Log order creation event
      await this.logOrderEvent({
        orderHash: order.order_hash,
        eventType: 'order:created',
        actor: order.maker,
        eventData: {
          orderType: order.order_type,
          tokenId: order.token_id,
          price: order.price
        }
      });

      logger.info('Order created successfully', {
        orderHash: order.order_hash,
        orderType: order.order_type
      });

      return this.formatOrder(order);

    } catch (error) {
      // Re-throw custom errors as-is
      if (error.isOperational) {
        throw error;
      }
      
      // Wrap database errors
      logger.error('Failed to create order:', error);
      throw new DatabaseError('Failed to create order', error.message);
    }
  }

  /**
   * Get order by hash
   * Requirement: 3.1
   * 
   * @param {string} orderHash - Order hash
   * @returns {Object|null} Order or null if not found
   */
  async getOrderByHash(orderHash) {
    try {
      const query = 'SELECT * FROM seaport_orders WHERE order_hash = $1';
      const result = await pool.query(query, [orderHash]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.formatOrder(result.rows[0]);

    } catch (error) {
      logger.error('Failed to get order by hash:', error);
      throw new DatabaseError('Failed to retrieve order', error.message);
    }
  }

  /**
   * Get active listing for a specific token
   * Requirement: 3.1
   * 
   * @param {string} tokenId - NFT token ID
   * @param {string} nftContract - NFT contract address
   * @returns {Object|null} Listing or null if not found
   */
  async getListingForToken(tokenId, nftContract) {
    try {
      const query = `
        SELECT * FROM seaport_orders
        WHERE token_id = $1
          AND nft_contract = $2
          AND order_type = 'listing'
          AND is_active = true
          AND expires_at > CURRENT_TIMESTAMP
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const result = await pool.query(query, [tokenId, nftContract]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.formatOrder(result.rows[0]);

    } catch (error) {
      logger.error('Failed to get listing for token:', error);
      throw new DatabaseError('Failed to retrieve listing', error.message);
    }
  }

  /**
   * Get active offers for a specific token with sorting and pagination
   * Requirements: 3.2, 3.7
   * 
   * @param {string} tokenId - NFT token ID
   * @param {string} nftContract - NFT contract address
   * @param {Object} options - Query options (limit, offset, sort)
   * @returns {Object} Offers array and total count
   */
  async getOffersForToken(tokenId, nftContract, options = {}) {
    try {
      const {
        limit = 50,
        offset = 0,
        sort = 'price_desc' // price_asc, price_desc, recent
      } = options;

      // Determine sort order
      let orderBy = 'created_at DESC';
      if (sort === 'price_asc') {
        orderBy = 'CAST(price AS NUMERIC) ASC';
      } else if (sort === 'price_desc') {
        orderBy = 'CAST(price AS NUMERIC) DESC';
      }

      // Get offers
      const query = `
        SELECT * FROM seaport_orders
        WHERE token_id = $1
          AND nft_contract = $2
          AND order_type = 'offer'
          AND is_active = true
          AND expires_at > CURRENT_TIMESTAMP
        ORDER BY ${orderBy}
        LIMIT $3 OFFSET $4
      `;

      const result = await pool.query(query, [tokenId, nftContract, limit, offset]);

      // Get total count
      const countQuery = `
        SELECT COUNT(*) FROM seaport_orders
        WHERE token_id = $1
          AND nft_contract = $2
          AND order_type = 'offer'
          AND is_active = true
          AND expires_at > CURRENT_TIMESTAMP
      `;

      const countResult = await pool.query(countQuery, [tokenId, nftContract]);
      const total = parseInt(countResult.rows[0].count);

      return {
        offers: result.rows.map(row => this.formatOrder(row)),
        total,
        limit,
        offset
      };

    } catch (error) {
      logger.error('Failed to get offers for token:', error);
      throw new DatabaseError('Failed to retrieve offers', error.message);
    }
  }

  /**
   * Get all active listings for a user
   * Requirement: 3.3
   * 
   * @param {string} paraUserId - Para user ID
   * @returns {Array} User's listings
   */
  async getUserListings(paraUserId) {
    try {
      const query = `
        SELECT * FROM seaport_orders
        WHERE para_user_id = $1
          AND order_type = 'listing'
          AND is_active = true
          AND expires_at > CURRENT_TIMESTAMP
        ORDER BY created_at DESC
      `;

      const result = await pool.query(query, [paraUserId]);

      return result.rows.map(row => this.formatOrder(row));

    } catch (error) {
      logger.error('Failed to get user listings:', error);
      throw new DatabaseError('Failed to retrieve user listings', error.message);
    }
  }

  /**
   * Get all active offers for a user
   * Requirement: 3.4
   * 
   * @param {string} paraUserId - Para user ID
   * @returns {Array} User's offers
   */
  async getUserOffers(paraUserId) {
    try {
      const query = `
        SELECT * FROM seaport_orders
        WHERE para_user_id = $1
          AND order_type = 'offer'
          AND is_active = true
          AND expires_at > CURRENT_TIMESTAMP
        ORDER BY created_at DESC
      `;

      const result = await pool.query(query, [paraUserId]);

      return result.rows.map(row => this.formatOrder(row));

    } catch (error) {
      logger.error('Failed to get user offers:', error);
      throw new DatabaseError('Failed to retrieve user offers', error.message);
    }
  }

  /**
   * Cancel an order
   * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
   * 
   * @param {string} orderHash - Order hash
   * @param {string} userId - User ID (para_user_id)
   * @param {Object} options - Cancellation options
   * @returns {Object} Cancellation result
   */
  async cancelOrder(orderHash, userId, options = {}) {
    try {
      const {
        reason = null,
        transactionHash = null
      } = options;

      logger.info('Cancelling order', { orderHash, userId });

      // Get order
      const order = await this.getOrderByHash(orderHash);
      if (!order) {
        throw new NotFoundError('Order');
      }

      // Verify user is the maker (Requirement 5.1, 11.2)
      if (order.paraUserId !== userId) {
        throw new AuthorizationError('Only the order maker can cancel this order');
      }

      // Check if order is already fulfilled or cancelled (Requirement 5.5)
      if (order.isFulfilled) {
        throw new OrderStateError('Cannot cancel fulfilled order');
      }

      if (order.isCancelled) {
        throw new OrderStateError('Order already cancelled');
      }

      // Update order status
      const updateQuery = `
        UPDATE seaport_orders
        SET is_active = false,
            is_cancelled = true,
            cancelled_at = CURRENT_TIMESTAMP,
            cancellation_tx_hash = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE order_hash = $2
        RETURNING *
      `;

      const updateResult = await pool.query(updateQuery, [transactionHash, orderHash]);
      const updatedOrder = updateResult.rows[0];

      // Record cancellation (Requirement 5.3)
      const cancellationQuery = `
        INSERT INTO order_cancellations (
          order_hash, cancelled_by, transaction_hash, cancellation_reason, cancelled_at
        ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        RETURNING *
      `;

      await pool.query(cancellationQuery, [
        orderHash,
        order.maker,
        transactionHash,
        reason
      ]);

      // Log cancellation event (Requirement 5.4)
      await this.logOrderEvent({
        orderHash,
        eventType: 'order:cancelled',
        actor: order.maker,
        eventData: {
          reason,
          transactionHash
        }
      });

      logger.info('Order cancelled successfully', { orderHash });

      return {
        success: true,
        order: this.formatOrder(updatedOrder)
      };

    } catch (error) {
      // Re-throw custom errors as-is
      if (error.isOperational) {
        throw error;
      }
      
      logger.error('Failed to cancel order:', error);
      throw new DatabaseError('Failed to cancel order', error.message);
    }
  }

  /**
   * Record order fulfillment
   * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 10.3
   * 
   * @param {string} orderHash - Order hash
   * @param {Object} fulfillmentData - Fulfillment details
   * @returns {Object} Fulfillment result
   */
  async fulfillOrder(orderHash, fulfillmentData) {
    try {
      const {
        fulfiller,
        transactionHash,
        blockNumber,
        amountPaid = null,
        platformFeePaid = null
      } = fulfillmentData;

      logger.info('Recording order fulfillment', { orderHash, fulfiller });

      // Get order
      const order = await this.getOrderByHash(orderHash);
      if (!order) {
        throw new NotFoundError('Order');
      }

      // Check if already fulfilled
      if (order.isFulfilled) {
        logger.warn('Order already fulfilled', { orderHash });
        return {
          success: true,
          order: order,
          alreadyFulfilled: true
        };
      }

      // Verify platform fee was paid if configured (Requirement 10.3)
      if (order.platformFeeAmount && platformFeePaid) {
        const expectedFee = BigInt(order.platformFeeAmount);
        const actualFeePaid = BigInt(platformFeePaid);
        
        // Allow some tolerance for rounding (within 1%)
        const tolerance = expectedFee / 100n;
        const difference = actualFeePaid > expectedFee 
          ? actualFeePaid - expectedFee 
          : expectedFee - actualFeePaid;

        if (difference > tolerance) {
          logger.warn('Platform fee mismatch on fulfillment', {
            orderHash,
            expectedFee: expectedFee.toString(),
            actualFeePaid: actualFeePaid.toString()
          });
          // Log but don't fail - the blockchain transaction already succeeded
        } else {
          logger.info('Platform fee verified on fulfillment', {
            orderHash,
            platformFeePaid: actualFeePaid.toString()
          });
        }
      }

      // Update order status (Requirement 6.2)
      const updateQuery = `
        UPDATE seaport_orders
        SET is_active = false,
            is_fulfilled = true,
            fulfilled_at = CURRENT_TIMESTAMP,
            fulfilled_by = $1,
            fulfillment_tx_hash = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE order_hash = $3
        RETURNING *
      `;

      const updateResult = await pool.query(updateQuery, [fulfiller, transactionHash, orderHash]);
      const updatedOrder = updateResult.rows[0];

      // Create fulfillment record (Requirements 6.3, 6.4)
      const fulfillmentQuery = `
        INSERT INTO order_fulfillments (
          order_hash, fulfiller, transaction_hash, block_number,
          amount_paid, platform_fee_paid, fulfilled_at
        ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
        RETURNING *
      `;

      await pool.query(fulfillmentQuery, [
        orderHash,
        fulfiller,
        transactionHash,
        blockNumber,
        amountPaid,
        platformFeePaid
      ]);

      // Log fulfillment event (Requirement 6.5)
      await this.logOrderEvent({
        orderHash,
        eventType: 'order:fulfilled',
        actor: fulfiller,
        eventData: {
          transactionHash,
          blockNumber,
          amountPaid,
          platformFeePaid
        }
      });

      logger.info('Order fulfillment recorded successfully', { orderHash });

      return {
        success: true,
        order: this.formatOrder(updatedOrder)
      };

    } catch (error) {
      // Re-throw custom errors as-is
      if (error.isOperational) {
        throw error;
      }
      
      logger.error('Failed to record order fulfillment:', error);
      throw new DatabaseError('Failed to record order fulfillment', error.message);
    }
  }

  /**
   * Get marketplace orders with filtering and pagination
   * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
   * 
   * @param {Object} options - Query options
   * @returns {Object} Orders array and total count
   */
  async getMarketplaceOrders(options = {}) {
    try {
      const {
        limit = 50,
        offset = 0,
        orderType = null, // 'listing' or 'offer'
        nftContract = null,
        sortBy = 'created_at',
        sortOrder = 'DESC'
      } = options;

      // Build WHERE clause
      const conditions = [
        'is_active = true',
        'expires_at > CURRENT_TIMESTAMP'
      ];

      const params = [];
      let paramIndex = 1;

      // Filter by order type (Requirement 9.5)
      if (orderType) {
        conditions.push(`order_type = $${paramIndex}`);
        params.push(orderType);
        paramIndex++;
      }

      // Filter by NFT contract (Requirement 9.4)
      if (nftContract) {
        conditions.push(`nft_contract = $${paramIndex}`);
        params.push(nftContract);
        paramIndex++;
      }

      const whereClause = conditions.join(' AND ');

      // Validate sort parameters
      const validSortColumns = ['created_at', 'price', 'expires_at'];
      const validSortOrders = ['ASC', 'DESC'];
      
      const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
      const sortDirection = validSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

      // Handle price sorting (convert to numeric)
      const orderByClause = sortColumn === 'price' 
        ? `CAST(price AS NUMERIC) ${sortDirection}`
        : `${sortColumn} ${sortDirection}`;

      // Get orders (Requirements 9.1, 9.2)
      const query = `
        SELECT * FROM seaport_orders
        WHERE ${whereClause}
        ORDER BY ${orderByClause}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      params.push(limit, offset);

      const result = await pool.query(query, params);

      // Get total count (Requirement 9.3)
      const countQuery = `
        SELECT COUNT(*) FROM seaport_orders
        WHERE ${whereClause}
      `;

      const countResult = await pool.query(countQuery, params.slice(0, paramIndex - 1));
      const total = parseInt(countResult.rows[0].count);

      return {
        orders: result.rows.map(row => this.formatOrder(row)),
        total,
        limit,
        offset
      };

    } catch (error) {
      logger.error('Failed to get marketplace orders:', error);
      throw new DatabaseError('Failed to retrieve marketplace orders', error.message);
    }
  }

  /**
   * Log order event
   * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
   * 
   * @param {Object} eventData - Event data
   */
  async logOrderEvent(eventData) {
    try {
      const {
        orderHash,
        eventType,
        actor,
        eventData: data
      } = eventData;

      const query = `
        INSERT INTO order_events (
          order_hash, event_type, actor, event_data, created_at
        ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      `;

      await pool.query(query, [
        orderHash,
        eventType,
        actor,
        JSON.stringify(data)
      ]);

      logger.debug('Order event logged', { orderHash, eventType });

    } catch (error) {
      logger.error('Failed to log order event:', error);
      // Don't throw - event logging failure shouldn't break the main operation
    }
  }

  /**
   * Format order for API response
   * 
   * @param {Object} row - Database row
   * @returns {Object} Formatted order
   */
  formatOrder(row) {
    return {
      orderHash: row.order_hash,
      orderType: row.order_type,
      nftContract: row.nft_contract,
      tokenId: row.token_id,
      maker: row.maker,
      taker: row.taker,
      paymentToken: row.payment_token,
      price: row.price,
      priceDecimal: row.price_decimal,
      platformFeeAmount: row.platform_fee_amount,
      platformFeeRecipient: row.platform_fee_recipient,
      startTime: row.start_time,
      endTime: row.end_time,
      expiresAt: row.expires_at,
      orderComponents: typeof row.order_components === 'string' 
        ? JSON.parse(row.order_components) 
        : row.order_components,
      signature: row.signature,
      isActive: row.is_active,
      isCancelled: row.is_cancelled,
      isFulfilled: row.is_fulfilled,
      fulfilledAt: row.fulfilled_at,
      fulfilledBy: row.fulfilled_by,
      fulfillmentTxHash: row.fulfillment_tx_hash,
      cancelledAt: row.cancelled_at,
      cancellationTxHash: row.cancellation_tx_hash,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      paraUserId: row.para_user_id
    };
  }
}

// Singleton instance
let orderService = null;

function getOrderService() {
  if (!orderService) {
    orderService = new OrderService();
  }
  return orderService;
}

module.exports = {
  OrderService,
  getOrderService
};
