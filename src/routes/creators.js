/**
 * Creator API Routes
 * Handles all creator-related endpoints
 */

const express = require('express');
const router = express.Router();
const CreatorService = require('../services/CreatorService');
const TokenService = require('../services/TokenService');
const TelegramService = require('../services/TelegramService');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /api/creators/trending
 * Get trending creators
 */
router.get('/trending', async (req, res) => {
  try {
    const creatorService = new CreatorService(pool);

    const options = {
      limit: Math.min(parseInt(req.query.limit) || 7, 50),
      sortBy: req.query.sortBy || 'volume',
      timeframe: req.query.timeframe || '24h'
    };

    const creators = await creatorService.getTrendingCreators(options);

    res.json({
      success: true,
      data: {
        creators,
        total: creators.length
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: `req_trending_${Date.now()}`
      }
    });

  } catch (error) {
    console.error('Error in GET /api/creators/trending:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trending creators',
      meta: {
        timestamp: new Date().toISOString(),
        requestId: `req_trending_${Date.now()}`
      }
    });
  }
});

/**
 * GET /api/creators/:address
 * Get creator profile
 */
router.get('/:address', async (req, res) => {
  try {
    const creatorService = new CreatorService(pool);

    const address = req.params.address;
    const options = {
      include: req.query.include ? req.query.include.split(',') : [],
      twitterUsername: req.query.twitter || null
    };

    const creator = await creatorService.getCreatorProfile(address, options);

    res.json({
      success: true,
      data: {
        creator
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: `req_profile_${Date.now()}`
      }
    });

  } catch (error) {
    console.error(`Error in GET /api/creators/${req.params.address}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch creator profile',
      meta: {
        timestamp: new Date().toISOString(),
        requestId: `req_profile_${Date.now()}`
      }
    });
  }
});

/**
 * GET /api/creators/:address/events
 * Get creator events/auctions
 */
router.get('/:address/events', async (req, res) => {
  try {
    const creatorService = new CreatorService(pool);

    const address = req.params.address;
    const options = {
      status: req.query.status || 'upcoming',
      limit: Math.min(parseInt(req.query.limit) || 10, 50),
      offset: parseInt(req.query.offset) || 0
    };

    const result = await creatorService.getCreatorEvents(address, options);

    res.json({
      success: true,
      data: result,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: `req_events_${Date.now()}`
      }
    });

  } catch (error) {
    console.error(`Error in GET /api/creators/${req.params.address}/events:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch creator events',
      meta: {
        timestamp: new Date().toISOString(),
        requestId: `req_events_${Date.now()}`
      }
    });
  }
});

/**
 * GET /api/creators/:address/stats
 * Get creator statistics
 */
router.get('/:address/stats', async (req, res) => {
  try {
    const address = req.params.address.toLowerCase();

    const result = await pool.query(`
      SELECT
        cp.twitter_followers_count as followers,
        ct.unique_traders as token_holders,
        cp.total_events_created as total_events,
        COALESCE(ct.volume_24h, '0') as volume_24h,
        ct.price_change_24h,
        ct.price_change_7d
      FROM creator_profiles cp
      LEFT JOIN creator_tokens ct ON cp.id = ct.creator_profile_id
      WHERE LOWER(cp.wallet_address) = $1
      LIMIT 1
    `, [address]);

    const stats = result.rows[0] || {
      followers: 0,
      token_holders: 0,
      total_events: 0,
      volume_24h: '0',
      price_change_24h: 0,
      price_change_7d: 0
    };

    res.json({
      success: true,
      data: { stats },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: `req_stats_${Date.now()}`
      }
    });

  } catch (error) {
    console.error(`Error in GET /api/creators/${req.params.address}/stats:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch creator stats',
      meta: {
        timestamp: new Date().toISOString(),
        requestId: `req_stats_${Date.now()}`
      }
    });
  }
});

/**
 * GET /api/creators/:identifier/token
 * Get token information
 */
router.get('/:identifier/token', async (req, res) => {
  try {
    const tokenService = new TokenService(pool);
    const identifier = req.params.identifier;

    const tokenInfo = await tokenService.getTokenInfo(identifier);

    if (!tokenInfo) {
      return res.status(404).json({
        success: false,
        error: 'Token not found',
        code: 'TOKEN_NOT_FOUND',
        meta: {
          timestamp: new Date().toISOString(),
          requestId: `req_token_${Date.now()}`
        }
      });
    }

    res.json({
      success: true,
      data: tokenInfo,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: `req_token_${Date.now()}`
      }
    });

  } catch (error) {
    console.error(`Error in GET /api/creators/${req.params.identifier}/token:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch token information',
      meta: {
        timestamp: new Date().toISOString(),
        requestId: `req_token_${Date.now()}`
      }
    });
  }
});

