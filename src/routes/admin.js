const express = require('express');
const { pool } = require('../config/database');
const logger = require('../utils/logger');
const { getTokenPriceCronService } = require('../services/TokenPriceCronService');

const router = express.Router();

// Database status and stats endpoint
router.get('/db-stats', async (req, res) => {
  try {
    // Check if database is connected
    const client = await pool.connect();
    
    // Get counts from all tables
    const counts = await Promise.all([
      client.query('SELECT COUNT(*) FROM users'),
      client.query('SELECT COUNT(*) FROM auctions'),
      client.query('SELECT COUNT(*) FROM meetings'),
      client.query('SELECT COUNT(*) FROM para_sessions')
    ]);

    // Get recent users
    const recentUsers = await client.query(`
      SELECT 
        id, para_user_id, email, wallet_address, 
        auth_type, display_name, created_at
      FROM users 
      ORDER BY created_at DESC 
      LIMIT 5
    `);

    client.release();

    res.json({
      success: true,
      database: 'connected',
      stats: {
        totalUsers: counts[0].rows[0].count,
        totalAuctions: counts[1].rows[0].count,
        totalMeetings: counts[2].rows[0].count,
        totalSessions: counts[3].rows[0].count
      },
      recentUsers: recentUsers.rows.map(user => ({
        id: user.id,
        paraUserId: user.para_user_id,
        email: user.email,
        wallet: user.wallet_address,
        authType: user.auth_type,
        displayName: user.display_name,
        createdAt: user.created_at
      }))
    });

  } catch (error) {
    logger.error('Database stats error:', error);
    res.json({
      success: false,
      database: 'disconnected',
      error: error.message,
      note: 'Running in demo mode without database. User data is not persisted.'
    });
  }
});

// List all users endpoint
router.get('/users', async (req, res) => {
  try {
    const client = await pool.connect();
    
    const result = await client.query(`
      SELECT 
        id, para_user_id, wallet_address, email, 
        auth_type, oauth_method, display_name, 
        created_at, updated_at
      FROM users 
      ORDER BY created_at DESC
    `);

    client.release();

    res.json({
      success: true,
      count: result.rows.length,
      users: result.rows
    });

  } catch (error) {
    logger.error('List users error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      note: 'Database not available'
    });
  }
});

// Manual blockchain sync endpoint
router.post('/sync-tokens', async (req, res) => {
  try {
    logger.info('🔄 Manual blockchain sync triggered via API');

    const cronService = getTokenPriceCronService(pool);

    // Run full sync in background
    cronService.runFullSync()
      .then(result => {
        logger.info('✅ Manual sync completed:', result);
      })
      .catch(error => {
        logger.error('❌ Manual sync failed:', error);
      });

    res.json({
      success: true,
      message: 'Full blockchain sync started in background',
      note: 'This will scan all users and check for creator tokens. Check logs for progress.'
    });

  } catch (error) {
    logger.error('Manual sync error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Manual price update endpoint
router.post('/update-prices', async (req, res) => {
  try {
    logger.info('💰 Manual price update triggered via API');

    const cronService = getTokenPriceCronService(pool);

    // Run price update in background
    cronService.runPriceUpdate()
      .then(() => {
        logger.info('✅ Manual price update completed');
      })
      .catch(error => {
        logger.error('❌ Manual price update failed:', error);
      });

    res.json({
      success: true,
      message: 'Token price update started in background',
      note: 'This will update all token prices from blockchain. Check logs for progress.'
    });

  } catch (error) {
    logger.error('Manual price update error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get creator token stats
router.get('/creator-stats', async (req, res) => {
  try {
    const client = await pool.connect();

    // Get token counts
    const tokenStats = await client.query(`
      SELECT
        COUNT(DISTINCT ct.id) as total_tokens,
        COUNT(DISTINCT CASE WHEN ct.liquidity_pool_address IS NOT NULL THEN ct.id END) as tokens_with_pools,
        COUNT(DISTINCT cp.id) as total_creators,
        SUM(CAST(ct.volume_24h AS NUMERIC)) as total_volume_24h
      FROM creator_tokens ct
      INNER JOIN creator_profiles cp ON ct.creator_profile_id = cp.id
    `);

    // Get recent token updates
    const recentTokens = await client.query(`
      SELECT
        ct.contract_address,
        ct.symbol,
        ct.name,
        ct.current_price,
        ct.price_change_24h,
        ct.volume_24h,
        ct.updated_at,
        cp.wallet_address
      FROM creator_tokens ct
      INNER JOIN creator_profiles cp ON ct.creator_profile_id = cp.id
      ORDER BY ct.updated_at DESC
      LIMIT 10
    `);

    client.release();

    res.json({
      success: true,
      stats: {
        totalTokens: parseInt(tokenStats.rows[0].total_tokens) || 0,
        tokensWithPools: parseInt(tokenStats.rows[0].tokens_with_pools) || 0,
        totalCreators: parseInt(tokenStats.rows[0].total_creators) || 0,
        totalVolume24h: tokenStats.rows[0].total_volume_24h || '0'
      },
      recentTokens: recentTokens.rows.map(token => ({
        address: token.contract_address,
        symbol: token.symbol,
        name: token.name,
        price: token.current_price,
        priceChange24h: token.price_change_24h,
        volume24h: token.volume_24h,
        creator: token.wallet_address,
        lastUpdated: token.updated_at
      }))
    });

  } catch (error) {
    logger.error('Creator stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

