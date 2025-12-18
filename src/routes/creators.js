/**
 * Creator API Routes
 * Handles all creator-related endpoints
 */

const express = require('express');
const router = express.Router();
const CreatorService = require('../services/CreatorService');
const { pool } = require('../config/database');

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

module.exports = router;
