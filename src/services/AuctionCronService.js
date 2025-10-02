const cron = require('node-cron');
const ethers = require('ethers');
const logger = require('../utils/logger');
const { pool } = require('../config/database');
const MeetingAuctionABI = require('../contracts/MeetingAuction.json');
const { getJitsiService } = require('./JitsiService');

class AuctionCronService {
  constructor() {
    this.contractAddress = process.env.CONTRACT_ADDRESS || '0x9171Cf8E1d3c7EBf7bf8866CcD2c8C58512A3Be8';
    this.web3 = null;
    this.contract = null;
    this.provider = null;
    this.wallet = null;
    this.isRunning = false;
    
    this.initialize();
  }

  async initialize() {
    try {
      // Initialize Web3 connection
      const rpcUrl = process.env.RPC_URL || process.env.AVALANCHE_RPC || 'https://api.avax-test.network/ext/bc/C/rpc';
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      
      // Initialize wallet for transactions
      const privateKey = process.env.PLATFORM_PRIVATE_KEY || process.env.WALLET_PRIVATE_KEY;
      if (privateKey) {
        this.wallet = new ethers.Wallet(privateKey, this.provider);
        logger.info('Auction cron service wallet initialized', {
          walletAddress: this.wallet.address
        });
      } else {
        logger.warn('No wallet private key provided - auction auto-ending disabled');
      }
      
      // Initialize contract
      this.contract = new ethers.Contract(
        this.contractAddress,
        MeetingAuctionABI,
        this.wallet || this.provider
      );

      logger.info('Auction cron service initialized', {
        contractAddress: this.contractAddress,
        hasWallet: !!this.wallet
      });

    } catch (error) {
      logger.error('Failed to initialize auction cron service:', error);
    }
  }

  /**
   * Start the cron job - runs every 2 minutes
   */
  start() {
    if (this.isRunning) {
      logger.warn('Auction cron job already running');
      return;
    }

    // Enhanced startup logging
    logger.info('🤖 STARTING AUCTION CRON SERVICE');
    logger.info(`⏰ Schedule: Every 2 minutes`);
    logger.info(`💼 Wallet: ${this.wallet ? this.wallet.address : 'NONE (read-only mode)'}`);
    logger.info(`📝 Contract: ${this.contractAddress}`);
    logger.info('='.repeat(60));

    // Run every 2 minutes to check for ended auctions
    this.job = cron.schedule('*/2 * * * *', async () => {
      const startTime = new Date();
      logger.info(`🚀 CRON JOB TRIGGERED at ${startTime.toISOString()}`);
      
      try {
        await this.processEndedAuctions();
        const duration = Date.now() - startTime.getTime();
        logger.info(`✅ CRON JOB COMPLETED in ${duration}ms`);
      } catch (error) {
        const duration = Date.now() - startTime.getTime();
        logger.error(`❌ CRON JOB FAILED after ${duration}ms:`, error);
      }
      
      logger.info('─'.repeat(60));
    }, {
      scheduled: false
    });

    this.job.start();
    this.isRunning = true;
    
    // Run initial check after 5 seconds
    logger.info('🎬 Running initial auction check in 5 seconds...');
    setTimeout(async () => {
      try {
        const startTime = new Date();
        logger.info(`🔍 INITIAL CHECK at ${startTime.toISOString()}`);
        await this.processEndedAuctions();
        logger.info('✅ Initial auction check completed');
      } catch (error) {
        logger.error('❌ Initial auction check failed:', error);
      }
    }, 5000);

    logger.info('🟢 Auction cron job started successfully!');
    logger.info('📊 Next automatic check in 2 minutes...');
  }

  /**
   * Stop the cron job
   */
  stop() {
    if (this.job) {
      this.job.stop();
      this.isRunning = false;
      logger.info('Auction cron job stopped');
    }
  }