/**
 * GET /api/creators/:identifier/token/price-history
 * Get token price history
 */
router.get('/:identifier/token/price-history', async (req, res) => {
  try {
    const tokenService = new TokenService(pool);
    const identifier = req.params.identifier;

    const options = {
      interval: req.query.interval || '1h',
      limit: Math.min(parseInt(req.query.limit) || 100, 1000),
      from: req.query.from ? parseInt(req.query.from) : null,
      to: req.query.to ? parseInt(req.query.to) : null
    };

    const priceHistory = await tokenService.getPriceHistory(identifier, options);

    if (!priceHistory) {
      return res.status(404).json({
        success: false,
        error: 'Token not found',
        code: 'TOKEN_NOT_FOUND',
        meta: {
          timestamp: new Date().toISOString(),
          requestId: `req_price_history_${Date.now()}`
        }
      });
    }

    res.json({
      success: true,
      data: priceHistory,
      meta: {
        interval: options.interval,
        timeframe: options.interval === '1h' ? '24H' : 'Custom',
        dataPoints: priceHistory.priceHistory.length,
        from: options.from,
        to: options.to,
        timestamp: new Date().toISOString(),
        requestId: `req_price_history_${Date.now()}`
      }
    });

  } catch (error) {
    console.error(`Error in GET /api/creators/${req.params.identifier}/token/price-history:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch price history',
      meta: {
        timestamp: new Date().toISOString(),
        requestId: `req_price_history_${Date.now()}`
      }
    });
  }
});

/**
 * GET /api/creators/:identifier/token/holders
 * Get token holders
 */
router.get('/:identifier/token/holders', async (req, res) => {
  try {
    const tokenService = new TokenService(pool);
    const identifier = req.params.identifier;

    const options = {
      limit: Math.min(parseInt(req.query.limit) || 10, 100),
      offset: parseInt(req.query.offset) || 0
    };

    const result = await tokenService.getTokenHolders(identifier, options);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Token not found',
        code: 'TOKEN_NOT_FOUND',
        meta: {
          timestamp: new Date().toISOString(),
          requestId: `req_holders_${Date.now()}`
        }
      });
    }

    res.json({
      success: true,
      data: result.holders,
      meta: {
        totalHolders: result.pagination.total,
        limit: result.pagination.limit,
        offset: result.pagination.offset,
        timestamp: new Date().toISOString(),
        requestId: `req_holders_${Date.now()}`
      }
    });

  } catch (error) {
    console.error(`Error in GET /api/creators/${req.params.identifier}/token/holders:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch token holders',
      meta: {
        timestamp: new Date().toISOString(),
        requestId: `req_holders_${Date.now()}`
      }
    });
  }
});

/**
 * GET /api/creators/:identifier/token/transactions
 * Get token transactions
 */
