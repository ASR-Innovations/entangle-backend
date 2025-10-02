const cron = require('node-cron');
const { setupDatabase } = require('../config/database');
const { getContractService } = require('../services/ContractService');
const { getAuctionCronService } = require('../services/AuctionCronService');
const logger = require('../utils/logger');

class AuctionCron {
  constructor() {
    this.contractService = null;
    this.auctionCronService = null;
    this.isRunning = false;
  }
  
  async initialize() {
    try {
      await setupDatabase();
      this.contractService = getContractService();
      await this.contractService.initialize();
      this.auctionCronService = getAuctionCronService();
      logger.info('Auction cron job initialized');
    } catch (error) {
      logger.error('Failed to initialize auction cron:', error);
      throw error;
    }
  }
  
  async start() {
    const cronExpression = process.env.AUCTION_CHECK_INTERVAL || '*/1 * * * *'; // Every minute
    
    cron.schedule(cronExpression, async () => {
      if (this.isRunning) {
        logger.warn('Previous auction check still running, skipping this cycle');
        return;
      }
      
      this.isRunning = true;
      try {
        await this.auctionCronService.processEndedAuctions();
      } catch (error) {
        logger.error('Error in scheduled auction check:', error);
      } finally {
        this.isRunning = false;
      }
    });
    
    logger.info(`Auction cron job started with schedule: ${cronExpression}`);
  }
}

// Run if called directly
if (require.main === module) {
  const auctionCron = new AuctionCron();
  
  auctionCron.initialize()
    .then(() => auctionCron.start())
    .catch(error => {
      logger.error('Failed to start auction cron:', error);
      process.exit(1);
    });
}

module.exports = { AuctionCron };
