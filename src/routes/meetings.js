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

// ========================================
// NEW FLOW: ON-DEMAND MEETING CREATION
// ========================================

/**
 * Check winner access requirements
 * Returns whether winner needs to burn NFT to access meeting
 */
router.post('/access-winner', authenticateToken, async (req, res) => {
  try {
    const { auctionId } = req.body;
    const user = req.user;

    logger.info(`🔍 Checking winner access for auction ${auctionId}`);
    logger.info(`   User: ${user.walletAddress}`);

    if (!auctionId) {
      return res.status(400).json({
        error: 'Auction ID is required',
        required: ['auctionId']
      });
    }

    if (!user.walletAddress) {
      return res.status(400).json({
        error: 'Wallet address required',
        hint: 'User must have wallet connected'
      });
    }

    // Get contract service
    const { getContractService } = require('../services/ContractService');
    const contractService = getContractService();
    await contractService.initialize();

    // Get auction data from blockchain
    const auction = await contractService.contract.getAuction(auctionId);

    if (!auction || auction.id === 0) {
      return res.status(404).json({
        error: 'Auction not found'
      });
    }

    // Check if user is the winner
    const isWinner = auction.highestBidder.toLowerCase() === user.walletAddress.toLowerCase();

    if (!isWinner) {
      return res.status(403).json({
        error: 'Only the auction winner can access this meeting',
        details: `Winner is ${auction.highestBidder}`
      });
    }

    // Check if meeting already exists
    const meetingCheck = await pool.query(
      'SELECT * FROM meetings WHERE auction_id = $1',
      [auctionId]
    );

    if (meetingCheck.rows.length > 0) {
      // Meeting already created - user can join directly
      logger.info(`✅ Meeting already exists for auction ${auctionId}`);
      return res.json({
        success: true,
        requiresBurn: false,
        meetingExists: true,
        meeting: {
          roomId: meetingCheck.rows[0].jitsi_room_id,
          url: meetingCheck.rows[0].room_url
        }
      });
    }

    // Check NFT ownership (should own the NFT to burn it)
    const nftTokenId = Number(auction.nftTokenId);

    try {
      // Try to get NFT owner (will fail if burned)
      const owner = await contractService.contract.ownerOf(nftTokenId);
      const ownsNFT = owner.toLowerCase() === user.walletAddress.toLowerCase();

      if (!ownsNFT) {
        return res.status(403).json({
          error: 'You do not own the NFT',
          details: `NFT Token ID ${nftTokenId} is owned by ${owner}`
        });
      }

      // User owns NFT and needs to burn it
      logger.info(`⚠️  User must burn NFT ${nftTokenId} to access meeting`);
      return res.json({
        success: true,
        requiresBurn: true,
        meetingExists: false,
        nftTokenId,
        auctionId,
        message: 'You must burn your NFT to access the meeting'
      });

    } catch (error) {
      // NFT might already be burned
      if (error.message && error.message.includes('ERC721: invalid token ID')) {
        return res.status(400).json({
          error: 'NFT has already been burned',
          details: 'The NFT may have been burned already. Check if meeting was created.'
        });
      }
      throw error;
    }

  } catch (error) {
    logger.error('Check winner access error:', error);
    res.status(500).json({
      error: 'Failed to check access',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * Burn NFT and create meeting access
 * Winner burns NFT and gets meeting URL
 */
router.post('/burn-nft-access', authenticateToken, async (req, res) => {
  try {
    const { auctionId, burnTxHash, tokenId } = req.body;
    const user = req.user;

    logger.info(`🔥 NFT burn verification for auction ${auctionId}`);
    logger.info(`   User: ${user.walletAddress}`);
    logger.info(`   Burn TX: ${burnTxHash}`);
    logger.info(`   Token ID: ${tokenId}`);

    if (!auctionId || !burnTxHash || !tokenId) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['auctionId', 'burnTxHash', 'tokenId']
      });
    }

    if (!user.walletAddress) {
      return res.status(400).json({
        error: 'Wallet address required'
      });
    }

    // Get contract service
    const { getContractService } = require('../services/ContractService');
    const contractService = getContractService();
    await contractService.initialize();

    // Verify burn transaction on blockchain
    logger.info(`📋 Verifying burn transaction...`);
    const receipt = await contractService.provider.getTransactionReceipt(burnTxHash);

    if (!receipt || receipt.status !== 1) {
      return res.status(400).json({
        error: 'Invalid or failed burn transaction'
      });
    }

    // Verify the transaction was sent by the user
    const transaction = await contractService.provider.getTransaction(burnTxHash);
    if (transaction.from.toLowerCase() !== user.walletAddress.toLowerCase()) {
      logger.error(`❌ Transaction sender mismatch: ${transaction.from} vs ${user.walletAddress}`);
      return res.status(403).json({
        error: 'Burn transaction was not sent by you',
        details: `Transaction was sent by ${transaction.from}`
      });
    }

    logger.info(`✅ Transaction verified: sent by ${transaction.from}`);

    // Verify NFTBurned event (contract emits NFTBurned, not NFTBurnedForMeeting)
    const ethers = require('ethers');
    const iface = new ethers.Interface([
      'event NFTBurned(uint256 indexed tokenId, uint256 indexed auctionId)'
    ]);

    let burnEventFound = false;
    logger.info(`🔍 Parsing transaction logs for NFTBurned event...`);
    logger.info(`   Expected tokenId: ${tokenId}`);
    logger.info(`   Expected auctionId: ${auctionId}`);

    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed && parsed.name === 'NFTBurned') {
          const eventTokenId = Number(parsed.args.tokenId);
          const eventAuctionId = Number(parsed.args.auctionId);

          logger.info(`   Found NFTBurned event: tokenId=${eventTokenId}, auctionId=${eventAuctionId}`);

          // Verify the burn is for the correct NFT and auction
          if (eventTokenId === Number(tokenId) && eventAuctionId === Number(auctionId)) {
            burnEventFound = true;
            logger.info(`✅ Valid NFT burn event verified!`);
            logger.info(`   ✓ Token ID matches: ${eventTokenId}`);
            logger.info(`   ✓ Auction ID matches: ${eventAuctionId}`);
            break;
          } else {
            logger.warn(`   ✗ Event doesn't match: tokenId=${eventTokenId} (expected ${tokenId}), auctionId=${eventAuctionId} (expected ${auctionId})`);
          }
        }
      } catch (e) {
        // Not the event we're looking for, skip
      }
    }

    if (!burnEventFound) {
      logger.error(`❌ No valid NFTBurned event found in transaction`);
      logger.error(`   Transaction hash: ${burnTxHash}`);
      logger.error(`   Expected tokenId: ${tokenId}, auctionId: ${auctionId}`);
      return res.status(400).json({
        error: 'Invalid burn transaction',
        details: 'No valid NFTBurned event found for this auction and NFT'
      });
    }

    // Check for replay attacks
    const existingAccess = await pool.query(
      'SELECT * FROM meeting_access_logs WHERE transaction_hash = $1',
      [burnTxHash]
    );

    if (existingAccess.rows.length > 0) {
      return res.status(400).json({
        error: 'Burn transaction already used'
      });
    }

    // Get auction data
    const auction = await contractService.contract.getAuction(auctionId);
    const auctionDb = await pool.query('SELECT * FROM auctions WHERE id = $1', [auctionId]);

    if (auctionDb.rows.length === 0) {
      return res.status(404).json({
        error: 'Auction not found in database'
      });
    }

    // Get creator data
    const creatorData = await pool.query(
      'SELECT * FROM users WHERE wallet_address = $1',
      [auction.host.toLowerCase()]
    );

    // NOW CREATE THE MEETING
    logger.info(`🎬 Creating meeting for auction ${auctionId}...`);

    const jitsiService = require('../services/JitsiService').getJitsiService();
    const meeting = jitsiService.createAuctionMeeting({
      auctionId: Number(auctionId),
      hostData: {
        paraId: creatorData.rows[0]?.para_user_id || 'unknown',
        name: creatorData.rows[0]?.display_name || 'Auction Creator',
        email: creatorData.rows[0]?.email || 'creator@example.com'
      },
      winnerData: {
        paraId: user.paraUserId,
        name: user.displayName,
        email: user.email
      },
      duration: auctionDb.rows[0].meeting_duration || 60
    });

    if (!meeting.success) {
      return res.status(500).json({
        error: 'Failed to create meeting',
        details: meeting.error
      });
    }

    // Save meeting to database
    await pool.query(`
      INSERT INTO meetings (
        auction_id, jitsi_room_id, jitsi_room_config,
        creator_access_token, winner_access_token, room_url,
        expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      auctionId,
      meeting.meeting.roomId,
      JSON.stringify(meeting.meeting.config),
      meeting.host.token,
      meeting.winner.token,
      meeting.meeting.url,
      meeting.meeting.expiresAt
    ]);

    // Log the access
    await pool.query(`
      INSERT INTO meeting_access_logs (
        auction_id, user_para_id, wallet_address, nft_token_id,
        transaction_hash, access_method
      ) VALUES ($1, $2, $3, $4, $5, 'nft_burn_verified')
    `, [
      auctionId,
      user.paraUserId,
      user.walletAddress.toLowerCase(),
      tokenId,
      burnTxHash
    ]);

    logger.info(`✅ Meeting created and access granted for auction ${auctionId}`);

    res.json({
      success: true,
      meeting: {
        url: meeting.winner.url,
        token: meeting.winner.token,
        roomId: meeting.meeting.roomId,
        expiresAt: meeting.meeting.expiresAt
      },
      message: 'NFT burned successfully. Meeting access granted.'
    });

  } catch (error) {
    logger.error('Burn NFT access error:', error);
    res.status(500).json({
      error: 'Failed to process NFT burn',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * Get creator/host access to meeting
 * Creator doesn't need to burn NFT, just verify ownership
 */
router.post('/access-creator', authenticateToken, async (req, res) => {
  try {
    const { auctionId } = req.body;
    const user = req.user;

    logger.info(`🔍 Checking creator access for auction ${auctionId}`);

    if (!auctionId) {
      return res.status(400).json({
        error: 'Auction ID is required'
      });
    }

    if (!user.walletAddress) {
      return res.status(400).json({
        error: 'Wallet address required'
      });
    }

    // Get contract service
    const { getContractService } = require('../services/ContractService');
    const contractService = getContractService();
    await contractService.initialize();

    // Get auction data
    const auction = await contractService.contract.getAuction(auctionId);

    if (!auction || auction.id === 0) {
      return res.status(404).json({
        error: 'Auction not found'
      });
    }

    // Verify user is the creator
    const isCreator = auction.host.toLowerCase() === user.walletAddress.toLowerCase();

    if (!isCreator) {
      return res.status(403).json({
        error: 'Only the auction creator can access this',
        details: `Creator is ${auction.host}`
      });
    }

    // Check if meeting exists
    const meetingCheck = await pool.query(
      'SELECT * FROM meetings WHERE auction_id = $1',
      [auctionId]
    );

    if (meetingCheck.rows.length === 0) {
      return res.json({
        success: true,
        meetingExists: false,
        message: 'Meeting will be created when winner burns NFT'
      });
    }

    // Meeting exists - return creator access
    const meeting = meetingCheck.rows[0];

    logger.info(`✅ Creator access granted for auction ${auctionId}`);

    res.json({
      success: true,
      meetingExists: true,
      meeting: {
        url: meeting.room_url,
        token: meeting.creator_access_token,
        roomId: meeting.jitsi_room_id,
        expiresAt: meeting.expires_at
      }
    });

  } catch (error) {
    logger.error('Creator access error:', error);
    res.status(500).json({
      error: 'Failed to get creator access',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;