/**
 * Blockchain Sync Service
 * Fetches real-time creator token data from blockchain
 * Syncs with database for fast API responses
 */

const { ethers } = require('ethers');
const { getContractService } = require('./ContractService');

class BlockchainSyncService {
  constructor(db) {
    this.db = db;
    this.contractService = null;
    this.provider = null;
    this.initialized = false;
  }

  /**
   * Initialize blockchain connection
   */
  async initialize() {
    try {
      console.log('🔗 Initializing BlockchainSyncService...');

      this.contractService = getContractService();
      await this.contractService.initialize();

      this.provider = this.contractService.provider;
      this.initialized = true;

      console.log('✅ BlockchainSyncService initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize BlockchainSyncService:', error);
      return false;
    }
  }

  /**
   * Scan all users and check for creator tokens
   * Updates creator_profiles and creator_tokens tables
   */
  async scanAllUsersForTokens() {
    if (!this.initialized) {
      console.log('⚠️ BlockchainSyncService not initialized, initializing now...');
      const success = await this.initialize();
      if (!success) {
        throw new Error('Failed to initialize BlockchainSyncService');
      }
    }

    try {
      console.log('🔍 Starting full user scan for creator tokens...');

      // Get all users from database
      const usersResult = await this.db.query(`
        SELECT id, wallet_address, para_user_id
        FROM users
        WHERE wallet_address IS NOT NULL
        ORDER BY id
      `);

      const users = usersResult.rows;
      console.log(`📊 Found ${users.length} users to scan`);

      let tokensFound = 0;
      let tokensUpdated = 0;

      for (let i = 0; i < users.length; i++) {
        const user = users[i];
        console.log(`\n🔍 [${i + 1}/${users.length}] Checking user: ${user.wallet_address}`);

        try {
          // Check if user has a creator token
          const tokenData = await this.getCreatorTokenData(user.wallet_address);

          if (tokenData.hasToken) {
            console.log(`✅ Found creator token for ${user.wallet_address}`);
            tokensFound++;

            // Update creator_profiles
            await this.upsertCreatorProfile(user, tokenData);

            // Update creator_tokens
            await this.upsertCreatorToken(user, tokenData);
            tokensUpdated++;
          } else {
            console.log(`ℹ️ No creator token for ${user.wallet_address}`);
          }
        } catch (error) {
          console.error(`❌ Error scanning user ${user.wallet_address}:`, error.message);
        }

        // Add small delay to avoid rate limiting
        await this.sleep(100);
      }

      console.log('\n📊 Scan Complete:');
      console.log(`   Total users scanned: ${users.length}`);
      console.log(`   Creator tokens found: ${tokensFound}`);
      console.log(`   Database records updated: ${tokensUpdated}`);

      return {
        scanned: users.length,
        found: tokensFound,
        updated: tokensUpdated
      };
    } catch (error) {
      console.error('❌ Error in scanAllUsersForTokens:', error);
      throw error;
    }
  }

  /**
   * Get creator token data from blockchain
   * @param {string} creatorAddress Wallet address
   * @returns {Promise<Object>} Token data
   */
  async getCreatorTokenData(creatorAddress) {
    try {
      // Create a minimal contract interface just for querying creator token mappings
      // Public mappings in Solidity are auto-exposed as view functions
      const minimalABI = [
        'function creatorTokenAddress(address) view returns (address)',
        'function creatorTokenName(address) view returns (string)'
      ];

      const auctionContract = new ethers.Contract(
        this.contractService.contractAddress,
        minimalABI,
        this.provider
      );

      // Query MeetingAuction contract's creatorTokenAddress mapping
      const tokenAddress = await auctionContract.creatorTokenAddress(creatorAddress);

      // Check if token exists (not zero address)
      const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
      if (!tokenAddress || tokenAddress === ZERO_ADDRESS) {
        return { hasToken: false };
      }

      console.log(`📊 Token found at: ${tokenAddress}`);

      // Get token details
      const tokenContract = new ethers.Contract(
        tokenAddress,
        [
          'function name() view returns (string)',
          'function symbol() view returns (string)',
          'function decimals() view returns (uint8)',
          'function totalSupply() view returns (uint256)'
        ],
        this.provider
      );

      const [name, symbol, decimals, totalSupply] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol(),
        tokenContract.decimals(),
        tokenContract.totalSupply()
      ]);

