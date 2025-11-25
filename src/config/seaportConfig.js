/**
 * Seaport Orderbook Configuration Validation
 * 
 * This module validates all Seaport-related environment variables
 * and provides a centralized configuration object.
 * 
 * Requirements: All (Task 13)
 */

const logger = require('../utils/logger');

/**
 * Validates an Ethereum address format
 * @param {string} address - Address to validate
 * @returns {boolean} True if valid
 */
function isValidAddress(address) {
  if (!address) return false;
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validates a positive integer
 * @param {string|number} value - Value to validate
 * @returns {boolean} True if valid
 */
function isValidPositiveInteger(value) {
  const num = parseInt(value, 10);
  return !isNaN(num) && num > 0 && num.toString() === value.toString();
}

/**
 * Validates a WebSocket URL
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid
 */
function isValidWebSocketUrl(url) {
  if (!url) return false;
  return url.startsWith('ws://') || url.startsWith('wss://');
}

/**
 * Validates a cron schedule expression
 * @param {string} schedule - Cron schedule to validate
 * @returns {boolean} True if valid
 */
function isValidCronSchedule(schedule) {
  if (!schedule) return false;
  // Basic validation: should have 5 parts (minute hour day month weekday)
  const parts = schedule.trim().split(/\s+/);
  return parts.length === 5;
}

/**
 * Validates basis points (0-10000)
 * @param {string|number} value - Basis points to validate
 * @returns {boolean} True if valid
 */
function isValidBasisPoints(value) {
  const num = parseInt(value, 10);
  return !isNaN(num) && num >= 0 && num <= 10000;
}

/**
 * Validates all Seaport configuration variables
 * @returns {Object} Validation result with { valid: boolean, errors: string[], warnings: string[] }
 */
function validateSeaportConfig() {
  const errors = [];
  const warnings = [];

  // Required: SEAPORT_CONTRACT_ADDRESS
  if (!process.env.SEAPORT_CONTRACT_ADDRESS) {
    errors.push('SEAPORT_CONTRACT_ADDRESS is required');
  } else if (!isValidAddress(process.env.SEAPORT_CONTRACT_ADDRESS)) {
    errors.push('SEAPORT_CONTRACT_ADDRESS must be a valid Ethereum address (0x followed by 40 hex characters)');
  }

  // Required: SEAPORT_CHAIN_ID
  if (!process.env.SEAPORT_CHAIN_ID) {
    errors.push('SEAPORT_CHAIN_ID is required');
  } else if (!isValidPositiveInteger(process.env.SEAPORT_CHAIN_ID)) {
    errors.push('SEAPORT_CHAIN_ID must be a positive integer');
  }

  // Optional but recommended: WS_RPC_URL (required if ENABLE_ORDER_MONITORING is true)
  const enableMonitoring = process.env.ENABLE_ORDER_MONITORING !== 'false';
  if (enableMonitoring) {
    if (!process.env.WS_RPC_URL) {
      warnings.push('WS_RPC_URL is not set - order fulfillment monitoring will be disabled');
    } else if (!isValidWebSocketUrl(process.env.WS_RPC_URL)) {
      errors.push('WS_RPC_URL must be a valid WebSocket URL (ws:// or wss://)');
    }
  }

  // Optional: ORDER_CLEANUP_CRON_SCHEDULE (has default)
  if (process.env.ORDER_CLEANUP_CRON_SCHEDULE) {
    if (!isValidCronSchedule(process.env.ORDER_CLEANUP_CRON_SCHEDULE)) {
      errors.push('ORDER_CLEANUP_CRON_SCHEDULE must be a valid cron expression (5 parts: minute hour day month weekday)');
    }
  }

  // Optional: PLATFORM_FEE_RECIPIENT
  if (process.env.PLATFORM_FEE_RECIPIENT) {
    if (!isValidAddress(process.env.PLATFORM_FEE_RECIPIENT)) {
      errors.push('PLATFORM_FEE_RECIPIENT must be a valid Ethereum address');
    }
    
    // If PLATFORM_FEE_RECIPIENT is set, validate PLATFORM_FEE_BASIS_POINTS
    if (!process.env.PLATFORM_FEE_BASIS_POINTS) {
      warnings.push('PLATFORM_FEE_BASIS_POINTS is not set - defaulting to 250 (2.5%)');
    } else if (!isValidBasisPoints(process.env.PLATFORM_FEE_BASIS_POINTS)) {
      errors.push('PLATFORM_FEE_BASIS_POINTS must be a number between 0 and 10000');
    }
  } else {
    warnings.push('PLATFORM_FEE_RECIPIENT is not set - platform fee validation is disabled');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Gets the Seaport configuration object
 * @returns {Object} Configuration object
 */
function getSeaportConfig() {
  return {
    // Contract Configuration
    contractAddress: process.env.SEAPORT_CONTRACT_ADDRESS,
    chainId: parseInt(process.env.SEAPORT_CHAIN_ID, 10),
    
    // WebSocket Configuration
    wsRpcUrl: process.env.WS_RPC_URL,
    enableOrderMonitoring: process.env.ENABLE_ORDER_MONITORING !== 'false',
    
    // Cron Configuration
    orderCleanupCronSchedule: process.env.ORDER_CLEANUP_CRON_SCHEDULE || '*/5 * * * *',
    
    // Platform Fee Configuration
    platformFeeRecipient: process.env.PLATFORM_FEE_RECIPIENT || null,
    platformFeeBasisPoints: parseInt(process.env.PLATFORM_FEE_BASIS_POINTS || '250', 10)
  };
}

/**
 * Validates configuration and logs results
 * Throws an error if validation fails
 */
function validateAndLogConfig() {
  logger.info('🔍 Validating Seaport configuration...');
  
  const validation = validateSeaportConfig();
  
  // Log warnings
  if (validation.warnings.length > 0) {
    validation.warnings.forEach(warning => {
      logger.warn(`⚠️  Configuration warning: ${warning}`);
    });
  }
  
  // Log errors and throw if invalid
  if (!validation.valid) {
    validation.errors.forEach(error => {
      logger.error(`❌ Configuration error: ${error}`);
    });
    throw new Error(`Seaport configuration validation failed: ${validation.errors.join(', ')}`);
  }
  
  // Log success and configuration
  logger.info('✅ Seaport configuration validated successfully');
  const config = getSeaportConfig();
  logger.info('📋 Seaport Configuration:');
  logger.info(`   - Contract Address: ${config.contractAddress}`);
  logger.info(`   - Chain ID: ${config.chainId}`);
  logger.info(`   - WebSocket RPC: ${config.wsRpcUrl || 'not configured'}`);
  logger.info(`   - Order Monitoring: ${config.enableOrderMonitoring ? 'enabled' : 'disabled'}`);
  logger.info(`   - Cleanup Schedule: ${config.orderCleanupCronSchedule}`);
  logger.info(`   - Platform Fee Recipient: ${config.platformFeeRecipient || 'not configured'}`);
  logger.info(`   - Platform Fee: ${config.platformFeeBasisPoints} basis points (${(config.platformFeeBasisPoints / 100).toFixed(2)}%)`);
  
  return config;
}

module.exports = {
  validateSeaportConfig,
  getSeaportConfig,
  validateAndLogConfig,
  // Export validators for testing
  isValidAddress,
  isValidPositiveInteger,
  isValidWebSocketUrl,
  isValidCronSchedule,
  isValidBasisPoints
};
