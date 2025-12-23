const express = require('express');
const Joi = require('joi');
const { ethers } = require('ethers');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');
const { getContractService } = require('../services/ContractService');

const router = express.Router();

const createAuctionSchema = Joi.object({
  title: Joi.string().min(1).max(255).required(),
  description: Joi.string().max(1000).optional().allow(''),
  // COMMENTED OUT FOR TESTING: Accept any block duration (originally min: 30)
  // TODO: Re-enable this validation for production - duration should be at least 30 blocks
  // duration: Joi.number().min(30).max(1440).required(),
  duration: Joi.number().min(1).max(1440).required(), // Temporarily accepting any duration >= 1 block
  reservePrice: Joi.number().min(0.001).max(1000).required(),
  meetingDuration: Joi.number().min(15).max(180).required(),
  creatorWallet: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  transactionHash: Joi.string().pattern(/^0x[a-fA-F0-9]{64}$/).required(),

  // New fields from image
  twitterId: Joi.string().max(255).optional().allow(''),
  sellerName: Joi.string().max(255).optional().allow(''),
  profilePicture: Joi.string().uri().optional().allow(''),
  eventDate: Joi.date().iso().optional().allow(null),
  eventStartTime: Joi.date().iso().optional().allow(null),
  eventEndTime: Joi.date().iso().optional().allow(null)
});

