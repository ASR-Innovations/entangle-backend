const express = require('express');
const Joi = require('joi');
const { authenticateToken } = require('../middleware/auth');
const { getOrderService } = require('../services/OrderService');
const logger = require('../utils/logger');
const { asyncHandler, formatValidationError } = require('../middleware/errorHandler');
const {
  ValidationError,
  NotFoundError
} = require('../utils/errors');

const router = express.Router();

/**
 * Validation Schemas
 * Requirement: 12.1-12.5
 */

// Seaport order components schema
const offerItemSchema = Joi.object({
  itemType: Joi.number().integer().min(0).max(5).required(),
  token: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  identifierOrCriteria: Joi.string().required(),
  startAmount: Joi.string().required(),
  endAmount: Joi.string().required()
});

const considerationItemSchema = Joi.object({
  itemType: Joi.number().integer().min(0).max(5).required(),
  token: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  identifierOrCriteria: Joi.string().required(),
  startAmount: Joi.string().required(),
  endAmount: Joi.string().required(),
  recipient: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required()
});

const orderComponentsSchema = Joi.object({
  offerer: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  zone: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  offer: Joi.array().items(offerItemSchema).min(1).required(),
  consideration: Joi.array().items(considerationItemSchema).min(1).required(),
  orderType: Joi.number().integer().min(0).max(4).required(),
  startTime: Joi.alternatives().try(Joi.string(), Joi.number().integer()).required(),
  endTime: Joi.alternatives().try(Joi.string(), Joi.number().integer()).required(),
  zoneHash: Joi.string().pattern(/^0x[a-fA-F0-9]{64}$/).required(),
  salt: Joi.string().required(),
  conduitKey: Joi.string().pattern(/^0x[a-fA-F0-9]{64}$/).required(),
  counter: Joi.string().required()
});

// Create order schema
const createOrderSchema = Joi.object({
  orderHash: Joi.string().pattern(/^0x[a-fA-F0-9]{64}$/).required(),
  orderType: Joi.string().valid('listing', 'offer').required(),
  nftContract: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  tokenId: Joi.string().required(),
  maker: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  taker: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).optional().allow(null),
  paymentToken: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  price: Joi.string().required(),
  priceDecimal: Joi.string().optional().allow(null),
  platformFeeAmount: Joi.string().optional().allow(null),
  platformFeeRecipient: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).optional().allow(null),
  startTime: Joi.number().integer().required(),
  endTime: Joi.number().integer().required(),
  orderComponents: orderComponentsSchema.required(),
  signature: Joi.string().required()
});

// Query parameters schema
const paginationSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(50),
  offset: Joi.number().integer().min(0).default(0)
});

const offersQuerySchema = paginationSchema.keys({
  nftContract: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  sort: Joi.string().valid('price_asc', 'price_desc', 'recent').default('price_desc')
});

const marketplaceQuerySchema = paginationSchema.keys({
  orderType: Joi.string().valid('listing', 'offer').optional(),
  nftContract: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).optional(),
  sortBy: Joi.string().valid('created_at', 'price', 'expires_at').default('created_at'),
  sortOrder: Joi.string().valid('ASC', 'DESC').default('DESC')
});

/**
 * POST /api/orders/listings/create
 * Create a new listing order
 * Requirements: 2.1-2.7, 11.1
 */
router.post('/listings/create', authenticateToken, asyncHandler(async (req, res) => {
  logger.info('📝 POST /api/orders/listings/create - Creating new listing');
  logger.info('User:', { paraUserId: req.user.paraUserId, walletAddress: req.user.walletAddress });

  // Validate request body
  const { error, value } = createOrderSchema.validate(req.body);
  if (error) {
    logger.warn('Validation error:', error.details[0].message);
    return res.status(400).json(formatValidationError(error));
  }

  // Ensure order type is listing
  if (value.orderType !== 'listing') {
    throw new ValidationError('Invalid order type', 'This endpoint only accepts listing orders');
  }

  // Add para user ID to order data
  const orderData = {
    ...value,
    paraUserId: req.user.paraUserId
  };

  // Create order
  const orderService = getOrderService();
  const order = await orderService.createOrder(orderData);

  // Broadcast order creation via Socket.IO
  // Requirement: 4.1 - Broadcast new orders to all connected clients
  try {
    const { getOrderSocketService } = require('../services/OrderSocketService');
    const orderSocketService = getOrderSocketService();
    orderSocketService.broadcastOrderCreated({
      orderHash: order.orderHash,
      orderType: order.orderType,
      tokenId: order.tokenId,
      nftContract: order.nftContract,
      maker: order.maker,
      price: order.price,
      paymentToken: order.paymentToken
    });
  } catch (error) {
    logger.warn('Failed to broadcast order creation:', error.message);
  }

  logger.info('✅ Listing created successfully', { orderHash: order.orderHash });

  res.status(201).json({
    success: true,
    order,
    message: 'Listing created successfully'
  });
}));

/**
 * POST /api/orders/offers/create
 * Create a new offer order
 * Requirements: 2.1-2.7, 11.1
 */
