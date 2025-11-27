const cron = require('node-cron');
const ethers = require('ethers');
const logger = require('../utils/logger');
const { pool } = require('../config/database');
const MeetingAuctionABI = require('../contracts/MeetingAuction.json');
const { getJitsiService } = require('./JitsiService');
const BlockNumberService = require('./BlockNumberService');

class AuctionCronService {
  constructor() {
    this.contractAddress = process.env.CONTRACT_ADDRESS || '0x9171Cf8E1d3c7EBf7bf8866CcD2c8C58512A3Be8';
    this.web3 = null;
    this.contract = null;
    this.provider = null;
    this.wallet = null;
    this.blockNumberService = null;
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

      // Initialize BlockNumberService for L2 block number support (Arbitrum)
      const blockTestAddress = process.env.BLOCKTEST_CONTRACT_ADDRESS;
      this.blockNumberService = new BlockNumberService(this.provider, blockTestAddress);

      logger.info('Auction cron service initialized', {
        contractAddress: this.contractAddress,
        hasWallet: !!this.wallet,
        hasBlockNumberService: !!this.blockNumberService
      });

    } catch (error) {
      logger.error('Failed to initialize auction cron service:', error);
    }
  }

  /**
   * Start the cron job - runs every 10 seconds
   */
  start() {
    if (this.isRunning) {
      logger.warn('Auction cron job already running');
      return;
    }

    // Enhanced startup logging
    logger.info('🤖 STARTING AUCTION CRON SERVICE');
    logger.info(`⏰ Schedule: Every 10 seconds`);
    logger.info(`💼 Wallet: ${this.wallet ? this.wallet.address : 'NONE (read-only mode)'}`);
    logger.info(`📝 Contract: ${this.contractAddress}`);
    logger.info('='.repeat(60));

    // Run every 10 seconds to check for ended auctions
    const runJob = async () => {
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
    };

    // Use setInterval for 10-second intervals (cron doesn't support seconds)
    this.job = setInterval(runJob, 10000); // 10000ms = 10 seconds
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
    logger.info('📊 Next automatic check in 10 seconds...');
  }

  /**
   * Stop the cron job
   */
  stop() {
    if (this.job) {
      clearInterval(this.job);
      this.isRunning = false;
      logger.info('Auction cron job stopped');
    }
  }

  /**
   * Main function to process ended auctions - OPTIMIZED
   */
  async processEndedAuctions() {
    try {
      logger.info('🔍 CHECKING FOR ENDED AUCTIONS (OPTIMIZED)...');

      // Get current block number using BlockNumberService (handles L2 for Arbitrum)
      const currentBlock = await this.blockNumberService.getCurrentBlock();
      logger.info(`📦 Current block (L2 for Arbitrum): ${currentBlock}`);

      // PHASE 1 OPTIMIZATION: Database-first filtering
      logger.info('📊 Step 1: Checking database for unprocessed auctions...');
      const dbResult = await pool.query(`
        SELECT id FROM auctions
        WHERE auto_ended = FALSE OR auto_ended IS NULL
        ORDER BY id ASC
      `);

      const unprocessedIds = dbResult.rows.map(row => Number(row.id));
      logger.info(`💾 Found ${unprocessedIds.length} unprocessed auctions in database`);

      if (unprocessedIds.length === 0) {
        logger.info('✨ All auctions already processed!');
        return;
      }

      // PHASE 1 OPTIMIZATION: Use contract's getActiveAuctions() instead of looping
      logger.info('🔗 Step 2: Fetching active auctions from smart contract...');
      let activeAuctionIds = [];
      try {
        // Get active auctions from contract (much more efficient!)
        const activeIds = await this.contract.getActiveAuctions(0, 100);
        activeAuctionIds = activeIds.map(id => Number(id));
        logger.info(`⛓️  Contract reports ${activeAuctionIds.length} active auctions`);
      } catch (error) {
        logger.warn('⚠️  getActiveAuctions() failed, falling back to unprocessed list:', error.message);
        activeAuctionIds = unprocessedIds;
      }

      // Combine: auctions that are either active OR unprocessed
      const auctionsToCheck = [...new Set([...activeAuctionIds, ...unprocessedIds])];
      logger.info(`🔍 Total auctions to check: ${auctionsToCheck.length}`);
      logger.info(`   ↳ Saved ${Math.max(0, 100 - auctionsToCheck.length)} unnecessary RPC calls!`);

      const readyToEndAuctions = [];

      // Check each auction for processing
      logger.info('⏰ Step 3: Checking which auctions are ready to end...');
      for (const auctionId of auctionsToCheck) {
        try {
          const auction = await this.contract.getAuction(auctionId);
          const endBlock = Number(auction.endBlock);
          const blocksRemaining = endBlock - currentBlock;

          // Check if auction has ended (current block >= end block) OR is already ended on-chain
          if ((currentBlock >= endBlock && !auction.ended) || (auction.ended && unprocessedIds.includes(Number(auctionId)))) {
            const hasWinner = auction.highestBidder !== ethers.ZeroAddress;
            readyToEndAuctions.push({
              id: BigInt(auctionId),
              auction: auction,
              needsOnChainEnd: !auction.ended
            });

            if (hasWinner) {
              logger.info(`  🎯 Auction ${auctionId}: Ready to process - Winner: ${auction.highestBidder} (${ethers.formatEther(auction.highestBid)} AVAX)`);
            } else {
              logger.info(`  🎯 Auction ${auctionId}: Ready to process - No bids`);
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
        // Don't return yet - we still need to update active auctions in Step 6
      } else {
        logger.info(`🚀 Step 4: Processing ${readyToEndAuctions.length} auction(s)...`);

        // PHASE 2 OPTIMIZATION: Batch end auctions on-chain
        const auctionsNeedingOnChainEnd = readyToEndAuctions.filter(a => a.needsOnChainEnd);

        if (auctionsNeedingOnChainEnd.length > 0) {
          logger.info(`⛓️  BATCH ENDING ${auctionsNeedingOnChainEnd.length} auctions on-chain...`);
          const idsToEnd = auctionsNeedingOnChainEnd.map(a => a.id);

          try {
            await this.batchEndAuctionsOnChain(idsToEnd);
          } catch (error) {
            logger.error('❌ Batch ending failed, falling back to one-by-one:', error.message);
            // Fallback: process individually if batch fails
            for (const { id } of auctionsNeedingOnChainEnd) {
              try {
                await this.endAuctionOnChain(id);
              } catch (err) {
                logger.error(`Failed to end auction ${id}:`, err.message);
              }
            }
          }
        } else {
          logger.info('✅ All auctions already ended on-chain, just updating database...');
        }

        // Update database for all processed auctions
        logger.info('📝 Step 5: Updating database for all processed auctions...');
        for (const { id } of readyToEndAuctions) {
          try {
            // Get updated auction data (with NFT token ID if minted)
            const updatedAuction = await this.contract.getAuction(id);

            if (updatedAuction.nftTokenId && Number(updatedAuction.nftTokenId) > 0) {
              logger.info(`  🎨 Auction ${id}: NFT Token ID: ${updatedAuction.nftTokenId.toString()}`);
            }

            await this.updateAuctionInDatabase(id, updatedAuction, null);
            logger.info(`  ✅ Auction ${id}: Database updated`);
          } catch (error) {
            logger.error(`  ❌ Failed to update database for auction ${id}:`, error.message);
          }
        }
      }

      // NEW: Update bid amounts and time remaining for active auctions
      logger.info('📊 Step 6: Updating bid amounts and time remaining for active auctions...');
      const activeAuctionsForUpdate = auctionsToCheck.filter(
        id => !readyToEndAuctions.some(r => Number(r.id) === id)
      );

      if (activeAuctionsForUpdate.length > 0) {
        await this.updateActiveBidsAndTime(activeAuctionsForUpdate, currentBlock);
      } else {
        logger.info('  ℹ️  No active auctions to update');
      }

      logger.info('🎉 Batch processing completed successfully!');

    } catch (error) {
      logger.error('Error in auction cron job:', error);
    }
  }

  /**
   * Process a single ended auction
   */
  async processSingleAuction(auctionId, auction) {
    try {
      // Check if this is a known problematic auction
      const PROBLEMATIC_AUCTIONS = [35, 36];
      if (PROBLEMATIC_AUCTIONS.includes(auctionId)) {
        logger.warn(`⚠️  Auction ${auctionId}: Known problematic auction with "Token transfer failed" error, skipping...`);
        logger.info(`📝 Manual intervention required for auction ${auctionId}`);
        logger.info(`💡 This auction has a smart contract bug and needs to be resolved manually`);
        return;
      }

      logger.info(`🎯 PROCESSING ENDED AUCTION ${auctionId}`);
      logger.info(`   👤 Creator: ${auction.host}`);
      logger.info(`   🏆 Winner: ${auction.highestBidder}`);
      logger.info(`   💰 Winning bid: ${ethers.formatEther(auction.highestBid)} AVAX`);

      // Step 1: End the auction on-chain (only if not already ended)
      if (!auction.ended) {
        logger.info(`🔗 Step 1: Ending auction ${auctionId} on blockchain...`);
        const endResult = await this.endAuctionOnChain(auctionId);
        
        // If endAuctionOnChain returned null (problematic auction), skip processing
        if (endResult === null) {
          logger.warn(`⚠️  Skipping further processing for auction ${auctionId} due to contract bug`);
          return;
        }
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

      // Step 4: Update database (Meeting will be created when winner burns NFT)
      logger.info(`📝 Step 4: Updating auction in database...`);
      logger.info(`⚠️  Meeting will be created ON-DEMAND when winner burns NFT`);
      await this.updateAuctionInDatabase(auctionId, updatedAuction, null);

      logger.info(`Successfully processed auction ${auctionId}`, {
        hasWinner: !!winnerData,
        nftTokenId: updatedAuction.nftTokenId.toString(),
        note: 'Meeting will be created when winner burns NFT to access'
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

      // Check if it's a token transfer error
      if (error.message && error.message.includes('Token transfer failed')) {
        logger.warn(`⚠️  Auction ${auctionId}: "Token transfer failed" - this is a known smart contract bug`);
        logger.info(`📝 Adding auction ${auctionId} to problematic auctions list`);
        logger.info(`💡 Manual intervention required - this auction needs to be resolved manually`);
        // Don't throw the error, just log it and continue
        return null;
      }

      throw error;
    }
  }

  /**
   * Batch end multiple auctions on blockchain - PHASE 2 OPTIMIZATION
   */
  async batchEndAuctionsOnChain(auctionIds) {
    if (!this.wallet) {
      throw new Error('No wallet configured for auction ending');
    }

    // Check for problematic auctions and filter them out
    const PROBLEMATIC_AUCTIONS = [35, 36];
    const validIds = [];
    const skippedIds = [];

    for (const id of auctionIds) {
      const numId = Number(id);
      if (PROBLEMATIC_AUCTIONS.includes(numId)) {
        logger.warn(`⚠️  Skipping auction ${id} - known problematic auction`);
        skippedIds.push(id);
      } else {
        validIds.push(id);
      }
    }

    if (validIds.length === 0) {
      logger.warn('No valid auctions to batch end (all were problematic)');
      return null;
    }

    try {
      logger.info(`⛓️  BATCH ENDING ${validIds.length} auctions in ONE transaction...`);
      logger.info(`💼 Using wallet: ${this.wallet.address}`);
      logger.info(`📋 Auction IDs: ${validIds.map(id => id.toString()).join(', ')}`);

      const tx = await this.contract.batchEndAuctions(validIds);
      logger.info(`📝 Batch transaction submitted: ${tx.hash}`);
      logger.info(`⏳ Waiting for confirmation...`);

      const receipt = await tx.wait();

      if (receipt.status === 1) {
        logger.info(`✅ BATCH SUCCESS! ${validIds.length} auctions ended in one transaction`);
        logger.info(`⛽ Total gas used: ${receipt.gasUsed.toString()}`);
        logger.info(`💰 Gas saved vs individual txs: ~${(validIds.length * 50000) - Number(receipt.gasUsed)} gas`);
        logger.info(`🔗 Transaction: ${receipt.hash}`);
      } else {
        logger.error(`❌ Batch transaction failed`);
      }

      return receipt;
    } catch (error) {
      logger.error(`Failed to batch end auctions:`, error);

      // If batch fails, we'll let the caller handle fallback to individual processing
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
      // Update auction record with all relevant fields
      await pool.query(`
        UPDATE auctions
        SET nft_token_id = $1,
            jitsi_room_id = $2,
            auto_ended = TRUE,
            ended = $3,
            highest_bid = $4,
            highest_bidder = $5,
            blocks_remaining = 0,
            time_remaining_seconds = 0,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
      `, [
        auction.nftTokenId ? auction.nftTokenId.toString() : null,
        meeting?.meeting?.roomId || null,
        auction.ended,
        auction.highestBid.toString(),
        auction.highestBidder,
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
   * Update bid amounts and time remaining for active auctions
   * ENHANCED: Updates ALL changeable blockchain data to database
   */
  async updateActiveBidsAndTime(auctionIds, currentBlock) {
    try {
      let updatedCount = 0;

      for (const auctionId of auctionIds) {
        try {
          // Fetch current auction state from blockchain (ALL fields)
          const auction = await this.contract.getAuction(auctionId);

          // Skip if auction has ended
          if (auction.ended) {
            continue;
          }

          // Calculate time remaining
          const endBlock = Number(auction.endBlock);
          const blocksRemaining = Math.max(0, endBlock - currentBlock);
          // Get network-specific block time
          // NOTE: Arbitrum Sepolia L2 is currently producing blocks at ~10s/block
          // This is much slower than the theoretical 0.25s/block
          const network = process.env.BLOCKCHAIN_NETWORK || 'ARBITRUM_SEPOLIA';
          const blockTime = network.includes('ARBITRUM') ? 12.0 :  // Actual measured: 10s/block
                           network.includes('AVALANCHE') ? 2.0 : 12.0;
          const timeRemainingSeconds = Math.round(blocksRemaining * blockTime);

          // Update database with ALL current blockchain data
          await pool.query(`
            UPDATE auctions
            SET
              highest_bid = $1,
              highest_bidder = $2,
              end_block = $3,
              blocks_remaining = $4,
              time_remaining_seconds = $5,
              ended = $6,
              bid_price = $7,
              seller_name = $8,
              profile_picture = $9,
              event_date = $10,
              event_start_time = $11,
              event_end_time = $12,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = $13
          `, [
            auction.highestBid.toString(),
            auction.highestBidder,
            endBlock,
            blocksRemaining,
            timeRemainingSeconds,
            auction.ended,
            auction.reservePrice.toString(),
            auction.sellerName || null,
            auction.profilePicture || null,
            auction.eventDate && Number(auction.eventDate) > 0
              ? new Date(Number(auction.eventDate) * 1000).toISOString()
              : null,
            auction.eventStartTime && Number(auction.eventStartTime) > 0
              ? new Date(Number(auction.eventStartTime) * 1000).toISOString()
              : null,
            auction.eventEndTime && Number(auction.eventEndTime) > 0
              ? new Date(Number(auction.eventEndTime) * 1000).toISOString()
              : null,
            auctionId.toString()
          ]);

          updatedCount++;

          // Enhanced logging
          if (auction.highestBidder !== ethers.ZeroAddress) {
            logger.info(`  📊 Auction ${auctionId}: Bid ${ethers.formatEther(auction.highestBid)} AVAX by ${auction.highestBidder.slice(0, 10)}..., ${blocksRemaining} blocks left (endBlock: ${endBlock})`);
          } else {
            logger.info(`  ⏱️  Auction ${auctionId}: No bids yet, ${blocksRemaining} blocks remaining (endBlock: ${endBlock})`);
          }

        } catch (error) {
          logger.warn(`  ⚠️  Failed to update auction ${auctionId}:`, error.message);
        }
      }

      logger.info(`✅ Updated ${updatedCount} active auction(s) with live blockchain data`);

    } catch (error) {
      logger.error('Error updating active bids and time:', error);
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