// Record auction creation (after frontend creates it on blockchain)
router.post('/created', authenticateToken, async (req, res) => {
  try {
    logger.info('📝 POST /auctions/created - Recording new auction');
    logger.info('Request body:', JSON.stringify(req.body, null, 2));
    logger.info('User:', { paraUserId: req.user.paraUserId, walletAddress: req.user.walletAddress });
    
    const { error, value } = createAuctionSchema.validate(req.body);
    if (error) {
      logger.warn('Validation error:', error.details[0].message);
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.details[0].message 
      });
    }
    
    const {
      title, description, duration, reservePrice, meetingDuration,
      creatorWallet, transactionHash,
      twitterId, sellerName, profilePicture,
      eventDate, eventStartTime, eventEndTime
    } = value;
    const { paraUserId } = req.user;
    
    logger.info('✅ Validation passed');
    logger.info('Transaction hash:', transactionHash);
    
    // Initialize contract service
    const contractService = getContractService();
    await contractService.initialize();
    
    // Verify transaction exists and get auction ID
    const provider = contractService.provider;
    logger.info('🔍 Fetching transaction receipt...');
    const receipt = await provider.getTransactionReceipt(transactionHash);
    
    if (!receipt || receipt.status !== 1) {
      logger.error('Invalid or failed transaction:', { receipt });
      return res.status(400).json({ error: 'Invalid or failed transaction' });
    }
    
    logger.info('✅ Transaction receipt found:', {
      blockNumber: receipt.blockNumber,
      status: receipt.status,
      logsCount: receipt.logs.length
    });
    
    // Parse transaction logs to get auction ID
    let auctionId = null;
    try {
      // Look for AuctionCreated event in transaction logs
      logger.info('🔍 Parsing transaction logs for AuctionCreated event...');
      const iface = new ethers.Interface(require('../ENTANGLEDABI.js'));
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed && parsed.name === 'AuctionCreated') {
            auctionId = Number(parsed.args.auctionId);
            logger.info('✅ Found AuctionCreated event! Auction ID:', auctionId);
            break;
          }
        } catch (e) {
          // Skip logs that don't match our contract
        }
      }
    } catch (error) {
      logger.warn('Failed to parse transaction logs, using fallback method:', error.message);
    }
    
    // Fallback: get auction ID from database or increment
    if (!auctionId) {
      logger.warn('⚠️  Could not parse auction ID from logs, using fallback...');
      const latestAuctionResult = await pool.query('SELECT MAX(id) as max_id FROM auctions');
      const maxId = latestAuctionResult.rows[0].max_id || 0;
      auctionId = maxId + 1;
      logger.info('Fallback auction ID:', { maxId, calculatedId: auctionId });
    }
    
    // Check if auction already exists
    logger.info('🔍 Checking if auction already exists in database...');
    const existingAuction = await pool.query('SELECT * FROM auctions WHERE id = $1', [auctionId]);
    
    if (existingAuction.rows.length > 0) {
      logger.warn(`⚠️  Auction ${auctionId} already exists in database!`);
      logger.info('Existing auction:', existingAuction.rows[0]);
      return res.status(409).json({ 
        error: 'Auction already recorded',
        auctionId,
        details: 'This auction was already recorded in the database'
      });
    }
    
    // Get blockchain data to cache bid price and blocks
    logger.info('🔗 Fetching auction data from blockchain...');
    const contractAuction = await contractService.contract.getAuction(auctionId);
    const currentBlock = await contractService.provider.getBlockNumber();
    const blocksRemaining = Number(contractAuction.endBlock) - currentBlock;
    const blockTime = contractService.getBlockTime();
    const timeRemainingSeconds = blocksRemaining * blockTime;
    logger.info(`Block time for ${contractService.network}: ${blockTime} seconds/block`);

    // Store in database
    logger.info('💾 Inserting auction into database...');
    const insertQuery = `
      INSERT INTO auctions (
        id, contract_address, creator_para_id, creator_wallet,
        title, description, metadata_ipfs, meeting_duration,
        twitter_id, seller_name, profile_picture,
        event_date, event_start_time, event_end_time,
        bid_price, duration_blocks, end_block,
        highest_bid, highest_bidder,
        blocks_remaining, time_remaining_seconds, ended
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      RETURNING *
    `;

    const metadataIPFS = `metadata_${auctionId}_${Date.now()}`;

    const insertParams = [
      auctionId,
      contractService.contractAddress,
      paraUserId,
      creatorWallet.toLowerCase(),
      title,
      description || '',
      metadataIPFS,
      meetingDuration,
      twitterId || null,
      sellerName || null,
      profilePicture || null,
      eventDate || null,
      eventStartTime || null,
      eventEndTime || null,
      contractAuction.reservePrice.toString(),
      duration,
      Number(contractAuction.endBlock),
      contractAuction.highestBid.toString(),
      contractAuction.highestBidder,
      blocksRemaining,
      timeRemainingSeconds,
      contractAuction.ended
    ];
    
    logger.info('Insert parameters:', {
      auctionId,
      contractAddress: contractService.contractAddress,
      paraUserId,
      creatorWallet: creatorWallet.toLowerCase(),
      title,
      meetingDuration
    });
    
    const result = await pool.query(insertQuery, insertParams);
    
    if (result.rows.length === 0) {
      logger.error('❌ Insert failed - no rows returned');
      return res.status(500).json({ error: 'Failed to insert auction' });ou
    }
    
    logger.info(`✅ Auction ${auctionId} successfully recorded for Para user ${paraUserId}`);
    logger.info('Auction record:', result.rows[0]);
    
    res.json({
      success: true,
      auction: result.rows[0],
      auctionId,
      transactionHash,
      blockNumber: receipt.blockNumber
    });
    
  } catch (error) {
    logger.error('Record auction error:', error);
    res.status(500).json({ 
      error: 'Failed to record auction',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get active auctions
router.get('/active', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;
    
    // Get active auctions from database with user info
    // FIXED: Check BOTH auto_ended AND ended flags to prevent showing ended auctions
    const query = `
      SELECT 
        a.*, 
        u.display_name as creator_name,
        u.auth_type,
        u.oauth_method
      FROM auctions a
      JOIN users u ON a.creator_para_id = u.para_user_id
      WHERE a.auto_ended = false AND a.ended = false
      ORDER BY a.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    
    const result = await pool.query(query, [limit, offset]);
    const auctions = [];
    
    // Initialize contract service
    const contractService = getContractService();
    await contractService.initialize();
    
    // Enrich with blockchain data
    for (const auction of result.rows) {
      try {
        const contractAuction = await contractService.getAuction(auction.id);
        
        if (!contractAuction.ended) {
          auctions.push({
            id: auction.id,
            title: auction.title,
            description: auction.description,
            creatorParaId: auction.creator_para_id,
            creatorWallet: auction.creator_wallet,
            creatorName: auction.creator_name,
            authType: auction.auth_type,
            oAuthMethod: auction.oauth_method,
            meetingDuration: auction.meeting_duration,
            reservePrice: contractAuction.reservePrice,
            highestBid: contractAuction.highestBid,
            highestBidder: contractAuction.highestBidder,
            startBlock: contractAuction.startBlock,
            endBlock: contractAuction.endBlock,
            nftTokenId: contractAuction.nftTokenId,
            sellerName: contractAuction.sellerName,
            eventName: contractAuction.eventName,
            eventDate: contractAuction.eventDate,
            eventStartTime: contractAuction.eventStartTime,
            eventEndTime: contractAuction.eventEndTime,
            profilePicture: contractAuction.profilePicture,
            createdAt: auction.created_at
          });
        }
      } catch (error) {
        logger.warn(`Failed to get blockchain data for auction ${auction.id}:`, error.message);
        // Include auction with database data only if blockchain fails
        auctions.push({
          id: auction.id,
          title: auction.title,
          description: auction.description,
          creatorParaId: auction.creator_para_id,
          creatorWallet: auction.creator_wallet,
          creatorName: auction.creator_name,
          authType: auction.auth_type,
          oAuthMethod: auction.oauth_method,
          meetingDuration: auction.meeting_duration,
          createdAt: auction.created_at,
          blockchainError: error.message
        });
      }
    }
    
    res.json({ 
      success: true, 
      auctions,
      total: auctions.length,
      offset,
      limit 
    });
    
  } catch (error) {
    logger.error('Get active auctions error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch auctions',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get user's created auctions
router.get('/user/created', authenticateToken, async (req, res) => {
  try {
    const { paraUserId } = req.user;
    
    const query = `
      SELECT a.*, 
        CASE WHEN m.id IS NOT NULL THEN true ELSE false END as has_meeting
      FROM auctions a 
      LEFT JOIN meetings m ON a.id = m.auction_id
      WHERE a.creator_para_id = $1 
      ORDER BY a.created_at DESC
      LIMIT 50
    `;
    
    const result = await pool.query(query, [paraUserId]);
    res.json({ success: true, auctions: result.rows });
    
  } catch (error) {
    logger.error('Get user auctions error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch user auctions',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get active auctions from database (optimized - no blockchain calls)
router.get('/active/db', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;
    
    logger.info(`📊 GET /auctions/active/db - Fetching active auctions from database (limit: ${limit}, offset: ${offset})`);
    
    // Get active auctions from database with user info
    const query = `
      SELECT 
        a.id,
        a.title,
        a.seller_name,
        a.profile_picture,
        a.twitter_id,
        a.event_date,
        a.event_start_time,
        a.event_end_time,
        a.bid_price,
        a.highest_bid,
        a.highest_bidder,
        a.blocks_remaining,
        a.time_remaining_seconds,
        a.ended,
        a.created_at,
        u.display_name as creator_name
      FROM auctions a
      LEFT JOIN users u ON a.creator_wallet = u.wallet_address
      WHERE a.ended = false AND a.auto_ended = false
      ORDER BY a.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    
    const result = await pool.query(query, [limit, offset]);
    
    // Format auctions for frontend cards
    const auctions = result.rows.map(auction => {
      // Calculate time remaining in human-readable format
      const timeRemainingSeconds = auction.time_remaining_seconds || 0;
      const hours = Math.floor(timeRemainingSeconds / 3600);
      const minutes = Math.floor((timeRemainingSeconds % 3600) / 60);
      
      let timeLeftFormatted = '';
      if (hours > 0) {
        timeLeftFormatted = `${hours}h ${minutes}m`;
      } else {
        timeLeftFormatted = `${minutes}m`;
      }
      
      // Determine if there's a highest bid
      const hasHighestBid = auction.highest_bid && 
                           auction.highest_bid !== '0' && 
                           auction.highest_bidder && 
                           auction.highest_bidder !== '0x0000000000000000000000000000000000000000';
      
      // Show highest bid if exists, otherwise show floor price (bid_price)
      const displayPrice = hasHighestBid ? auction.highest_bid : auction.bid_price;
      const priceLabel = hasHighestBid ? 'Highest Bid' : 'Floor Price';
      
      // Convert wei to AVAX/USDC (assuming 18 decimals)
      const priceInToken = displayPrice ? (parseFloat(displayPrice) / 1e18).toFixed(3) : '0.000';
      
      // Determine badge (LIVE if no bids, HOT if has bids)
      const badge = hasHighestBid ? 'HOT' : 'LIVE';
      
      return {
        id: auction.id,
        sellerName: auction.seller_name || auction.creator_name || 'Unknown',
        twitterId: auction.twitter_id,
        title: auction.title || 'Untitled',
        profilePicture: auction.profile_picture,
        eventDate: auction.event_date,
        eventStartTime: auction.event_start_time,
        eventEndTime: auction.event_end_time,
        price: priceInToken,
        priceLabel: priceLabel,
        priceRaw: displayPrice,
        timeLeft: timeLeftFormatted,
        timeLeftSeconds: timeRemainingSeconds,
        blocksRemaining: auction.blocks_remaining,
        badge: badge,
        hasHighestBid: hasHighestBid,
        highestBidder: hasHighestBid ? auction.highest_bidder : null,
        ended: auction.ended,
        createdAt: auction.created_at
      };
    });
    
    logger.info(`✅ Returned ${auctions.length} active auctions from database`);
    
    res.json({ 
      success: true, 
      auctions,
      total: auctions.length,
      offset,
      limit 
    });
    
  } catch (error) {
    logger.error('Get active auctions from DB error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch auctions',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get ended auctions from database (optimized - no blockchain calls)
router.get('/ended/db', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;
    
    logger.info(`📊 GET /auctions/ended/db - Fetching ended auctions from database (limit: ${limit}, offset: ${offset})`);
    
    // Get ended auctions from database with user info
    const query = `
      SELECT 
        a.id,
        a.title,
        a.seller_name,
        a.profile_picture,
        a.twitter_id,
        a.event_date,
        a.event_start_time,
        a.event_end_time,
        a.bid_price,
        a.highest_bid,
        a.highest_bidder,
        a.ended,
        a.auto_ended,
        a.nft_token_id,
        a.created_at,
        a.updated_at,
        u.display_name as creator_name
      FROM auctions a
      LEFT JOIN users u ON a.creator_wallet = u.wallet_address
      WHERE a.ended = true
      ORDER BY a.id DESC
      LIMIT $1 OFFSET $2
    `;
    
    const result = await pool.query(query, [limit, offset]);
    
    // Format auctions for frontend cards
    const auctions = result.rows.map(auction => {
      // Determine if there's a highest bid (winner)
      const hasWinner = auction.highest_bid && 
                       auction.highest_bid !== '0' && 
                       auction.highest_bidder && 
                       auction.highest_bidder !== '0x0000000000000000000000000000000000000000';
      
      // Show winning bid if exists, otherwise show floor price
      const displayPrice = hasWinner ? auction.highest_bid : auction.bid_price;
      const priceLabel = hasWinner ? 'Winning Bid' : 'Reserve Price';
      
      // Convert wei to AVAX/USDC (assuming 18 decimals)
      const priceInToken = displayPrice ? (parseFloat(displayPrice) / 1e18).toFixed(3) : '0.000';
      
      // Calculate how long ago it ended
      const endedAt = new Date(auction.updated_at);
      const now = new Date();
      const timeSinceEnd = Math.floor((now - endedAt) / 1000); // seconds
      
      let endedAgo = '';
      if (timeSinceEnd < 3600) {
        const minutes = Math.floor(timeSinceEnd / 60);
        endedAgo = `${minutes}m ago`;
      } else if (timeSinceEnd < 86400) {
        const hours = Math.floor(timeSinceEnd / 3600);
        endedAgo = `${hours}h ago`;
      } else {
        const days = Math.floor(timeSinceEnd / 86400);
        endedAgo = `${days}d ago`;
      }
      
      return {
        id: auction.id,
        sellerName: auction.seller_name || auction.creator_name || 'Unknown',
        twitterId: auction.twitter_id,
        title: auction.title || 'Untitled',
        profilePicture: auction.profile_picture,
        eventDate: auction.event_date,
        eventStartTime: auction.event_start_time,
        eventEndTime: auction.event_end_time,
        price: priceInToken,
        priceLabel: priceLabel,
        priceRaw: displayPrice,
        endedAgo: endedAgo,
        endedAt: auction.updated_at,
        hasWinner: hasWinner,
        winner: hasWinner ? auction.highest_bidder : null,
        nftTokenId: auction.nft_token_id,
        autoEnded: auction.auto_ended,
        ended: auction.ended,
        createdAt: auction.created_at
      };
    });
    
    logger.info(`✅ Returned ${auctions.length} ended auctions from database`);
    
    res.json({ 
      success: true, 
      auctions,
      total: auctions.length,
      offset,
      limit 
    });
    
  } catch (error) {
    logger.error('Get ended auctions from DB error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch ended auctions',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get single auction from database by ID (optimized - no blockchain calls)
router.get('/db/:auctionId', async (req, res) => {
  try {
    const { auctionId } = req.params;
    
    if (!auctionId || isNaN(auctionId)) {
      return res.status(400).json({ error: 'Invalid auction ID' });
    }
    
    logger.info(`📊 GET /auctions/db/${auctionId} - Fetching auction from database`);
    
    // Get auction from database with user info
    const query = `
      SELECT 
        a.*,
        u.display_name as creator_name,
        u.auth_type,
        u.oauth_method
      FROM auctions a
      LEFT JOIN users u ON a.creator_wallet = u.wallet_address
      WHERE a.id = $1
    `;
    
    const result = await pool.query(query, [auctionId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Auction not found' });
    }
    
    const auction = result.rows[0];
    
    // Calculate time remaining in human-readable format
    const timeRemainingSeconds = auction.time_remaining_seconds || 0;
    const hours = Math.floor(timeRemainingSeconds / 3600);
    const minutes = Math.floor((timeRemainingSeconds % 3600) / 60);
    
    let timeLeftFormatted = '';
    if (hours > 0) {
      timeLeftFormatted = `${hours}h ${minutes}m`;
    } else {
      timeLeftFormatted = `${minutes}m`;
    }
    
    // Determine if there's a highest bid
    const hasHighestBid = auction.highest_bid && 
                         auction.highest_bid !== '0' && 
                         auction.highest_bidder && 
                         auction.highest_bidder !== '0x0000000000000000000000000000000000000000';
    
    // Show highest bid if exists, otherwise show floor price (bid_price)
    const displayPrice = hasHighestBid ? auction.highest_bid : auction.bid_price;
    const priceLabel = hasHighestBid ? 'Highest Bid' : 'Floor Price';
    
    // Convert wei to AVAX/USDC (assuming 18 decimals)
    const priceInToken = displayPrice ? (parseFloat(displayPrice) / 1e18).toFixed(3) : '0.000';
    
    // Determine badge (LIVE if no bids, HOT if has bids)
    const badge = hasHighestBid ? 'HOT' : 'LIVE';
    
    const formattedAuction = {
      id: auction.id,
      contractAddress: auction.contract_address,
      creatorParaId: auction.creator_para_id,
      creatorWallet: auction.creator_wallet,
      creatorName: auction.creator_name,
      authType: auction.auth_type,
      oAuthMethod: auction.oauth_method,
      sellerName: auction.seller_name || auction.creator_name || 'Unknown',
      twitterId: auction.twitter_id,
      title: auction.title || 'Untitled',
      description: auction.description,
      profilePicture: auction.profile_picture,
      eventDate: auction.event_date,
      eventStartTime: auction.event_start_time,
      eventEndTime: auction.event_end_time,
      meetingDuration: auction.meeting_duration,
      price: priceInToken,
      priceLabel: priceLabel,
      priceRaw: displayPrice,
      floorPrice: auction.bid_price,
      highestBid: auction.highest_bid,
      highestBidder: hasHighestBid ? auction.highest_bidder : null,
      timeLeft: timeLeftFormatted,
      timeLeftSeconds: timeRemainingSeconds,
      blocksRemaining: auction.blocks_remaining,
      endBlock: auction.end_block,
      durationBlocks: auction.duration_blocks,
      badge: badge,
      hasHighestBid: hasHighestBid,
      ended: auction.ended,
      autoEnded: auction.auto_ended,
      nftTokenId: auction.nft_token_id,
      jitsiRoomId: auction.jitsi_room_id,
      metadataIpfs: auction.metadata_ipfs,
      createdAt: auction.created_at,
      updatedAt: auction.updated_at
    };
    
    logger.info(`✅ Returned auction ${auctionId} from database`);
    
    res.json({ 
      success: true, 
      auction: formattedAuction
    });
    
  } catch (error) {
    logger.error(`Get auction ${req.params.auctionId} from DB error:`, error);
    res.status(500).json({ 
      error: 'Failed to fetch auction',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get auction details
router.get('/:auctionId', async (req, res) => {
  try {
    const { auctionId } = req.params;
    
    if (!auctionId || isNaN(auctionId)) {
      return res.status(400).json({ error: 'Invalid auction ID' });
    }
    
    // Get from database first
    const dbQuery = `
      SELECT a.*, u.display_name as creator_name, u.auth_type, u.oauth_method
      FROM auctions a
      JOIN users u ON a.creator_para_id = u.para_user_id
      WHERE a.id = $1
    `;
    const dbResult = await pool.query(dbQuery, [auctionId]);
    
    if (dbResult.rows.length === 0) {
      return res.status(404).json({ error: 'Auction not found' });
    }
    
    const auction = dbResult.rows[0];
    
    // Get blockchain data
    const contractService = getContractService();
    await contractService.initialize();
    const contractAuction = await contractService.getAuction(auctionId);
    
    if (contractAuction.id === 0) {
      return res.status(404).json({ error: 'Auction not found on blockchain' });
    }
    
    const enrichedAuction = {
      ...auction,
      reservePrice: contractAuction.reservePrice,
      highestBid: contractAuction.highestBid,
      highestBidder: contractAuction.highestBidder,
      startBlock: contractAuction.startBlock,
      endBlock: contractAuction.endBlock,
      ended: contractAuction.ended,
      meetingScheduled: contractAuction.meetingScheduled,
      nftTokenId: contractAuction.nftTokenId,
      sellerName: contractAuction.sellerName,
      eventName: contractAuction.eventName,
      eventDate: contractAuction.eventDate,
      eventStartTime: contractAuction.eventStartTime,
      eventEndTime: contractAuction.eventEndTime,
      profilePicture: contractAuction.profilePicture
    };
    
    res.json({ success: true, auction: enrichedAuction });
    
  } catch (error) {
    logger.error('Get auction error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch auction',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Place bid on auction
router.post('/:auctionId/bid', authenticateToken, async (req, res) => {
  try {
    const { auctionId } = req.params;
    const { amount, bidderWallet } = req.body;

    if (!amount || !bidderWallet) {
      return res.status(400).json({ error: 'Amount and bidder wallet required' });
    }

    // Get contract service
    const contractService = getContractService();
    await contractService.initialize();

    // Place bid
    const result = await contractService.placeBid(auctionId, amount);
    
    res.json({ 
      success: true, 
      message: 'Bid placed successfully',
      transactionHash: result.transactionHash,
      gasUsed: result.gasUsed
    });

  } catch (error) {
    logger.error('Place bid error:', error);
    res.status(500).json({ error: 'Failed to place bid', message: error.message });
  }
});

// End auction
router.post('/:auctionId/end', authenticateToken, async (req, res) => {
  try {
    const { auctionId } = req.params;

    // Get contract service
    const contractService = getContractService();
    await contractService.initialize();

    // End auction
    const result = await contractService.endAuction(auctionId);
    
    res.json({ 
      success: true, 
      message: 'Auction ended successfully',
      transactionHash: result.transactionHash,
      gasUsed: result.gasUsed
    });

  } catch (error) {
    logger.error('End auction error:', error);
    res.status(500).json({ error: 'Failed to end auction', message: error.message });
  }
});

// Cancel auction
router.post('/:auctionId/cancel', authenticateToken, async (req, res) => {
  try {
    const { auctionId } = req.params;

    // Get contract service
    const contractService = getContractService();
    await contractService.initialize();

    // Cancel auction
    const result = await contractService.cancelAuction(auctionId);
    
    res.json({ 
      success: true, 
      message: 'Auction cancelled successfully',
      transactionHash: result.transactionHash,
      gasUsed: result.gasUsed
    });

  } catch (error) {
    logger.error('Cancel auction error:', error);
    res.status(500).json({ error: 'Failed to cancel auction', message: error.message });
  }
});

module.exports = router;