router.get('/:identifier/token/transactions', async (req, res) => {
  try {
    const tokenService = new TokenService(pool);
    const identifier = req.params.identifier;

    const options = {
      type: req.query.type || 'all',
      limit: Math.min(parseInt(req.query.limit) || 20, 100),
      offset: parseInt(req.query.offset) || 0
    };

    const result = await tokenService.getTokenTransactions(identifier, options);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Token not found',
        code: 'TOKEN_NOT_FOUND',
        meta: {
          timestamp: new Date().toISOString(),
          requestId: `req_transactions_${Date.now()}`
        }
      });
    }

    res.json({
      success: true,
      data: result.transactions,
      meta: {
        total: result.pagination.total,
        limit: result.pagination.limit,
        offset: result.pagination.offset,
        type: result.pagination.type,
        timestamp: new Date().toISOString(),
        requestId: `req_transactions_${Date.now()}`
      }
    });

  } catch (error) {
    console.error(`Error in GET /api/creators/${req.params.identifier}/token/transactions:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch token transactions',
      meta: {
        timestamp: new Date().toISOString(),
        requestId: `req_transactions_${Date.now()}`
      }
    });
  }
});

/**
 * GET /api/creators/:identifier/telegram
 * Get Telegram room information
 */
router.get('/:identifier/telegram', async (req, res) => {
  try {
    const telegramService = new TelegramService(pool);
    const identifier = req.params.identifier;

    const roomInfo = await telegramService.getTelegramRoom(identifier);

    if (!roomInfo) {
      return res.status(404).json({
        success: false,
        error: 'Telegram room not found',
        code: 'TELEGRAM_ROOM_NOT_FOUND',
        meta: {
          timestamp: new Date().toISOString(),
          requestId: `req_telegram_${Date.now()}`
        }
      });
    }

    res.json({
      success: true,
      data: roomInfo,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: `req_telegram_${Date.now()}`
      }
    });

  } catch (error) {
    console.error(`Error in GET /api/creators/${req.params.identifier}/telegram:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Telegram room information',
      meta: {
        timestamp: new Date().toISOString(),
        requestId: `req_telegram_${Date.now()}`
      }
    });
  }
});

/**
 * POST /api/creators/:identifier/telegram/purchase
 * Purchase Telegram access
 */
router.post('/:identifier/telegram/purchase', authenticateToken, async (req, res) => {
  try {
    const telegramService = new TelegramService(pool);
    const identifier = req.params.identifier;

    const { durationMinutes, paymentToken, transactionHash } = req.body;

    if (!durationMinutes || !paymentToken || !transactionHash) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: durationMinutes, paymentToken, transactionHash',
        code: 'INVALID_REQUEST',
        meta: {
          timestamp: new Date().toISOString(),
          requestId: `req_telegram_purchase_${Date.now()}`
        }
      });
    }

    const purchaseData = {
      durationMinutes: parseInt(durationMinutes),
      paymentToken,
      transactionHash,
      userParaId: req.user.paraId,
      walletAddress: req.user.walletAddress
    };

    const result = await telegramService.purchaseTelegramAccess(identifier, purchaseData);

    res.json({
      success: true,
      data: result,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: `req_telegram_purchase_${Date.now()}`
      }
    });

  } catch (error) {
    console.error(`Error in POST /api/creators/${req.params.identifier}/telegram/purchase:`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to purchase Telegram access',
      meta: {
        timestamp: new Date().toISOString(),
        requestId: `req_telegram_purchase_${Date.now()}`
      }
    });
  }
});

/**
 * POST /api/creators/:identifier/follow
 * Follow or unfollow a creator
 */
router.post('/:identifier/follow', authenticateToken, async (req, res) => {
  try {
    const creatorService = new CreatorService(pool);
    const identifier = req.params.identifier;

    const { action, enableNotifications = true } = req.body;

    if (!action || !['follow', 'unfollow'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid action. Must be "follow" or "unfollow"',
        code: 'INVALID_ACTION',
        meta: {
          timestamp: new Date().toISOString(),
          requestId: `req_follow_${Date.now()}`
        }
      });
    }

    const followData = {
      action,
      userParaId: req.user.paraId,
      walletAddress: req.user.walletAddress,
      enableNotifications
    };

    const result = await creatorService.toggleFollow(identifier, followData);

    res.json({
      success: true,
      data: result,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: `req_follow_${Date.now()}`
      }
    });

  } catch (error) {
    console.error(`Error in POST /api/creators/${req.params.identifier}/follow:`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update follow status',
      meta: {
        timestamp: new Date().toISOString(),
        requestId: `req_follow_${Date.now()}`
      }
    });
  }
});

module.exports = router;