      // Get pool data if exists
      const poolData = await this.getPoolData(tokenAddress, creatorAddress);

      // Format total supply using BigInt arithmetic (totalSupply is BigInt from blockchain)
      const divisor = BigInt(10) ** BigInt(decimals);
      const formattedSupply = (totalSupply / divisor).toString();

      return {
        hasToken: true,
        tokenAddress: tokenAddress,
        name,
        symbol,
        decimals,
        totalSupply: formattedSupply,
        pool: poolData
      };
    } catch (error) {
      console.error(`❌ Error getting token data for ${creatorAddress}:`, error);
      return { hasToken: false };
    }
  }

  /**
   * Get pool data for a token from CreatorPoolManager contract
   */
  async getPoolData(tokenAddress, creatorAddress) {
    try {
      const poolManagerAddress = process.env.CREATOR_POOL_MANAGER_ADDRESS;

      if (!poolManagerAddress) {
        console.log('⚠️ CREATOR_POOL_MANAGER_ADDRESS not configured in .env');
        return {
          exists: false,
          liquidityPoolAddress: null,
          tokenReserve: '0',
          nativeReserve: '0',
          price: 0,
          volume24h: '0'
        };
      }

      console.log(`🏊 Checking pool for token: ${tokenAddress}`);

      // CreatorPoolManager ABI - minimal, just what we need
      const poolManagerABI = [
        'function poolExists(address token) view returns (bool)',
        'function pools(address) view returns (bool exists, address token, uint256 reserveToken, uint256 reserveNative)'
      ];

      const poolManager = new ethers.Contract(
        poolManagerAddress,
        poolManagerABI,
        this.provider
      );

      // Check if pool exists
      const exists = await poolManager.poolExists(tokenAddress);

      if (!exists) {
        console.log(`   ❌ No pool exists for token ${tokenAddress}`);
        return {
          exists: false,
          liquidityPoolAddress: null,
          tokenReserve: '0',
          nativeReserve: '0',
          price: 0,
          volume24h: '0'
        };
      }

      // Get pool details from the pools mapping
      const pool = await poolManager.pools(tokenAddress);

      // Calculate price: price = reserveNative / reserveToken
      // Using BigInt arithmetic to avoid precision loss
      let price = 0;
      if (pool.reserveToken > 0n) {
        // Convert to numbers for price calculation
        // We'll use 18 decimal precision
        const nativeAmount = Number(pool.reserveNative) / 1e18;
        const tokenAmount = Number(pool.reserveToken) / 1e18;
        price = nativeAmount / tokenAmount;
      }

      console.log(`   ✅ Pool found!`);
      console.log(`      Token Reserve: ${pool.reserveToken.toString()}`);
      console.log(`      Native Reserve: ${pool.reserveNative.toString()}`);
      console.log(`      Price: ${price.toFixed(6)} ETH per token`);

      return {
        exists: true,
        liquidityPoolAddress: poolManagerAddress,
        tokenReserve: pool.reserveToken.toString(),
        nativeReserve: pool.reserveNative.toString(),
        price: price,
        volume24h: '0'  // TODO: Calculate from swap events
      };
    } catch (error) {
      console.error('❌ Error getting pool data:', error.message);
      return {
        exists: false,
        liquidityPoolAddress: null,
        tokenReserve: '0',
        nativeReserve: '0',
        price: 0,
        volume24h: '0'
      };
    }
  }

  /**
   * Upsert creator profile
   */
  async upsertCreatorProfile(user, tokenData) {
    try {
      await this.db.query(`
        INSERT INTO creator_profiles (
          user_id,
          para_user_id,
          wallet_address,
          updated_at
        ) VALUES ($1, $2, $3, NOW())
        ON CONFLICT (wallet_address)
        DO UPDATE SET
          updated_at = NOW()
      `, [
        user.id,
        user.para_user_id,
        user.wallet_address.toLowerCase()
      ]);
    } catch (error) {
      console.error('❌ Error upserting creator profile:', error);
    }
  }

  /**
   * Upsert creator token
   */
  async upsertCreatorToken(user, tokenData) {
    try {
      // First get or create creator_profile
      const profileResult = await this.db.query(`
        SELECT id FROM creator_profiles
        WHERE wallet_address = $1
      `, [user.wallet_address.toLowerCase()]);

      if (profileResult.rows.length === 0) {
        console.error('❌ Creator profile not found');
        return;
      }

      const creatorProfileId = profileResult.rows[0].id;

      // Calculate price change (for now, set to 0 - will be calculated by price history)
      const priceChange24h = 0;

      await this.db.query(`
        INSERT INTO creator_tokens (
          creator_profile_id,
          contract_address,
          name,
          symbol,
          decimals,
          total_supply,
          circulating_supply,
          current_price,
          price_change_24h,
          volume_24h,
          market_cap,
          total_liquidity,
          liquidity_pool_address,
          unique_traders,
          total_transactions,
          buy_count_24h,
          sell_count_24h,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW())
        ON CONFLICT (contract_address)
        DO UPDATE SET
          current_price = $8,
          price_change_24h = $9,
          volume_24h = $10,
          market_cap = $11,
          total_liquidity = $12,
          liquidity_pool_address = $13,
          updated_at = NOW()
      `, [
        creatorProfileId,
        tokenData.tokenAddress.toLowerCase(),
        tokenData.name,
        tokenData.symbol,
        tokenData.decimals,
        tokenData.totalSupply,
        tokenData.totalSupply, // Circulating supply = total supply for now
        tokenData.pool.price || 0,
        priceChange24h,
        tokenData.pool.volume24h || '0',
        parseFloat(tokenData.totalSupply) * (tokenData.pool.price || 0), // Market cap
        tokenData.pool.nativeReserve || '0',
        tokenData.pool.liquidityPoolAddress,
        0, // Unique traders - will be calculated from transactions
        0, // Total transactions - will be calculated
        0, // Buy count 24h
        0  // Sell count 24h
      ]);

      console.log(`✅ Updated token data for ${tokenData.symbol}`);
    } catch (error) {
      console.error('❌ Error upserting creator token:', error);
      throw error;
    }
  }

  /**
   * Update price for a single token
   */
  async updateTokenPrice(tokenAddress, creatorAddress) {
    try {
      console.log(`💰 Updating price for token: ${tokenAddress}`);

      const tokenData = await this.getCreatorTokenData(creatorAddress);

      if (!tokenData.hasToken) {
        console.log('ℹ️ Token not found');
        return null;
      }

      // Get current price from database for comparison
      const currentResult = await this.db.query(`
        SELECT current_price, price_change_24h
        FROM creator_tokens
        WHERE contract_address = $1
      `, [tokenAddress.toLowerCase()]);

      // Parse oldPrice from VARCHAR to number (current_price is stored as VARCHAR(78))
      const oldPrice = parseFloat(currentResult.rows[0]?.current_price) || 0;
      const newPrice = tokenData.pool.price || 0;

      // Calculate price change percentage
      // Avoid division by zero and cap at reasonable limits to prevent overflow
      let priceChange = 0;
      if (oldPrice > 0) {
        priceChange = ((newPrice - oldPrice) / oldPrice) * 100;
        // Cap price change to prevent NUMERIC(10,4) overflow (max ±999999.9999)
        priceChange = Math.max(-999999, Math.min(999999, priceChange));
      } else if (newPrice > 0) {
        // If there was no previous price but now there is, it's a 100% increase (new listing)
        priceChange = 100;
      }

      // Update token price
      await this.db.query(`
        UPDATE creator_tokens
        SET current_price = $1,
            price_change_24h = $2,
            volume_24h = $3,
            total_liquidity = $4,
            last_price_update = NOW(),
            updated_at = NOW()
        WHERE contract_address = $5
      `, [
        newPrice,
        priceChange,
        tokenData.pool.volume24h || '0',
        tokenData.pool.nativeReserve || '0',
        tokenAddress.toLowerCase()
      ]);

      // Record price in history
      await this.recordPriceHistory(tokenAddress, newPrice, tokenData.pool.volume24h || '0');

      console.log(`✅ Price updated: ${oldPrice} → ${newPrice} (${priceChange > 0 ? '+' : ''}${priceChange.toFixed(2)}%)`);

      return {
        oldPrice,
        newPrice,
        priceChange
      };
    } catch (error) {
      console.error(`❌ Error updating token price for ${tokenAddress}:`, error);
      return null;
    }
  }

  /**
   * Record price in history for charting
   */
  async recordPriceHistory(tokenAddress, price, volume) {
    try {
      // Get token_id
      const tokenResult = await this.db.query(`
        SELECT id FROM creator_tokens
        WHERE contract_address = $1
      `, [tokenAddress.toLowerCase()]);

      if (tokenResult.rows.length === 0) {
        console.error('❌ Token not found in database');
        return;
      }

      const tokenId = tokenResult.rows[0].id;
      const now = new Date();
      const timestamp = now.toISOString();

      // Record for different intervals
      const intervals = ['1h', '4h', '1d'];

      for (const interval of intervals) {
        // Get the last recorded price for this interval
        const lastResult = await this.db.query(`
          SELECT close_price
          FROM token_price_history
          WHERE token_id = $1
            AND interval_type = $2
          ORDER BY timestamp DESC
          LIMIT 1
        `, [tokenId, interval]);

        const lastPrice = lastResult.rows[0]?.close_price || price;

        // Determine if we should record based on interval
        const shouldRecord = await this.shouldRecordForInterval(tokenId, interval, now);

        if (shouldRecord) {
          await this.db.query(`
            INSERT INTO token_price_history (
              token_id,
              interval_type,
              timestamp,
              open_price,
              high_price,
              low_price,
              close_price,
              volume
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            tokenId,
            interval,
            timestamp,
            lastPrice,  // Open = last close
            Math.max(price, lastPrice),  // High
            Math.min(price, lastPrice),  // Low
            price,      // Close = current price
            volume
          ]);

          console.log(`📈 Recorded ${interval} price: ${price}`);
        }
      }
    } catch (error) {
      console.error('❌ Error recording price history:', error);
    }
  }

  /**
   * Check if we should record price for this interval
   */
  async shouldRecordForInterval(tokenId, interval, currentTime) {
    try {
      const lastResult = await this.db.query(`
        SELECT timestamp
        FROM token_price_history
        WHERE token_id = $1
          AND interval_type = $2
        ORDER BY timestamp DESC
        LIMIT 1
      `, [tokenId, interval]);

      if (lastResult.rows.length === 0) {
        return true; // First record
      }

      const lastTimestamp = new Date(lastResult.rows[0].timestamp);
      const diff = currentTime - lastTimestamp;

      // Record based on interval
      switch (interval) {
        case '1h':
          return diff >= 60 * 60 * 1000; // 1 hour
        case '4h':
          return diff >= 4 * 60 * 60 * 1000; // 4 hours
        case '1d':
          return diff >= 24 * 60 * 60 * 1000; // 24 hours
        default:
          return false;
      }
    } catch (error) {
      console.error('❌ Error checking record interval:', error);
      return false;
    }
  }

  /**
   * Update all token prices
   */
  async updateAllTokenPrices() {
    try {
      console.log('💰 Starting price update for all tokens...');

      // Get all creator tokens
      const tokensResult = await this.db.query(`
        SELECT ct.contract_address, cp.wallet_address
        FROM creator_tokens ct
        INNER JOIN creator_profiles cp ON ct.creator_profile_id = cp.id
        WHERE ct.contract_address IS NOT NULL
      `);

      const tokens = tokensResult.rows;
      console.log(`📊 Found ${tokens.length} tokens to update`);

      let updated = 0;
      for (const token of tokens) {
        const result = await this.updateTokenPrice(token.contract_address, token.wallet_address);
        if (result) {
          updated++;
        }
        await this.sleep(200); // Small delay
      }

      console.log(`✅ Updated ${updated}/${tokens.length} token prices`);

      return {
        total: tokens.length,
        updated
      };
    } catch (error) {
      console.error('❌ Error updating all token prices:', error);
      throw error;
    }
  }

  /**
   * Utility: Sleep function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
let blockchainSyncServiceInstance = null;

function getBlockchainSyncService(db) {
  if (!blockchainSyncServiceInstance && db) {
    blockchainSyncServiceInstance = new BlockchainSyncService(db);
  }
  return blockchainSyncServiceInstance;
}

module.exports = { BlockchainSyncService, getBlockchainSyncService };
