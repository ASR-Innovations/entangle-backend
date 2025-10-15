const express = require('express');
const { getContractService } = require('../services/ContractService');
const logger = require('../utils/logger');

const router = express.Router();

// Get contract statistics
router.get('/stats', async (req, res) => {
  try {
    const contractService = getContractService();
    await contractService.initialize();
    
    const stats = await contractService.getContractStats();
    const balance = await contractService.getContractBalance();
    
    // Get database statistics for enhanced analytics
    let dbStats = {};
    try {
      const { pool } = require('../config/database');
      
      // Get auction statistics from database
      const auctionStats = await pool.query(`
        SELECT 
          COUNT(*) as total_auctions,
          SUM(CASE WHEN auto_ended = false THEN 1 ELSE 0 END) as active_auctions,
          SUM(CASE WHEN auto_ended = true THEN 1 ELSE 0 END) as ended_auctions,
          COUNT(DISTINCT creator_para_id) as unique_creators
        FROM auctions
      `);
      
      // Get meeting statistics
      const meetingStats = await pool.query(`
        SELECT 
          COUNT(*) as total_meetings,
          COUNT(DISTINCT auction_id) as auctions_with_meetings
        FROM meetings
      `);
      
      // Get access log statistics
      const accessStats = await pool.query(`
        SELECT 
          COUNT(*) as total_access_attempts,
          COUNT(DISTINCT user_para_id) as unique_users_accessed
        FROM meeting_access_logs
      `);
      
      dbStats = {
        database: {
          auctions: auctionStats.rows[0],
          meetings: meetingStats.rows[0],
          accessLogs: accessStats.rows[0]
        }
      };
      
      logger.info('Database stats retrieved successfully');
    } catch (dbError) {
      logger.warn('Failed to get database stats:', dbError.message);
      dbStats = { database: { error: 'Database stats unavailable' } };
    }
    
    res.json({
      success: true,
      stats: {
        ...stats,
        contractBalance: balance.toString(),
        ...dbStats
      }
    });
  } catch (error) {
    logger.error('Contract stats error:', error);
    res.status(500).json({ error: 'Failed to get contract stats', message: error.message });
  }
});

// Get all auctions from contract
router.get('/auctions', async (req, res) => {
  try {
    const contractService = getContractService();
    await contractService.initialize();
    
    const auctions = await contractService.getActiveAuctions();
    
    // Get database auctions for enhanced data
    let dbAuctions = [];
    try {
      const { pool } = require('../config/database');
      
      const dbResult = await pool.query(`
        SELECT 
          a.*, 
          u.display_name as creator_name,
          u.auth_type,
          u.oauth_method,
          CASE WHEN m.id IS NOT NULL THEN true ELSE false END as has_meeting
        FROM auctions a
        LEFT JOIN users u ON a.creator_para_id = u.para_user_id
        LEFT JOIN meetings m ON a.id = m.auction_id
        ORDER BY a.created_at DESC
      `);
      
      dbAuctions = dbResult.rows;
      logger.info(`Retrieved ${dbAuctions.length} auctions from database`);
    } catch (dbError) {
      logger.warn('Failed to get database auctions:', dbError.message);
    }
    
    res.json({
      success: true,
      auctions: auctions,
      databaseAuctions: dbAuctions,
      total: auctions.length,
      databaseTotal: dbAuctions.length
    });
  } catch (error) {
    logger.error('Contract auctions error:', error);
    res.status(500).json({ error: 'Failed to get contract auctions', message: error.message });
  }
});

// Get NFTs owned by user
router.get('/nfts/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    const contractService = getContractService();
    await contractService.initialize();
    
    const nfts = await contractService.getNFTsOwnedByUser(address);
    
    res.json({
      success: true,
      nfts: nfts,
      total: nfts.length
    });
  } catch (error) {
    logger.error('User NFTs error:', error);
    res.status(500).json({ error: 'Failed to get user NFTs', message: error.message });
  }
});

// Get NFT metadata
router.get('/nft/:tokenId', async (req, res) => {
  try {
    const { tokenId } = req.params;
    
    if (!tokenId || isNaN(tokenId)) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    const contractService = getContractService();
    await contractService.initialize();
    
    const metadata = await contractService.getNFTMetadata(tokenId);
    
    res.json({
      success: true,
      metadata: metadata
    });
  } catch (error) {
    logger.error('NFT metadata error:', error);
    res.status(500).json({ error: 'Failed to get NFT metadata', message: error.message });
  }
});

// Check if user can burn NFT for meeting
router.get('/can-burn/:tokenId/:userAddress', async (req, res) => {
  try {
    const { tokenId, userAddress } = req.params;
    
    if (!tokenId || isNaN(tokenId)) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }
    
    if (!userAddress || !userAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    const contractService = getContractService();
    await contractService.initialize();
    
    const canBurn = await contractService.canBurnForMeeting(tokenId, userAddress);
    
    res.json({
      success: true,
      canBurn: canBurn
    });
  } catch (error) {
    logger.error('Can burn check error:', error);
    res.status(500).json({ error: 'Failed to check burn eligibility', message: error.message });
  }
});

