const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const meetingService = require('../services/MeetingService');
const paraService = require('../services/ParaService');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// Initialize meeting service
meetingService.initialize().catch(err => {
  logger.error('Failed to initialize meeting service:', err);
});

// Create simple Para-authenticated meeting
router.post('/create-simple', authenticateToken, async (req, res) => {
  try {
    const { guestUserId, meetingName, duration = 60 } = req.body;
    const hostUser = req.user;

    if (!guestUserId) {
      return res.status(400).json({
        error: 'Guest user ID is required',
        required: ['guestUserId']
      });
    }

    // Get guest user info
    const guestQuery = 'SELECT * FROM users WHERE id = $1';
    const guestResult = await pool.query(guestQuery, [guestUserId]);

    if (guestResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Guest user not found'
      });
    }

    const guestUser = guestResult.rows[0];

    // Create meeting
    const result = await meetingService.createSimpleMeeting({
      hostUser,
      guestUser,
      meetingName,
      duration
    });

    if (!result.success) {
      return res.status(500).json({
        error: 'Failed to create meeting',
        details: result.error
      });
    }

    logger.info(`Simple meeting created by user ${hostUser.id} with guest ${guestUserId}`);

    res.json({
      success: true,
      meeting: result.meeting,
      participants: result.participants,
      note: 'Meeting created successfully. Both users can join with their respective URLs.'
    });

  } catch (error) {
    logger.error('Create simple meeting error:', error);
    res.status(500).json({
      error: 'Failed to create meeting',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Create NFT-gated meeting
router.post('/create-gated', authenticateToken, async (req, res) => {
  try {
    const { nftContract, nftTokenId, meetingName, duration = 60, windowStart, windowEnd } = req.body;
    const hostUser = req.user;

    if (!nftContract || !nftTokenId) {
      return res.status(400).json({
        error: 'NFT contract and token ID are required',
        required: ['nftContract', 'nftTokenId']
      });
    }

    // Verify host owns the NFT (optional check)
    if (hostUser.wallet_address) {
      const verification = await paraService.verifyWalletOwnership(hostUser.wallet_address);
      if (!verification.success) {
        logger.warn(`Host wallet verification failed for user ${hostUser.id}`);
      }
    }

    // Create gated meeting
    const result = await meetingService.createGatedMeeting({
      hostUser,
      nftContract,
      nftTokenId,
      meetingName,
      duration,
      windowStart,
      windowEnd
    });

    if (!result.success) {
      return res.status(500).json({
        error: 'Failed to create gated meeting',
        details: result.error
      });
    }

    logger.info(`Gated meeting created by user ${hostUser.id} for NFT ${nftContract}:${nftTokenId}`);

    res.json({
      success: true,
      meeting: result.meeting,
      host: result.host,
      note: 'NFT-gated meeting created. Users must verify NFT ownership to join.'
    });

  } catch (error) {
    logger.error('Create gated meeting error:', error);
    res.status(500).json({
      error: 'Failed to create gated meeting',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Join gated meeting (requires NFT BURN verification)
router.post('/join-gated/:roomId', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { burnTransactionHash } = req.body;
    const user = req.user;

    logger.info(`🔐 Join gated meeting request received`);
    logger.info(`   Room ID: ${roomId}`);
    logger.info(`   User: ${user.id} (${user.wallet_address})`);
    logger.info(`   Burn TX: ${burnTransactionHash}`);

    if (!user.wallet_address) {
      logger.error(`❌ User ${user.id} has no wallet address`);
      return res.status(400).json({
        error: 'Wallet address required for NFT verification',
        hint: 'User must import Para session with wallet access',
        required: 'wallet_address'
      });
    }

    if (!burnTransactionHash) {
      logger.error(`❌ No burn transaction hash provided`);
      return res.status(400).json({
        error: 'Burn transaction hash required',
        hint: 'Frontend must burn NFT first and send transaction hash',
        required: 'burnTransactionHash'
      });
    }

    // Join gated meeting (with NFT burn verification)
    const result = await meetingService.joinGatedMeeting({
      roomId,
      user,
      burnTransactionHash
    });

    if (!result.success) {
      logger.error(`❌ Join meeting failed for user ${user.id}: ${result.error}`);
      return res.status(401).json({
        error: 'Failed to join meeting',
        details: result.error
      });
    }

    logger.info(`✅ User ${user.id} successfully verified and joined meeting ${roomId}`);

    res.json({
      success: true,
      token: result.token,
      url: result.url,
      meeting: result.meeting,
      note: 'NFT burn verified on blockchain. You can now join the meeting.'
    });

  } catch (error) {
    logger.error('Join gated meeting error:', error);
    res.status(500).json({
      error: 'Failed to join meeting',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get meeting info
router.get('/:roomId', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;

    const result = await meetingService.getMeetingInfo(roomId);

    if (!result.success) {
      return res.status(404).json({
        error: 'Meeting not found',
        details: result.error
      });
    }

    res.json({
      success: true,
      meeting: result.meeting
    });

  } catch (error) {
    logger.error('Get meeting info error:', error);
    res.status(500).json({
      error: 'Failed to get meeting info',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// List user's meetings
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userWallet = req.user.walletAddress;

    // Query auction-based meetings (from auctions table)
    const query = `
      SELECT m.*, 
             a.title as auction_title,
             a.creator_para_id,
             u.display_name as creator_name
      FROM meetings m
      LEFT JOIN auctions a ON m.auction_id = a.id
      LEFT JOIN users u ON a.creator_para_id = u.para_user_id
      WHERE a.creator_para_id = $1
      ORDER BY m.created_at DESC
      LIMIT 20
    `;

    const result = await pool.query(query, [req.user.paraUserId]);

    const meetings = result.rows.map(meeting => ({
      id: meeting.id,
      auctionId: meeting.auction_id,
      roomId: meeting.jitsi_room_id,
      url: meeting.room_url,
      auctionTitle: meeting.auction_title,
      creatorName: meeting.creator_name,
      expiresAt: meeting.expires_at,
      createdAt: meeting.created_at,
      scheduledAt: meeting.scheduled_at
    }));

    res.json({
      success: true,
      meetings
    });

  } catch (error) {
    logger.error('List meetings error:', error);
    res.status(500).json({
      error: 'Failed to list meetings',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Test meeting creation (simple test endpoint)
router.post('/test-create', async (req, res) => {
  try {
    const { hostEmail = 'host@test.com', guestEmail = 'guest@test.com' } = req.body;

    // Create test users if they don't exist
    const createUser = async (email) => {
      const userQuery = `
        INSERT INTO users (para_user_id, email, auth_type, display_name, created_at)
        VALUES ($1, $2, 'email', $3, CURRENT_TIMESTAMP)
        ON CONFLICT (para_user_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;
      const paraUserId = `test_${Buffer.from(email).toString('base64').slice(0, 16)}`;
      const result = await pool.query(userQuery, [paraUserId, email, email]);
      return result.rows[0];
    };

    const hostUser = await createUser(hostEmail);
    const guestUser = await createUser(guestEmail);

    // Create simple meeting
    const result = await meetingService.createSimpleMeeting({
      hostUser,
      guestUser,
      meetingName: 'Test Meeting',
      duration: 30
    });

    if (!result.success) {
      return res.status(500).json({
        error: 'Failed to create test meeting',
        details: result.error
      });
    }

    res.json({
      success: true,
      meeting: result.meeting,
      participants: result.participants,
      note: 'Test meeting created successfully'
    });

  } catch (error) {
    logger.error('Test create meeting error:', error);
    res.status(500).json({
      error: 'Failed to create test meeting',
      message: error.message
    });
  }
});

// ========================================
// PUBLIC MEETING CREATION (NO AUTH, NO DB)
// ========================================

/**
 * Create direct meeting URLs without authentication or database
 * Perfect for quick testing or simple integrations
 */
router.post('/create-direct', async (req, res) => {
  try {
    const { 
      hostName = 'Host User',
      hostEmail = 'host@example.com', 
      guestName = 'Guest User',
      guestEmail = 'guest@example.com',
      meetingName = 'Direct Meeting',
      duration = 60
    } = req.body;

    const jitsiService = require('../services/JitsiService').getJitsiService();
    
    // Generate a unique room ID
    const roomId = `direct-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create host token (moderator)
    const hostToken = jitsiService.generateToken({
      roomName: roomId,
      userId: `host-${Date.now()}`,
      userName: hostName,
      email: hostEmail,
      role: 'moderator',
      expiresIn: Math.ceil(duration / 60) // Convert minutes to hours
    });
    
    // Create guest token (participant)  
    const guestToken = jitsiService.generateToken({
      roomName: roomId,
      userId: `guest-${Date.now()}`,
      userName: guestName,
      email: guestEmail,
      role: 'participant',
      expiresIn: Math.ceil(duration / 60)
    });
    
    // Generate meeting URLs
    const hostUrl = jitsiService.generateMeetingUrl({
      roomId,
      token: hostToken,
      userName: hostName,
      userEmail: hostEmail
    });
    
    const guestUrl = jitsiService.generateMeetingUrl({
      roomId,
      token: guestToken,
      userName: guestName,
      userEmail: guestEmail
    });
    
    logger.info(`Direct meeting created: ${roomId} for ${hostEmail} and ${guestEmail}`);
    
    res.json({
      success: true,
      meeting: {
        roomId,
        name: meetingName,
        duration,
        expiresAt: new Date(Date.now() + duration * 60 * 1000).toISOString()
      },
      participants: {
        host: {
          name: hostName,
          email: hostEmail,
          url: hostUrl,
          role: 'moderator',
          token: hostToken
        },
        guest: {
          name: guestName,
          email: guestEmail,
          url: guestUrl,
          role: 'participant',
          token: guestToken
        }
      },
      note: 'Direct meeting created successfully. No authentication or database storage required.'
    });
    
  } catch (error) {
    logger.error('Direct meeting creation error:', error);
    res.status(500).json({
      error: 'Failed to create direct meeting',
      details: error.message
    });
  }
});

module.exports = router;