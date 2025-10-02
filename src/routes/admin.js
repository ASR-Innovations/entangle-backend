const express = require('express');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

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

module.exports = router;