  /**
   * Main function to process ended auctions
   */
  async processEndedAuctions() {
    try {
      logger.info('🔍 CHECKING FOR ENDED AUCTIONS...');

      // Get current block number
      const currentBlock = await this.provider.getBlockNumber();
      logger.info(`📦 Current block: ${currentBlock}`);
      
      // Get auction counter and manually check each auction (since getActiveAuctions() has ABI issues)
      const auctionCounter = await this.contract.auctionCounter();
      logger.info(`🏷️  Total auctions in contract: ${Number(auctionCounter)}`);
      
      const activeAuctionIds = [];
      const totalAuctions = Number(auctionCounter);
      
      // Check each auction individually
      logger.info('📋 Scanning all auctions...');
      for (let i = 1; i <= totalAuctions; i++) {
        try {
          const auction = await this.contract.getAuction(i);
          // Include all auctions (active and ended) for processing
          if (!auction.ended) {
            activeAuctionIds.push(BigInt(i));
            logger.info(`  📌 Auction ${i}: Active (ends at block ${Number(auction.endBlock)})`);
          } else {
            // Check if this ended auction has been processed in the database
            const dbAuction = await this.getAuctionFromDatabase(i);
            if (dbAuction && !dbAuction.auto_ended) {
              activeAuctionIds.push(BigInt(i));
              logger.info(`  🔄 Auction ${i}: Ended but not processed - needs processing`);
            } else {
              logger.info(`  ✅ Auction ${i}: Already ended and processed`);
            }
          }
        } catch (error) {
          logger.warn(`  ⚠️  Failed to check auction ${i}:`, error.message);
        }
      }
      
      logger.info(`📊 Found ${activeAuctionIds.length} active auctions out of ${totalAuctions} total`);
      
      const endedAuctions = [];
      const readyToEndAuctions = [];

      // Check each auction for processing
      logger.info('⏰ Checking auctions for processing...');
      for (const auctionId of activeAuctionIds) {
        try {
          const auction = await this.contract.getAuction(auctionId);
          const endBlock = Number(auction.endBlock);
          const blocksRemaining = endBlock - currentBlock;
          
          // Check if auction has ended (current block >= end block) OR is already ended
          if ((currentBlock >= endBlock && !auction.ended) || auction.ended) {
            // Process all ended auctions (with or without bids)
            const hasWinner = auction.highestBidder !== ethers.ZeroAddress;
            readyToEndAuctions.push({
              id: auctionId,
              auction: auction
            });
            
            if (hasWinner) {
              logger.info(`  🎯 Auction ${auctionId}: ENDED with winner ${auction.highestBidder} (bid: ${ethers.formatEther(auction.highestBid)} AVAX)`);
            } else {
              logger.info(`  🎯 Auction ${auctionId}: ENDED without bids - processing auction`);
            }
          } else if (blocksRemaining <= 10) {
            logger.info(`  ⏳ Auction ${auctionId}: Ending soon (${blocksRemaining} blocks remaining)`);
          } else {
            logger.info(`  🕐 Auction ${auctionId}: Active (${blocksRemaining} blocks remaining)`);
          }
        } catch (error) {
          logger.warn(`  ❌ Failed to check auction ${auctionId}:`, error.message);
        }
      }

      if (readyToEndAuctions.length === 0) {
        logger.info('✨ No auctions ready to end at this time');
        return;
      }

      logger.info(`🚀 Processing ${readyToEndAuctions.length} auction(s) ready to end...`);

      // Process each ended auction
      for (const { id, auction } of readyToEndAuctions) {
        logger.info(`🔄 Processing auction ${id}...`);
        await this.processSingleAuction(id, auction);
      }

    } catch (error) {
      logger.error('Error in auction cron job:', error);
    }
  }

  /**
   * Process a single ended auction
   */
  async processSingleAuction(auctionId, auction) {
    try {
      logger.info(`🎯 PROCESSING ENDED AUCTION ${auctionId}`);
      logger.info(`   👤 Creator: ${auction.host}`);
      logger.info(`   🏆 Winner: ${auction.highestBidder}`);
      logger.info(`   💰 Winning bid: ${ethers.formatEther(auction.highestBid)} AVAX`);

      // Step 1: End the auction on-chain (only if not already ended)
      if (!auction.ended) {
        logger.info(`🔗 Step 1: Ending auction ${auctionId} on blockchain...`);
        await this.endAuctionOnChain(auctionId);
      } else {
        logger.info(`🔗 Step 1: Auction ${auctionId} already ended on blockchain, skipping...`);
      }

      // Step 2: Get updated auction data (with NFT token ID)
      logger.info(`📊 Step 2: Getting updated auction data...`);
      const updatedAuction = await this.contract.getAuction(auctionId);
      
      if (updatedAuction.nftTokenId && Number(updatedAuction.nftTokenId) > 0) {
        logger.info(`🎨 NFT minted successfully! Token ID: ${updatedAuction.nftTokenId.toString()}`);
      }

      // Step 3: Get user data for creator and winner
      const creatorData = await this.getUserDataByWallet(auction.host);
      const winnerData = auction.highestBidder !== ethers.ZeroAddress 
        ? await this.getUserDataByWallet(auction.highestBidder) 
        : null;

      // Step 4: Create meeting
      logger.info(`🎬 Step 4: Creating Jitsi meeting...`);
      const meeting = await this.createMeetingForAuction({
        auctionId: auctionId,
        auction: updatedAuction,
        creatorData,
        winnerData
      });
      
      if (meeting && meeting.roomUrl) {
        logger.info(`✅ Meeting created successfully!`);
        logger.info(`🔗 Meeting URL: ${meeting.roomUrl}`);
      }

      // Step 5: Update database
      await this.updateAuctionInDatabase(auctionId, updatedAuction, meeting);

      // Step 6: Schedule meeting on-chain
      if (meeting && meeting.success) {
        await this.scheduleMeetingOnChain(auctionId, meeting.meeting.roomId);
      }

      logger.info(`Successfully processed auction ${auctionId}`, {
        hasWinner: !!winnerData,
        nftTokenId: updatedAuction.nftTokenId.toString(),
        meetingCreated: meeting?.success || false
      });

    } catch (error) {
      logger.error(`Failed to process auction ${auctionId}:`, error);
    }
  }