router.post('/offers/create', authenticateToken, asyncHandler(async (req, res) => {
  logger.info('📝 POST /api/orders/offers/create - Creating new offer');
  logger.info('User:', { paraUserId: req.user.paraUserId, walletAddress: req.user.walletAddress });
  
  // Log received order components for debugging
  logger.debug('Received orderComponents:', {
    offerer: req.body.orderComponents?.offerer,
    startTime: req.body.orderComponents?.startTime,
    startTimeType: typeof req.body.orderComponents?.startTime,
    maker: req.body.maker,
    orderHash: req.body.orderHash
  });

  // Validate request body
  const { error, value } = createOrderSchema.validate(req.body);
  if (error) {
    logger.warn('Validation error:', error.details[0].message);
    return res.status(400).json(formatValidationError(error));
  }

  // Ensure order type is offer
  if (value.orderType !== 'offer') {
    throw new ValidationError('Invalid order type', 'This endpoint only accepts offer orders');
  }

  // Add para user ID to order data
  const orderData = {
    ...value,
    paraUserId: req.user.paraUserId
  };

  // Create order
  const orderService = getOrderService();
  const order = await orderService.createOrder(orderData);

  // Broadcast order creation via Socket.IO
  // Requirement: 4.1 - Broadcast new orders to all connected clients
  try {
    const { getOrderSocketService } = require('../services/OrderSocketService');
    const orderSocketService = getOrderSocketService();
    orderSocketService.broadcastOrderCreated({
      orderHash: order.orderHash,
      orderType: order.orderType,
      tokenId: order.tokenId,
      nftContract: order.nftContract,
      maker: order.maker,
      price: order.price,
      paymentToken: order.paymentToken
    });
  } catch (error) {
    logger.warn('Failed to broadcast order creation:', error.message);
  }

  logger.info('✅ Offer created successfully', { orderHash: order.orderHash });

  res.status(201).json({
    success: true,
    order,
    message: 'Offer created successfully'
  });
}));

/**
 * GET /api/orders/listings/:tokenId
 * Get active listing for a specific NFT token
 * Requirements: 3.1, 11.4
 */
router.get('/listings/:tokenId', asyncHandler(async (req, res) => {
  const { tokenId } = req.params;
  const { nftContract } = req.query;

  if (!nftContract) {
    throw new ValidationError('Missing required parameter', 'nftContract query parameter is required');
  }

  logger.info(`📊 GET /api/orders/listings/${tokenId} - Fetching listing`);

  const orderService = getOrderService();
  const listing = await orderService.getListingForToken(tokenId, nftContract);

  if (!listing) {
    return res.status(404).json({
      success: false,
      error: 'No active listing found',
      listing: null
    });
  }

  logger.info('✅ Listing found', { orderHash: listing.orderHash });

  res.json({
    success: true,
    listing
  });
}));

/**
 * GET /api/orders/offers/:tokenId
 * Get active offers for a specific NFT token
 * Requirements: 3.2, 3.7, 11.4
 */
router.get('/offers/:tokenId', asyncHandler(async (req, res) => {
  const { tokenId } = req.params;
  const { nftContract } = req.query;

  if (!nftContract) {
    throw new ValidationError('Missing required parameter', 'nftContract query parameter is required');
  }

  // Validate query parameters
  const { error, value } = offersQuerySchema.validate(req.query);
  if (error) {
    return res.status(400).json(formatValidationError(error));
  }

  logger.info(`📊 GET /api/orders/offers/${tokenId} - Fetching offers`);

  const orderService = getOrderService();
  const result = await orderService.getOffersForToken(tokenId, nftContract, {
    limit: value.limit,
    offset: value.offset,
    sort: value.sort
  });

  logger.info(`✅ Found ${result.offers.length} offers`);

  res.json({
    success: true,
    offers: result.offers,
    total: result.total,
    limit: result.limit,
    offset: result.offset
  });
}));

/**
 * GET /api/orders/user/listings
 * Get all active listings for the authenticated user
 * Requirements: 3.3, 11.3
 */
router.get('/user/listings', authenticateToken, asyncHandler(async (req, res) => {
  const { paraUserId } = req.user;

  logger.info(`📊 GET /api/orders/user/listings - Fetching user listings for ${paraUserId}`);

  const orderService = getOrderService();
  const listings = await orderService.getUserListings(paraUserId);

  logger.info(`✅ Found ${listings.length} listings`);

  res.json({
    success: true,
    listings,
    total: listings.length
  });
}));

/**
 * GET /api/orders/user/offers
 * Get all active offers for the authenticated user
 * Requirements: 3.4, 11.3
 */
router.get('/user/offers', authenticateToken, asyncHandler(async (req, res) => {
  const { paraUserId } = req.user;

  logger.info(`📊 GET /api/orders/user/offers - Fetching user offers for ${paraUserId}`);

  const orderService = getOrderService();
  const offers = await orderService.getUserOffers(paraUserId);

  logger.info(`✅ Found ${offers.length} offers`);

  res.json({
    success: true,
    offers,
    total: offers.length
  });
}));

