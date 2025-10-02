const { getJitsiService } = require('./JitsiService');
const paraService = require('./ParaService');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

/**
 * INTEGRATED MEETING SERVICE
 * Combines Para auth + Jitsi meetings
 */
class MeetingService {
  constructor() {
    this.jitsi = getJitsiService();
    this.initialized = true; // No async initialization needed anymore
  }

  async initialize() {
    // Kept for backwards compatibility but no longer needed
    this.initialized = true;
    logger.info('Meeting Service initialized');
    return true;
  }

  // Create a gated meeting (for auctions/NFT holders)
  async createGatedMeeting({ 
    hostUser, 
    nftContract, 
    nftTokenId, 
    meetingName,
    duration = 60,
    windowStart = null,
    windowEnd = null,
    auctionId = null  // Optional: for auction-created meetings
  }) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // Create Jitsi room
      const room = this.jitsi.createRoom({
        roomName: meetingName || `meeting-${Date.now()}`,
        displayName: `NFT Gated Meeting`,
        duration,
        maxParticipants: 10
      });

      // Create policy for NFT gating
      const policy = {
        room: room.roomId,
        erc721: nftContract,
        windowStart,
        windowEnd
      };

      // Generate host token (moderator access)
      const hostToken = this.jitsi.generateToken({
        roomName: room.roomId,
        userId: hostUser.para_user_id,
        userName: hostUser.display_name,
        email: hostUser.email,
        role: 'moderator',
        expiresIn: Math.ceil(duration / 60) + 1
      });

      // Store meeting in database (using actual schema)
      const meetingQuery = `
        INSERT INTO meetings (
          auction_id, jitsi_room_id, jitsi_room_config,
          creator_access_token, winner_access_token, room_url,
          expires_at, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
        RETURNING *
      `;

      // For NFT-gated meetings, auction_id should be 0 or null if not from auction
      // We'll store NFT info in the config
      const roomConfig = {
        ...room.config,
        nftContract,
        nftTokenId,
        policy,
        gated: true
      };

      const meetingResult = await pool.query(meetingQuery, [
        auctionId || 0, // Use provided auction_id or 0 for manually created meetings
        room.roomId,
        JSON.stringify(roomConfig),
        hostToken,
        null, // winner token not yet generated
        room.url,
        room.expiresAt
      ]);

      const meeting = meetingResult.rows[0];

      logger.info(`Gated meeting created: ${room.roomId} for NFT ${nftContract}:${nftTokenId}`);

