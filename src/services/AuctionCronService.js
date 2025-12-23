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

    // Network configuration for block time
    this.network = process.env.BLOCKCHAIN_NETWORK || 'SEPOLIA';
    this.blockTime = this.getBlockTimeForNetwork(this.network);

    this.initialize();
  }

  /**
   * Get block time for the current network
   */
  getBlockTimeForNetwork(network) {
    const blockTimes = {
      'SEPOLIA': 12,      // Ethereum Sepolia: 12 seconds/block
      'ETHEREUM': 12,     // Ethereum mainnet: 12 seconds/block
      'AVALANCHE': 2,     // Avalanche C-Chain: 2 seconds/block
      'FUJI': 2          // Avalanche Fuji testnet: 2 seconds/block
    };
    return blockTimes[network] || 12; // Default to 12 seconds (Ethereum standard)
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
    logger.info(`🌐 Network: ${this.network} (${this.blockTime} sec/block)`);
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

      // Get current block number
      const currentBlock = await this.provider.getBlockNumber();
      logger.info(`📦 Current block: ${currentBlock}`);

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

        // Track which auctions were successfully ended on blockchain
        const successfullyEndedOnChain = new Set();
        const failedToEnd = [];

        // PHASE 2 OPTIMIZATION: Batch end auctions on-chain
        const auctionsNeedingOnChainEnd = readyToEndAuctions.filter(a => a.needsOnChainEnd);

        if (auctionsNeedingOnChainEnd.length > 0) {
          logger.info(`⛓️  BATCH ENDING ${auctionsNeedingOnChainEnd.length} auctions on-chain...`);
          const idsToEnd = auctionsNeedingOnChainEnd.map(a => a.id);

          try {
            const batchResult = await this.batchEndAuctionsOnChain(idsToEnd);
            if (batchResult && batchResult.status === 1) {
              // Batch succeeded - all auctions ended
              idsToEnd.forEach(id => successfullyEndedOnChain.add(id.toString()));
              logger.info(`✅ Batch end successful for ${idsToEnd.length} auctions`);
            } else {
              throw new Error('Batch transaction failed');
            }
          } catch (error) {
            logger.error('❌ Batch ending failed, falling back to one-by-one:', error.message);
            
            // Fallback: process individually with retry
            for (const { id } of auctionsNeedingOnChainEnd) {
              const success = await this.endAuctionWithRetry(id, 3); // 3 retries
              if (success) {
                successfullyEndedOnChain.add(id.toString());
              } else {
                failedToEnd.push(id);
              }
            }
          }
        }

        // Add auctions that were already ended on-chain
        const alreadyEndedOnChain = readyToEndAuctions.filter(a => !a.needsOnChainEnd);
        alreadyEndedOnChain.forEach(a => successfullyEndedOnChain.add(a.id.toString()));
        
        if (alreadyEndedOnChain.length > 0) {
          logger.info(`✅ ${alreadyEndedOnChain.length} auctions already ended on-chain`);
        }

        // Log failed auctions
        if (failedToEnd.length > 0) {
          logger.error(`❌ FAILED TO END ${failedToEnd.length} auctions on blockchain: ${failedToEnd.join(', ')}`);
          logger.error(`⚠️  These auctions will be retried in the next cron cycle`);
        }

        // Step 5: Update database ONLY for auctions successfully ended on blockchain
        logger.info('📝 Step 5: Updating database for successfully ended auctions...');
        
        for (const { id } of readyToEndAuctions) {
          const idStr = id.toString();
          
          // Skip if not successfully ended on blockchain
          if (!successfullyEndedOnChain.has(idStr)) {
            logger.warn(`  ⏭️  Auction ${id}: Skipping DB update - blockchain end failed`);
            continue;
          }

          try {
            // VERIFY on blockchain that auction is actually ended
            const updatedAuction = await this.contract.getAuction(id);
            
            if (!updatedAuction.ended) {
              logger.error(`  ❌ Auction ${id}: Blockchain verification failed - auction not ended!`);
              continue; // Don't update database if blockchain says not ended
            }

            if (updatedAuction.nftTokenId && Number(updatedAuction.nftTokenId) > 0) {
              logger.info(`  🎨 Auction ${id}: NFT Token ID: ${updatedAuction.nftTokenId.toString()}`);
            }

            await this.updateAuctionInDatabase(id, updatedAuction, null);
            logger.info(`  ✅ Auction ${id}: Database updated (verified on blockchain)`);
          } catch (error) {
            logger.error(`  ❌ Failed to update database for auction ${id}:`, error.message);
          }
        }

        // Summary
        logger.info(`📊 Processing Summary:`);
        logger.info(`   ✅ Successfully ended: ${successfullyEndedOnChain.size}`);
        logger.info(`   ❌ Failed (will retry): ${failedToEnd.length}`);
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
   * IMPORTANT: Only updates database AFTER blockchain is verified
   */
  async processSingleAuction(auctionId, auction) {
    try {
      logger.info(`🎯 PROCESSING ENDED AUCTION ${auctionId}`);
      logger.info(`   👤 Creator: ${auction.host}`);
      logger.info(`   🏆 Winner: ${auction.highestBidder}`);
      logger.info(`   💰 Winning bid: ${ethers.formatEther(auction.highestBid)} AVAX`);

      // Step 1: End the auction on-chain (only if not already ended)
      if (!auction.ended) {
        logger.info(`🔗 Step 1: Ending auction ${auctionId} on blockchain with retry...`);
        const success = await this.endAuctionWithRetry(auctionId, 3);
        
        if (!success) {
          logger.error(`❌ Failed to end auction ${auctionId} on blockchain after 3 attempts`);
          logger.error(`⚠️  Database will NOT be updated - auction will be retried next cycle`);
          return; // Don't update database if blockchain failed
        }
      } else {
        logger.info(`🔗 Step 1: Auction ${auctionId} already ended on blockchain ✓`);
      }

      // Step 2: VERIFY auction is ended on blockchain
      logger.info(`📊 Step 2: Verifying auction ended on blockchain...`);
      const updatedAuction = await this.contract.getAuction(auctionId);
      
      if (!updatedAuction.ended) {
        logger.error(`❌ VERIFICATION FAILED: Auction ${auctionId} not ended on blockchain!`);
        logger.error(`⚠️  Database will NOT be updated - something went wrong`);
        return;
      }
      
      logger.info(`✅ Blockchain verification passed: auction ${auctionId} is ended`);
      
      if (updatedAuction.nftTokenId && Number(updatedAuction.nftTokenId) > 0) {
        logger.info(`🎨 NFT minted! Token ID: ${updatedAuction.nftTokenId.toString()}`);
      }

      // Step 3: Get user data for creator and winner
      const creatorData = await this.getUserDataByWallet(auction.host);
      const winnerData = auction.highestBidder !== ethers.ZeroAddress
        ? await this.getUserDataByWallet(auction.highestBidder)
        : null;

      // Step 4: Update database (only after blockchain verification)
      logger.info(`📝 Step 4: Updating database...`);
      await this.updateAuctionInDatabase(auctionId, updatedAuction, null);

      logger.info(`✅ Successfully processed auction ${auctionId}`, {
        hasWinner: !!winnerData,
        nftTokenId: updatedAuction.nftTokenId?.toString() || 'none',
        note: 'Meeting will be created when winner burns NFT to access'
      });

    } catch (error) {
      logger.error(`Failed to process auction ${auctionId}:`, error);
      logger.error(`⚠️  Auction ${auctionId} will be retried in next cron cycle`);
      // DO NOT update database on error - let it retry next cycle
    }
  }

  /**
   * End auction on blockchain with retry mechanism
   * @param {BigInt|number} auctionId - Auction ID
   * @param {number} maxRetries - Maximum number of retry attempts
   * @returns {boolean} - True if successfully ended, false otherwise
   */
  async endAuctionWithRetry(auctionId, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`⛓️  Auction ${auctionId}: Attempt ${attempt}/${maxRetries} to end on blockchain...`);
        
        const result = await this.endAuctionOnChain(auctionId);
        
        if (result && (result.status === 1 || result.alreadyEnded)) {
          logger.info(`✅ Auction ${auctionId}: Successfully ended on blockchain (attempt ${attempt})`);
          return true;
        }
        
        // If result is null, it means the call failed
        if (result === null && attempt < maxRetries) {
          logger.warn(`⚠️  Auction ${auctionId}: Attempt ${attempt} failed, retrying in 2 seconds...`);
          await this.sleep(2000); // Wait 2 seconds before retry
        }
      } catch (error) {
        logger.error(`❌ Auction ${auctionId}: Attempt ${attempt} error:`, error.message);
        
        if (attempt < maxRetries) {
          logger.info(`⏳ Waiting 2 seconds before retry...`);
          await this.sleep(2000);
        }
      }
    }
    
    logger.error(`❌ Auction ${auctionId}: All ${maxRetries} attempts failed!`);
    return false;
  }

  /**
   * Sleep helper function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * End auction on blockchain
   * FIXED: Returns null on failure but doesn't prevent database update
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
        logger.info(`✅ Auction ${auctionId} ended successfully on blockchain!`);
        logger.info(`⛽ Gas used: ${receipt.gasUsed.toString()}`);
        logger.info(`🔗 Transaction: ${receipt.hash}`);
        return receipt;
      } else {
        logger.error(`❌ Transaction failed for auction ${auctionId}`);
        return null;
      }
    } catch (error) {
      logger.error(`Failed to end auction ${auctionId} on-chain:`, error.message);

      // Log specific error types for debugging
      if (error.message && error.message.includes('Token transfer failed')) {
        logger.warn(`⚠️  Auction ${auctionId}: "Token transfer failed" - smart contract issue`);
      } else if (error.message && error.message.includes('Auction already ended')) {
        logger.info(`ℹ️  Auction ${auctionId}: Already ended on blockchain`);
        return { alreadyEnded: true }; // Return truthy value to indicate success
      } else if (error.message && error.message.includes('Auction not yet ended')) {
        logger.warn(`⚠️  Auction ${auctionId}: Not yet ready to end (blocks remaining)`);
      }

      // Return null to indicate failure, but DON'T throw
      // The caller will still update the database
      return null;
    }
  }

  /**
   * Batch end multiple auctions on blockchain - PHASE 2 OPTIMIZATION
   * FIXED: Removed hardcoded problematic auctions list - all auctions are processed
   */
  async batchEndAuctionsOnChain(auctionIds) {
    if (!this.wallet) {
      throw new Error('No wallet configured for auction ending');
    }

    if (auctionIds.length === 0) {
      logger.warn('No auctions to batch end');
      return null;
    }

    try {
      logger.info(`⛓️  BATCH ENDING ${auctionIds.length} auctions in ONE transaction...`);
      logger.info(`💼 Using wallet: ${this.wallet.address}`);
      logger.info(`📋 Auction IDs: ${auctionIds.map(id => id.toString()).join(', ')}`);

      const tx = await this.contract.batchEndAuctions(auctionIds);
      logger.info(`📝 Batch transaction submitted: ${tx.hash}`);
      logger.info(`⏳ Waiting for confirmation...`);

      const receipt = await tx.wait();

      if (receipt.status === 1) {
        logger.info(`✅ BATCH SUCCESS! ${auctionIds.length} auctions ended in one transaction`);
        logger.info(`⛽ Total gas used: ${receipt.gasUsed.toString()}`);
        logger.info(`💰 Gas saved vs individual txs: ~${(auctionIds.length * 50000) - Number(receipt.gasUsed)} gas`);
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
   * IMPORTANT: Only call this AFTER verifying auction is ended on blockchain
   */
  async updateAuctionInDatabase(auctionId, auction, meeting) {
    try {
      // SAFETY CHECK: Verify auction.ended is true from blockchain
      if (!auction.ended) {
        logger.error(`❌ SAFETY CHECK FAILED: Auction ${auctionId} is NOT ended on blockchain!`);
        logger.error(`   Refusing to update database to prevent data inconsistency`);
        throw new Error(`Auction ${auctionId} not ended on blockchain`);
      }

      // Update auction record with all relevant fields
      await pool.query(`
        UPDATE auctions
        SET nft_token_id = $1,
            jitsi_room_id = $2,
            auto_ended = TRUE,
            ended = TRUE,
            highest_bid = $3,
            highest_bidder = $4,
            blocks_remaining = 0,
            time_remaining_seconds = 0,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
      `, [
        auction.nftTokenId ? auction.nftTokenId.toString() : null,
        meeting?.meeting?.roomId || null,
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

      logger.info(`✅ Updated database for auction ${auctionId} (blockchain verified: ended=TRUE)`);
    } catch (error) {
      logger.error(`Failed to update database for auction ${auctionId}:`, error);
      throw error; // Re-throw so caller knows it failed
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
          const timeRemainingSeconds = blocksRemaining * this.blockTime; // Use network-specific block time

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
          const timeMinutes = Math.floor(timeRemainingSeconds / 60);
          if (auction.highestBidder !== ethers.ZeroAddress) {
            logger.info(`  📊 Auction ${auctionId}: Bid ${ethers.formatEther(auction.highestBid)} ETH by ${auction.highestBidder.slice(0, 10)}..., ${blocksRemaining} blocks left (~${timeMinutes} min)`);
          } else {
            logger.info(`  ⏱️  Auction ${auctionId}: No bids yet, ${blocksRemaining} blocks remaining (~${timeMinutes} min)`);
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
