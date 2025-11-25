const { ethers } = require('ethers');
const logger = require('../utils/logger');

// Simple ABI for BlockTest contract
const BLOCK_TEST_ABI = [
  'function getBlockNumber() external view returns (uint256)'
];

/**
 * BlockNumberService
 * 
 * This service provides the correct L2 block number on Arbitrum.
 * 
 * IMPORTANT: On Arbitrum, provider.getBlockNumber() returns L1 block number,
 * but smart contracts use block.number which is the L2 block number.
 * 
 * To get the correct L2 block number, we need to call a contract function
 * that returns block.number from within the contract.
 */
class BlockNumberService {
  constructor(provider, contractAddress = null) {
    this.provider = provider;
    this.network = process.env.BLOCKCHAIN_NETWORK || 'ARBITRUM_SEPOLIA';
    this.blockTestAddress = contractAddress;
    this.blockTestContract = null;
    
    // If we have a BlockTest contract address, initialize it
    if (this.blockTestAddress) {
      this.blockTestContract = new ethers.Contract(
        this.blockTestAddress,
        BLOCK_TEST_ABI,
        this.provider
      );
    }
  }

  /**
   * Get the current L2 block number
   * 
   * On Arbitrum, this calls a contract to get block.number (L2 block)
   * On other networks, this uses provider.getBlockNumber()
   */
  async getCurrentBlock() {
    try {
      // For Arbitrum, we need to use a contract call to get L2 block
      if (this.network.includes('ARBITRUM')) {
        if (this.blockTestContract) {
          // Use BlockTest contract to get L2 block number
          const l2Block = await this.blockTestContract.getBlockNumber();
          return Number(l2Block);
        } else {
          // Fallback: Use the main contract's view of block.number
          // This is less reliable but better than using L1 block
          logger.warn('BlockTest contract not available, using fallback method');
          return await this.getBlockNumberFallback();
        }
      } else {
        // For non-Arbitrum networks, provider.getBlockNumber() is correct
        return await this.provider.getBlockNumber();
      }
    } catch (error) {
      logger.error('Error getting current block:', error);
      throw error;
    }
  }

  /**
   * Fallback method: Use provider.getBlock('latest').number
   * This is not as reliable as calling a contract, but better than nothing
   */
  async getBlockNumberFallback() {
    try {
      const block = await this.provider.getBlock('latest');
      return block.number;
    } catch (error) {
      logger.error('Error in fallback block number retrieval:', error);
      // Last resort: use provider.getBlockNumber()
      return await this.provider.getBlockNumber();
    }
  }

  /**
   * Set the BlockTest contract address
   */
  setBlockTestAddress(address) {
    this.blockTestAddress = address;
    this.blockTestContract = new ethers.Contract(
      address,
      BLOCK_TEST_ABI,
      this.provider
    );
    logger.info(`BlockTest contract set to: ${address}`);
  }

  /**
   * Check if BlockTest contract is available
   */
  hasBlockTestContract() {
    return !!this.blockTestContract;
  }
}

module.exports = BlockNumberService;