      return {
        success: true,
        meeting: {
          id: meeting.id,
          roomId: room.roomId,
          url: room.url,
          policy,
          expiresAt: room.expiresAt
        },
        host: {
          token: hostToken,
          url: this.jitsi.generateMeetingUrl({
            roomId: room.roomId,
            token: hostToken,
            userName: hostUser.display_name,
            userEmail: hostUser.email,
            role: 'moderator'
          })
        }
      };

    } catch (error) {
      logger.error('Failed to create gated meeting:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Create simple Para-authenticated meeting (no NFT gating)
  async createSimpleMeeting({ hostUser, guestUser, meetingName, duration = 60 }) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // Create Jitsi room
      const room = this.jitsi.createRoom({
        roomName: meetingName || `simple-meeting-${Date.now()}`,
        displayName: `Meeting: ${hostUser.display_name} & ${guestUser.display_name}`,
        duration,
        maxParticipants: 2
      });

      // Generate tokens for both users
      const hostToken = this.jitsi.generateToken({
        roomName: room.roomId,
        userId: hostUser.para_user_id,
        userName: hostUser.display_name,
        email: hostUser.email,
        role: 'moderator',
        expiresIn: Math.ceil(duration / 60) + 1
      });

      const guestToken = this.jitsi.generateToken({
        roomName: room.roomId,
        userId: guestUser.para_user_id,
        userName: guestUser.display_name,
        email: guestUser.email,
        role: 'participant',
        expiresIn: Math.ceil(duration / 60) + 1
      });

      // Store meeting in database (using actual schema)
      const roomConfig = {
        ...room.config,
        gated: false,
        hostUserId: hostUser.id,
        guestUserId: guestUser.id
      };

      const meetingQuery = `
        INSERT INTO meetings (
          auction_id, jitsi_room_id, jitsi_room_config,
          creator_access_token, winner_access_token, room_url,
          expires_at, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
        RETURNING *
      `;

      const meetingResult = await pool.query(meetingQuery, [
        0, // No auction for simple meetings
        room.roomId,
        JSON.stringify(roomConfig),
        hostToken,
        guestToken,
        room.url,
        room.expiresAt
      ]);

      const meeting = meetingResult.rows[0];

      logger.info(`Simple meeting created: ${room.roomId} between users ${hostUser.id} and ${guestUser.id}`);

      return {
        success: true,
        meeting: {
          id: meeting.id,
          roomId: room.roomId,
          url: room.url,
          expiresAt: room.expiresAt
        },
        participants: {
          host: {
            token: hostToken,
            url: this.jitsi.generateMeetingUrl({
              roomId: room.roomId,
              token: hostToken,
              userName: hostUser.display_name,
              userEmail: hostUser.email,
              role: 'moderator'
            })
          },
          guest: {
            token: guestToken,
            url: this.jitsi.generateMeetingUrl({
              roomId: room.roomId,
              token: guestToken,
              userName: guestUser.display_name,
              userEmail: guestUser.email,
              role: 'participant'
            })
          }
        }
      };

    } catch (error) {
      logger.error('Failed to create simple meeting:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Join gated meeting (requires NFT BURN verification)
  async joinGatedMeeting({ roomId, user, burnTransactionHash }) {
    try {
      logger.info(`🔐 ========== NFT BURN VERIFICATION STARTED ==========`);
      logger.info(`👤 User ID: ${user.id}`);
      logger.info(`👛 Wallet: ${user.wallet_address}`);
      logger.info(`🚪 Room ID: ${roomId}`);
      logger.info(`🔥 Burn TX Hash: ${burnTransactionHash}`);

      // Step 1: Validate inputs
      if (!user.wallet_address) {
        logger.error(`❌ VERIFICATION FAILED: User ${user.id} has no wallet address`);
        return {
          success: false,
          error: 'Wallet address required for NFT verification'
        };
      }

      if (!burnTransactionHash || !burnTransactionHash.match(/^0x[a-fA-F0-9]{64}$/)) {
        logger.error(`❌ VERIFICATION FAILED: Invalid burn transaction hash`);
        return {
          success: false,
          error: 'Valid burn transaction hash required'
        };
      }

      // Step 2: Get meeting from database
      logger.info(`📋 Step 1: Fetching meeting from database...`);
      const meetingQuery = 'SELECT * FROM meetings WHERE jitsi_room_id = $1 AND expires_at > CURRENT_TIMESTAMP';
      const meetingResult = await pool.query(meetingQuery, [roomId]);

      if (meetingResult.rows.length === 0) {
        logger.error(`❌ VERIFICATION FAILED: Meeting not found or expired: ${roomId}`);
        return {
          success: false,
          error: 'Meeting not found or expired'
        };
      }

      const meeting = meetingResult.rows[0];
      const auctionId = meeting.auction_id;
      
      // Extract NFT info from room config
      const roomConfig = meeting.jitsi_room_config ? JSON.parse(meeting.jitsi_room_config) : {};
      const nftContract = roomConfig.nftContract;
      const nftTokenId = roomConfig.nftTokenId;

      logger.info(`✅ Meeting found!`);
      logger.info(`   📦 Auction ID: ${auctionId}`);
      logger.info(`   🎨 NFT Contract: ${nftContract}`);
      logger.info(`   🎫 NFT Token ID: ${nftTokenId}`);

      if (!nftContract || !nftTokenId) {
        logger.error(`❌ VERIFICATION FAILED: Meeting has no NFT gating info`);
        return {
          success: false,
          error: 'Meeting is not NFT-gated'
        };
      }

      // Step 3: Verify burn transaction on blockchain
      logger.info(`🔍 Step 2: Verifying burn transaction on blockchain...`);
      
      const { getContractService } = require('./ContractService');
      const contractService = getContractService();
      await contractService.initialize();

      // Get transaction receipt
      const receipt = await contractService.provider.getTransactionReceipt(burnTransactionHash);
      
      if (!receipt) {
        logger.error(`❌ VERIFICATION FAILED: Transaction not found: ${burnTransactionHash}`);
        return {
          success: false,
          error: 'Burn transaction not found on blockchain'
        };
      }

      if (receipt.status !== 1) {
        logger.error(`❌ VERIFICATION FAILED: Transaction failed on blockchain`);
        return {
          success: false,
          error: 'Burn transaction failed'
        };
      }

      logger.info(`✅ Transaction receipt found and successful`);
      logger.info(`   📍 Block: ${receipt.blockNumber}`);
      logger.info(`   ⛽ Gas Used: ${receipt.gasUsed.toString()}`);

      // Step 4: Verify NFT burn event in transaction logs
      logger.info(`🔍 Step 3: Checking for NFTBurnedForMeeting event...`);
      
      const ethers = require('ethers');
      const iface = new ethers.Interface([
        'event NFTBurnedForMeeting(uint256 indexed tokenId, uint256 indexed auctionId, address indexed user)'
      ]);

      let burnEventFound = false;
      let eventData = null;

      logger.info(`   📝 Scanning ${receipt.logs.length} logs in transaction...`);

      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed && parsed.name === 'NFTBurnedForMeeting') {
            eventData = {
              tokenId: Number(parsed.args.tokenId),
              auctionId: Number(parsed.args.auctionId),
              user: parsed.args.user.toLowerCase()
            };

            logger.info(`🔥 NFTBurnedForMeeting Event Found!`);
            logger.info(`   🎫 Token ID: ${eventData.tokenId}`);
            logger.info(`   📦 Auction ID: ${eventData.auctionId}`);
            logger.info(`   👛 User: ${eventData.user}`);

            // Verify it matches our meeting requirements
            const tokenIdMatch = eventData.tokenId === Number(nftTokenId);
            const auctionIdMatch = eventData.auctionId === Number(auctionId);
            const userMatch = eventData.user === user.wallet_address.toLowerCase();

            logger.info(`🔍 Verification Check:`);
            logger.info(`   Token ID Match: ${tokenIdMatch} (expected: ${nftTokenId}, got: ${eventData.tokenId})`);
            logger.info(`   Auction ID Match: ${auctionIdMatch} (expected: ${auctionId}, got: ${eventData.auctionId})`);
            logger.info(`   User Match: ${userMatch} (expected: ${user.wallet_address.toLowerCase()}, got: ${eventData.user})`);

            if (tokenIdMatch && auctionIdMatch && userMatch) {
              burnEventFound = true;
              logger.info(`✅ ALL CHECKS PASSED! Burn event is valid!`);
              break;
            } else {
              logger.warn(`⚠️  Burn event found but doesn't match requirements`);
            }
          }
        } catch (e) {
          // Not the event we're looking for, continue
        }
      }

      if (!burnEventFound) {
        logger.error(`❌ VERIFICATION FAILED: Valid NFT burn event not found in transaction`);
        logger.error(`   Expected event with:`);
        logger.error(`   - Token ID: ${nftTokenId}`);
        logger.error(`   - Auction ID: ${auctionId}`);
        logger.error(`   - User: ${user.wallet_address.toLowerCase()}`);
        return {
          success: false,
          error: 'NFT burn verification failed - no valid burn event found'
        };
      }

      // Step 5: Check if already used (prevent replay attacks)
      logger.info(`🔍 Step 4: Checking for replay attacks...`);
      
      const existingAccess = await pool.query(
        'SELECT * FROM meeting_access_logs WHERE transaction_hash = $1',
        [burnTransactionHash]
      );

      if (existingAccess.rows.length > 0) {
        logger.error(`❌ VERIFICATION FAILED: Burn transaction already used for access`);
        logger.error(`   Previously used at: ${existingAccess.rows[0].accessed_at}`);
        return {
          success: false,
          error: 'This NFT burn has already been used to access the meeting'
        };
      }

      logger.info(`✅ No replay attack detected - burn transaction is fresh`);

      // Step 6: Log the verified access
      logger.info(`📝 Step 5: Logging verified access to database...`);
      
      await pool.query(`
        INSERT INTO meeting_access_logs (
          auction_id, user_para_id, wallet_address, nft_token_id,
          transaction_hash, access_method, accessed_at
        ) VALUES ($1, $2, $3, $4, $5, 'nft_burn_verified', NOW())
      `, [
        auctionId,
        user.para_user_id,
        user.wallet_address.toLowerCase(),
        nftTokenId,
        burnTransactionHash
      ]);

      logger.info(`✅ Access logged successfully`);

      // Step 7: Generate meeting access token (ONLY after all verification passes)
      logger.info(`🎟️  Step 6: Generating meeting access token...`);
      
      const attendeeToken = this.jitsi.generateToken({
        roomName: roomId,
        userId: user.para_user_id,
        userName: user.display_name,
        email: user.email,
        role: 'participant',
        expiresIn: 2 // 2 hours max
      });

      const meetingUrl = this.jitsi.generateMeetingUrl({
        roomId,
        token: attendeeToken,
        userName: user.display_name,
        userEmail: user.email,
        role: 'participant'
      });

      logger.info(`✅ Meeting access token generated`);
      logger.info(`🎉 ========== VERIFICATION SUCCESSFUL ==========`);
      logger.info(`✅ User ${user.id} (${user.wallet_address}) verified and granted access to meeting ${roomId}`);
      logger.info(`🔥 Burned NFT Token ID ${nftTokenId} from Auction ${auctionId}`);
      logger.info(`📍 Burn TX: ${burnTransactionHash}`);
      logger.info(`====================================================`);

      return {
        success: true,
        token: attendeeToken,
        url: meetingUrl,
        meeting: {
          roomId: roomId,
          expiresAt: meeting.expires_at,
          verified: true,
          burnTxHash: burnTransactionHash,
          nftTokenId: nftTokenId,
          auctionId: auctionId
        }
      };

    } catch (error) {
      logger.error(`❌ ========== VERIFICATION ERROR ==========`);
      logger.error(`Error during NFT burn verification:`, error);
      logger.error(`Stack trace:`, error.stack);
      logger.error(`===========================================`);
      return {
        success: false,
        error: error.message || 'Failed to verify NFT burn'
      };
    }
  }

  // Get meeting info
  async getMeetingInfo(roomId) {
    try {
      const query = 'SELECT * FROM meetings WHERE room_id = $1';
      const result = await pool.query(query, [roomId]);

      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'Meeting not found'
        };
      }

      const meeting = result.rows[0];
      const policy = meeting.policy ? JSON.parse(meeting.policy) : null;

      return {
        success: true,
        meeting: {
          id: meeting.id,
          roomId: meeting.room_id,
          url: `https://8x8.vc/${meeting.room_id}`,
          policy,
          hostUserId: meeting.host_user_id,
          guestUserId: meeting.guest_user_id,
          expiresAt: meeting.expires_at,
          createdAt: meeting.created_at
        }
      };

    } catch (error) {
      logger.error('Failed to get meeting info:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new MeetingService();
