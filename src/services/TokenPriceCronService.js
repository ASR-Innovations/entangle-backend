/**
 * Token Price Cron Service
 * Runs hourly to update creator token prices from blockchain
 * Maintains real-time price data for charts and trending creators
 */

const cron = require('node-cron');
const { getBlockchainSyncService } = require('./BlockchainSyncService');
const logger = require('../utils/logger');

class TokenPriceCronService {
  constructor(db) {
    this.db = db;
    this.cronJob = null;
    this.isRunning = false;
    this.syncService = null;
  }

  /**
   * Start the cron job
   * Runs every hour at minute 0
   */
  start() {
    if (this.cronJob) {
      logger.info('⚠️ Token price cron job already running');
      return;
    }

    // Run every hour at minute 0
    // Format: 0 * * * * (second minute hour day month dayOfWeek)
    this.cronJob = cron.schedule('0 * * * *', async () => {
      await this.runPriceUpdate();
    });

    logger.info('✅ Token price cron job started (runs every hour)');

    // Also run initial sync immediately (optional)
    logger.info('🔄 Running initial price update...');
    this.runPriceUpdate().catch(error => {
      logger.error('❌ Initial price update failed:', error);
    });
  }

  /**
   * Stop the cron job
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info('🛑 Token price cron job stopped');
    }
  }

  /**
   * Run price update for all tokens
   */
  async runPriceUpdate() {
    if (this.isRunning) {
      logger.warn('⏭️ Price update already running, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      logger.info('💰 ========================================');
      logger.info('💰 HOURLY TOKEN PRICE UPDATE STARTED');
      logger.info('💰 ========================================');

      // Initialize sync service if needed
      if (!this.syncService) {
        this.syncService = getBlockchainSyncService(this.db);
        await this.syncService.initialize();
      }

      // Update all token prices
      const result = await this.syncService.updateAllTokenPrices();

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      logger.info('💰 ========================================');
      logger.info('💰 PRICE UPDATE COMPLETE');
      logger.info(`💰 Total tokens: ${result.total}`);
      logger.info(`💰 Updated: ${result.updated}`);
      logger.info(`💰 Duration: ${duration}s`);
      logger.info('💰 ========================================');

      // Calculate 24h price changes
      await this.calculate24hPriceChanges();

    } catch (error) {
      logger.error('❌ Error in price update:', error);
      logger.error('Stack trace:', error.stack);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Calculate 24h price changes for all tokens
   * Compares current price with price from 24 hours ago
   */
  async calculate24hPriceChanges() {
    try {
      logger.info('📊 Calculating 24h price changes...');

      // Get all tokens
      const tokensResult = await this.db.query(`
        SELECT id, contract_address, current_price
        FROM creator_tokens
        WHERE contract_address IS NOT NULL
      `);

      const tokens = tokensResult.rows;
      let updated = 0;

      for (const token of tokens) {
        try {
          // Get price from 24 hours ago
          const price24hAgoResult = await this.db.query(`
            SELECT close_price
            FROM token_price_history
            WHERE token_id = $1
              AND interval_type = '1h'
              AND timestamp <= NOW() - INTERVAL '24 hours'
            ORDER BY timestamp DESC
            LIMIT 1
          `, [token.id]);

          if (price24hAgoResult.rows.length > 0) {
            const price24hAgo = parseFloat(price24hAgoResult.rows[0].close_price);
            const currentPrice = parseFloat(token.current_price);

            // Calculate percentage change
            const priceChange = price24hAgo > 0
              ? ((currentPrice - price24hAgo) / price24hAgo) * 100
              : 0;

            // Update token
            await this.db.query(`
              UPDATE creator_tokens
              SET price_change_24h = $1
              WHERE id = $2
            `, [priceChange, token.id]);

            logger.info(`   📈 ${token.contract_address.substring(0, 10)}...: ${priceChange > 0 ? '+' : ''}${priceChange.toFixed(2)}%`);
            updated++;
          }
        } catch (error) {
          logger.error(`   ❌ Error calculating 24h change for ${token.contract_address}:`, error.message);
        }
      }

      logger.info(`✅ Calculated 24h changes for ${updated}/${tokens.length} tokens`);
    } catch (error) {
      logger.error('❌ Error calculating 24h price changes:', error);
    }
  }

  /**
   * Run full sync - scan all users for tokens
   * Should be run manually or on server start
   */
  async runFullSync() {
    if (this.isRunning) {
      logger.warn('⏭️ Sync already running, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      logger.info('🔄 ========================================');
      logger.info('🔄 FULL BLOCKCHAIN SYNC STARTED');
      logger.info('🔄 ========================================');

      // Initialize sync service if needed
      if (!this.syncService) {
        this.syncService = getBlockchainSyncService(this.db);
        await this.syncService.initialize();
      }

      // Scan all users for tokens
      const result = await this.syncService.scanAllUsersForTokens();

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      logger.info('🔄 ========================================');
      logger.info('🔄 FULL SYNC COMPLETE');
      logger.info(`🔄 Users scanned: ${result.scanned}`);
      logger.info(`🔄 Tokens found: ${result.found}`);
      logger.info(`🔄 Records updated: ${result.updated}`);
      logger.info(`🔄 Duration: ${duration}s`);
      logger.info('🔄 ========================================');

      return result;
    } catch (error) {
      logger.error('❌ Error in full sync:', error);
      logger.error('Stack trace:', error.stack);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }
}

// Singleton instance
let tokenPriceCronServiceInstance = null;

function getTokenPriceCronService(db) {
  if (!tokenPriceCronServiceInstance && db) {
    tokenPriceCronServiceInstance = new TokenPriceCronService(db);
  }
  return tokenPriceCronServiceInstance;
}

module.exports = { TokenPriceCronService, getTokenPriceCronService };