// Get user dashboard data
router.get('/dashboard/user/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    const contractService = getContractService();
    await contractService.initialize();
    
    const dashboard = await contractService.getUserDashboardCategorized(address);
    
    // Get database analytics for enhanced dashboard
    let dbAnalytics = {};
    try {
      const { pool } = require('../config/database');
      
      // Get user's auction participation
      const userAuctions = await pool.query(`
        SELECT 
          a.id, a.title, a.creator_wallet, a.auto_ended, a.created_at,
          u.display_name as creator_name,
          CASE WHEN m.id IS NOT NULL THEN true ELSE false END as has_meeting
        FROM auctions a
        LEFT JOIN users u ON a.creator_para_id = u.para_user_id
        LEFT JOIN meetings m ON a.id = m.auction_id
        WHERE a.creator_wallet = $1
        ORDER BY a.created_at DESC
      `, [address.toLowerCase()]);
      
      // Get user's access logs
      const accessLogs = await pool.query(`
        SELECT 
          mal.*, a.title as auction_title
        FROM meeting_access_logs mal
        LEFT JOIN auctions a ON mal.auction_id = a.id
        WHERE mal.wallet_address = $1
        ORDER BY mal.accessed_at DESC
        LIMIT 20
      `, [address.toLowerCase()]);
      
      // Get user's meeting participation
      const userMeetings = await pool.query(`
        SELECT 
          m.*, a.title as auction_title, a.creator_wallet
        FROM meetings m
        LEFT JOIN auctions a ON m.auction_id = a.id
        WHERE a.creator_wallet = $1
        ORDER BY m.created_at DESC
      `, [address.toLowerCase()]);
      
      dbAnalytics = {
        database: {
          userAuctions: userAuctions.rows,
          accessLogs: accessLogs.rows,
          userMeetings: userMeetings.rows,
          totalAuctions: userAuctions.rows.length,
          totalAccessAttempts: accessLogs.rows.length,
          totalMeetings: userMeetings.rows.length
        }
      };
      
      logger.info(`Retrieved database analytics for user ${address}`);
    } catch (dbError) {
      logger.warn('Failed to get database analytics:', dbError.message);
      dbAnalytics = { database: { error: 'Database analytics unavailable' } };
    }
    
    res.json({
      success: true,
      dashboard: dashboard,
      ...dbAnalytics
    });
  } catch (error) {
    logger.error('User dashboard error:', error);
    res.status(500).json({ error: 'Failed to get user dashboard', message: error.message });
  }
});

// Get host dashboard data
router.get('/dashboard/host/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    const contractService = getContractService();
    await contractService.initialize();
    
    const dashboard = await contractService.getHostDashboardCategorized(address);
    
    // Get database analytics for enhanced host dashboard
    let dbAnalytics = {};
    try {
      const { pool } = require('../config/database');
      
      // Get host's created auctions
      const hostAuctions = await pool.query(`
        SELECT 
          a.*, 
          u.display_name as creator_name,
          CASE WHEN m.id IS NOT NULL THEN true ELSE false END as has_meeting,
          m.jitsi_room_id, m.created_at as meeting_created
        FROM auctions a
        LEFT JOIN users u ON a.creator_para_id = u.para_user_id
        LEFT JOIN meetings m ON a.id = m.auction_id
        WHERE a.creator_wallet = $1
        ORDER BY a.created_at DESC
      `, [address.toLowerCase()]);
      
      // Get host's meeting management
      const hostMeetings = await pool.query(`
        SELECT 
          m.*, a.title as auction_title, a.creator_wallet
        FROM meetings m
        LEFT JOIN auctions a ON m.auction_id = a.id
        WHERE a.creator_wallet = $1
        ORDER BY m.created_at DESC
      `, [address.toLowerCase()]);
      
      // Get auction performance metrics
      const performanceMetrics = await pool.query(`
        SELECT 
          COUNT(*) as total_auctions,
          SUM(CASE WHEN auto_ended = false THEN 1 ELSE 0 END) as active_auctions,
          SUM(CASE WHEN auto_ended = true THEN 1 ELSE 0 END) as ended_auctions,
          COUNT(DISTINCT m.id) as auctions_with_meetings,
          AVG(CASE WHEN m.id IS NOT NULL THEN 1 ELSE 0 END) as meeting_success_rate
        FROM auctions a
        LEFT JOIN meetings m ON a.id = m.auction_id
        WHERE a.creator_wallet = $1
      `, [address.toLowerCase()]);
      
      dbAnalytics = {
        database: {
          hostAuctions: hostAuctions.rows,
          hostMeetings: hostMeetings.rows,
          performanceMetrics: performanceMetrics.rows[0],
          totalAuctions: hostAuctions.rows.length,
          totalMeetings: hostMeetings.rows.length
        }
      };
      
      logger.info(`Retrieved database analytics for host ${address}`);
    } catch (dbError) {
      logger.warn('Failed to get database analytics:', dbError.message);
      dbAnalytics = { database: { error: 'Database analytics unavailable' } };
    }
    
    res.json({
      success: true,
      dashboard: dashboard,
      ...dbAnalytics
    });
  } catch (error) {
    logger.error('Host dashboard error:', error);
    res.status(500).json({ error: 'Failed to get host dashboard', message: error.message });
  }
});

module.exports = router;




