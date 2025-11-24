const cron = require('node-cron');
const logger = require('../utils/logger');
const { pool } = require('../config/database');

/**
 * OrderCleanupCronService
 * 
 * Automatically cleans up expired orders by marking them as inactive.
 * Runs every 5 minutes to ensure the marketplace only shows valid orders.
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */
class OrderCleanupCronService {
  constructor() {
    this.job = null;
    this.isRunning = false;
    this.cronSchedule = process.env.ORDER_CLEANUP_CRON_SCHEDULE || '*/5 * * * *'; // Every 5 minutes
  }

  /**
   * Start the cron job
   * Requirement: 7.4 - Execute every 5 minutes
   */
  start() {
    if (this.isRunning) {
      logger.warn('Order cleanup cron job already running');
      return;
    }

    logger.info('🧹 STARTING ORDER CLEANUP CRON SERVICE');
    logger.info(`⏰ Schedule: ${this.cronSchedule} (every 5 minutes)`);
    logger.info('='.repeat(60));

    // Schedule cron job to run every 5 minutes
    this.job = cron.schedule(this.cronSchedule, async () => {
      const startTime = new Date();
      logger.info(`🚀 ORDER CLEANUP JOB TRIGGERED at ${startTime.toISOString()}`);

      try {
        await this.cleanupExpiredOrders();
        const duration = Date.now() - startTime.getTime();
        logger.info(`✅ ORDER CLEANUP JOB COMPLETED in ${duration}ms`);
      } catch (error) {
        const duration = Date.now() - startTime.getTime();
        logger.error(`❌ ORDER CLEANUP JOB FAILED after ${duration}ms:`, error);
      }

      logger.info('─'.repeat(60));
    });

    this.isRunning = true;

    // Run initial cleanup after 10 seconds
    logger.info('🎬 Running initial order cleanup in 10 seconds...');
    setTimeout(async () => {
      try {
        const startTime = new Date();
        logger.info(`🔍 INITIAL CLEANUP CHECK at ${startTime.toISOString()}`);
        await this.cleanupExpiredOrders();
        logger.info('✅ Initial order cleanup completed');
      } catch (error) {
        logger.error('❌ Initial order cleanup failed:', error);
      }
    }, 10000);

    logger.info('🟢 Order cleanup cron job started successfully!');
    logger.info('📊 Next automatic cleanup in 5 minutes...');
  }

  /**
   * Stop the cron job
   */
  stop() {
    if (this.job) {
      this.job.stop();
      this.isRunning = false;
      logger.info('Order cleanup cron job stopped');
    }
  }

  /**
   * Main cleanup function - marks expired orders as inactive
   * Requirements: 7.1, 7.2, 7.3, 7.5
   */
  async cleanupExpiredOrders() {
    try {
      logger.info('🔍 CHECKING FOR EXPIRED ORDERS...');

      // Requirement 7.1: Identify all orders with expires_at < current time
      // Requirement 7.2: Mark them as inactive
      const updateQuery = `
        UPDATE seaport_orders
        SET is_active = false,
            updated_at = CURRENT_TIMESTAMP
        WHERE is_active = true
          AND expires_at <= CURRENT_TIMESTAMP
          AND is_fulfilled = false
          AND is_cancelled = false
        RETURNING order_hash, order_type, token_id, maker, expires_at
      `;

      const result = await pool.query(updateQuery);
      const expiredOrders = result.rows;

      // Requirement 7.3: Log the number of orders cleaned up
      if (expiredOrders.length > 0) {
        logger.info(`🧹 CLEANED UP ${expiredOrders.length} EXPIRED ORDER(S)`);
        
        // Log details of each expired order
        expiredOrders.forEach(order => {
          logger.info(`  📦 Order ${order.order_hash.substring(0, 10)}...`, {
            orderType: order.order_type,
            tokenId: order.token_id,
            maker: order.maker.substring(0, 10) + '...',
            expiredAt: order.expires_at
          });
        });

        // Log cleanup event for each order
        for (const order of expiredOrders) {
          await this.logCleanupEvent(order);
        }
      } else {
        logger.info('✨ No expired orders found - all orders are valid');
      }

      // Get statistics about active orders
      const statsQuery = `
        SELECT 
          COUNT(*) FILTER (WHERE order_type = 'listing') as active_listings,
          COUNT(*) FILTER (WHERE order_type = 'offer') as active_offers,
          COUNT(*) as total_active
        FROM seaport_orders
        WHERE is_active = true
          AND expires_at > CURRENT_TIMESTAMP
      `;

      const statsResult = await pool.query(statsQuery);
      const stats = statsResult.rows[0];

      logger.info('📊 ACTIVE ORDERS SUMMARY:', {
        activeListings: parseInt(stats.active_listings),
        activeOffers: parseInt(stats.active_offers),
        totalActive: parseInt(stats.total_active)
      });

      return {
        cleanedUp: expiredOrders.length,
        activeListings: parseInt(stats.active_listings),
        activeOffers: parseInt(stats.active_offers),
        totalActive: parseInt(stats.total_active)
      };

    } catch (error) {
      logger.error('Error in order cleanup:', error);
      throw error;
    }
  }

  /**
   * Log cleanup event to order_events table
   * Requirement: 7.3 - Log cleanup operations
   * 
   * @param {Object} order - Expired order data
   */
  async logCleanupEvent(order) {
    try {
      const query = `
        INSERT INTO order_events (
          order_hash, event_type, actor, event_data, created_at
        ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      `;

      await pool.query(query, [
        order.order_hash,
        'order:expired',
        'system',
        JSON.stringify({
          orderType: order.order_type,
          tokenId: order.token_id,
          maker: order.maker,
          expiredAt: order.expires_at,
          cleanedUpAt: new Date().toISOString()
        })
      ]);

    } catch (error) {
      logger.error('Failed to log cleanup event:', error);
      // Don't throw - event logging failure shouldn't break cleanup
    }
  }

  /**
   * Manual trigger for testing
   */
  async triggerManually() {
    logger.info('Manually triggering order cleanup...');
    return await this.cleanupExpiredOrders();
  }

  /**
   * Get cleanup statistics
   */
  async getCleanupStats() {
    try {
      const query = `
        SELECT 
          COUNT(*) FILTER (WHERE is_active = true AND expires_at > CURRENT_TIMESTAMP) as active_orders,
          COUNT(*) FILTER (WHERE is_active = false AND expires_at <= CURRENT_TIMESTAMP AND is_fulfilled = false AND is_cancelled = false) as expired_orders,
          COUNT(*) FILTER (WHERE is_fulfilled = true) as fulfilled_orders,
          COUNT(*) FILTER (WHERE is_cancelled = true) as cancelled_orders,
          COUNT(*) as total_orders
        FROM seaport_orders
      `;

      const result = await pool.query(query);
      return result.rows[0];

    } catch (error) {
      logger.error('Failed to get cleanup stats:', error);
      throw error;
    }
  }
}

// Singleton instance
let orderCleanupCronService = null;

function getOrderCleanupCronService() {
  if (!orderCleanupCronService) {
    orderCleanupCronService = new OrderCleanupCronService();
  }
  return orderCleanupCronService;
}

module.exports = {
  OrderCleanupCronService,
  getOrderCleanupCronService
};