/**
 * DELETE /api/orders/:orderHash/cancel
 * Cancel an order
 * Requirements: 5.1-5.5, 11.2
 */
router.delete('/:orderHash/cancel', authenticateToken, asyncHandler(async (req, res) => {
  const { orderHash } = req.params;
  const { reason, transactionHash } = req.body;
  const { paraUserId } = req.user;

  logger.info(`🗑️  DELETE /api/orders/${orderHash}/cancel - Cancelling order`);
  logger.info('User:', { paraUserId });

  const orderService = getOrderService();
  const result = await orderService.cancelOrder(orderHash, paraUserId, {
    reason,
    transactionHash
  });

  // Broadcast cancellation via Socket.IO
  // Requirement: 4.2 - Broadcast cancellations to all connected clients
  try {
    const { getOrderSocketService } = require('../services/OrderSocketService');
    const orderSocketService = getOrderSocketService();
    orderSocketService.broadcastOrderCancelled({
      orderHash: result.order.orderHash,
      orderType: result.order.orderType,
      tokenId: result.order.tokenId,
      nftContract: result.order.nftContract,
      maker: result.order.maker
    });
  } catch (error) {
    logger.warn('Failed to broadcast order cancellation:', error.message);
  }

  logger.info('✅ Order cancelled successfully', { orderHash });

  res.json({
    success: true,
    order: result.order,
    message: 'Order cancelled successfully'
  });
}));

/**
 * POST /api/orders/:orderHash/fulfill
 * Record order fulfillment (called after on-chain fulfillment)
 * Requirements: 6.1-6.5, 11.1
 */
router.post('/:orderHash/fulfill', authenticateToken, asyncHandler(async (req, res) => {
  const { orderHash } = req.params;
  const { fulfiller, transactionHash, blockNumber, amountPaid, platformFeePaid } = req.body;

  // Validate required fields
  if (!fulfiller || !transactionHash || !blockNumber) {
    throw new ValidationError('Missing required fields', 'fulfiller, transactionHash, and blockNumber are required');
  }

  logger.info(`✅ POST /api/orders/${orderHash}/fulfill - Recording fulfillment`);
  logger.info('Fulfillment data:', { fulfiller, transactionHash, blockNumber });

  const orderService = getOrderService();
  const result = await orderService.fulfillOrder(orderHash, {
    fulfiller,
    transactionHash,
    blockNumber,
    amountPaid,
    platformFeePaid
  });

  // Broadcast fulfillment via Socket.IO
  // Requirement: 4.3 - Broadcast fulfillments to all connected clients
  try {
    const { getOrderSocketService } = require('../services/OrderSocketService');
    const orderSocketService = getOrderSocketService();
    orderSocketService.broadcastOrderFulfilled({
      orderHash: result.order.orderHash,
      orderType: result.order.orderType,
      tokenId: result.order.tokenId,
      nftContract: result.order.nftContract,
      maker: result.order.maker,
      fulfiller: result.order.fulfilledBy,
      transactionHash: result.order.fulfillmentTxHash
    });
  } catch (error) {
    logger.warn('Failed to broadcast order fulfillment:', error.message);
  }

  logger.info('✅ Order fulfillment recorded successfully', { orderHash });

  res.json({
    success: true,
    order: result.order,
    message: result.alreadyFulfilled ? 'Order already fulfilled' : 'Order fulfillment recorded successfully'
  });
}));

/**
 * GET /api/orders/marketplace
 * Get marketplace orders with filtering and pagination
 * Requirements: 9.1-9.5, 11.4
 */
router.get('/marketplace', asyncHandler(async (req, res) => {
  // Validate query parameters
  const { error, value } = marketplaceQuerySchema.validate(req.query);
  if (error) {
    return res.status(400).json(formatValidationError(error));
  }

  logger.info('📊 GET /api/orders/marketplace - Fetching marketplace orders');
  logger.info('Query params:', value);

  const orderService = getOrderService();
  const result = await orderService.getMarketplaceOrders({
    limit: value.limit,
    offset: value.offset,
    orderType: value.orderType,
    nftContract: value.nftContract,
    sortBy: value.sortBy,
    sortOrder: value.sortOrder
  });

  logger.info(`✅ Found ${result.orders.length} marketplace orders`);

  res.json({
    success: true,
    orders: result.orders,
    total: result.total,
    limit: result.limit,
    offset: result.offset
  });
}));

/**
 * GET /api/orders/:orderHash
 * Get order by hash
 * Requirements: 3.1, 11.4
 */
router.get('/:orderHash', asyncHandler(async (req, res) => {
  const { orderHash } = req.params;

  logger.info(`📊 GET /api/orders/${orderHash} - Fetching order`);

  const orderService = getOrderService();
  const order = await orderService.getOrderByHash(orderHash);

  if (!order) {
    throw new NotFoundError('Order');
  }

  logger.info('✅ Order found', { orderHash });

  res.json({
    success: true,
    order
  });
}));

module.exports = router;