  /**
   * End auction on blockchain
   */
  async endAuctionOnChain(auctionId) {
    if (!this.wallet) {
      throw new Error('No wallet configured for auction ending');
    }

    try {
      logger.info(`⛽ Sending endAuction transaction for auction ${auctionId}...`);
      logger.info(`💼 Using wallet: ${this.wallet.address}`);

      const tx = await this.contract.endAuction(auctionId);
      logger.info(`📝 Transaction submitted: ${tx.hash}`);
      logger.info(`⏳ Waiting for confirmation...`);
      
      const receipt = await tx.wait();

      if (receipt.status === 1) {
        logger.info(`✅ Auction ${auctionId} ended successfully!`);
        logger.info(`⛽ Gas used: ${receipt.gasUsed.toString()}`);
        logger.info(`🔗 Transaction: ${receipt.hash}`);
      } else {
        logger.error(`❌ Transaction failed for auction ${auctionId}`);
      }

      return receipt;
    } catch (error) {
      logger.error(`Failed to end auction ${auctionId} on-chain:`, error);
      throw error;
    }
  }

  /**
   * Create Jitsi meeting for the auction
   */
  async createMeetingForAuction({ auctionId, auction, creatorData, winnerData }) {
    try {
      const jitsi = getJitsiService();

      // Create meeting with auction data
      const meeting = jitsi.createAuctionMeeting({
        auctionId: Number(auctionId),
        hostData: {
          paraId: creatorData?.para_user_id || 'unknown',
          name: creatorData?.display_name || 'Auction Creator',
          email: creatorData?.email || 'creator@example.com'
        },
        winnerData: winnerData ? {
          paraId: winnerData.para_user_id || 'unknown',
          name: winnerData.display_name || 'Auction Winner',
          email: winnerData.email || 'winner@example.com'
        } : null,
        duration: auction.duration || 60
      });

      return meeting;
    } catch (error) {
      logger.error(`Failed to create meeting for auction ${auctionId}:`, error);
      return null;
    }
  }

  /**
   * Get auction from database
   */
  async getAuctionFromDatabase(auctionId) {
    try {
      const query = 'SELECT * FROM auctions WHERE id = $1';
      const result = await pool.query(query, [auctionId]);
      
      if (result.rows.length > 0) {
        return result.rows[0];
      }
      
      return null;
    } catch (error) {
      logger.error('Error getting auction from database:', error);
      return null;
    }
  }

  /**
   * Get user data by wallet address
   */
  async getUserDataByWallet(walletAddress) {
    try {
      const result = await pool.query(
        'SELECT * FROM users WHERE wallet_address = $1',
        [walletAddress.toLowerCase()]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.warn(`Failed to get user data for wallet ${walletAddress}:`, error.message);
      return null;
    }
  }

  /**
   * Update auction in database
   */
  async updateAuctionInDatabase(auctionId, auction, meeting) {
    try {
      // Update auction record
      await pool.query(`
        UPDATE auctions 
        SET nft_token_id = $1, 
            jitsi_room_id = $2, 
            auto_ended = TRUE 
        WHERE id = $3
      `, [
        auction.nftTokenId ? auction.nftTokenId.toString() : null,
        meeting?.meeting?.roomId || null,
        auctionId.toString()
      ]);

      // Insert meeting record if meeting was created
      if (meeting && meeting.success) {
        await pool.query(`
          INSERT INTO meetings (
            auction_id, jitsi_room_id, jitsi_room_config,
            creator_access_token, winner_access_token, room_url
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          auctionId.toString(),
          meeting.meeting.roomId,
          JSON.stringify(meeting.meeting.config),
          meeting.host.token || null,
          meeting.winner?.token || null,
          meeting.meeting.baseUrl
        ]);
      }

      logger.info(`Updated database for auction ${auctionId}`);
    } catch (error) {
      logger.error(`Failed to update database for auction ${auctionId}:`, error);
    }
  }

  /**
   * Schedule meeting on-chain
   */
  async scheduleMeetingOnChain(auctionId, meetingRoomId) {
    if (!this.wallet) {
      logger.warn('No wallet configured for meeting scheduling');
      return;
    }

    try {
      const tx = await this.contract.scheduleMeeting(auctionId, meetingRoomId);
      const receipt = await tx.wait();

      logger.info(`Meeting scheduled on-chain for auction ${auctionId}`, {
        transactionHash: receipt.hash,
        meetingRoomId
      });

      return receipt;
    } catch (error) {
      logger.error(`Failed to schedule meeting on-chain for auction ${auctionId}:`, error);
    }
  }

  /**
   * Manual trigger for testing
   */
  async triggerManually() {
    logger.info('Manually triggering auction processing...');
    await this.processEndedAuctions();
  }
}

// Singleton instance
let auctionCronService = null;

function getAuctionCronService() {
  if (!auctionCronService) {
    auctionCronService = new AuctionCronService();
  }
  return auctionCronService;
}

module.exports = {
  AuctionCronService,
  getAuctionCronService
};
