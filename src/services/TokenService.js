/**
 * Token Service
 * Handles token-related business logic including price history, holders, and transactions
 */

class TokenService {
  constructor(db) {
    this.db = db;
  }

  /**
   * Get token information by creator identifier
   * @param {string} identifier Wallet address or Twitter username
   * @returns {Promise<Object>} Token data
   */
  async getTokenInfo(identifier) {
    try {
      console.log(`🪙 Fetching token info for: ${identifier}`);

      const isAddress = identifier.startsWith('0x');
      const query = isAddress
        ? `SELECT ct.*, cp.wallet_address, cp.twitter_username
           FROM creator_tokens ct
           INNER JOIN creator_profiles cp ON ct.creator_profile_id = cp.id
           WHERE LOWER(cp.wallet_address) = $1
           LIMIT 1`
        : `SELECT ct.*, cp.wallet_address, cp.twitter_username
           FROM creator_tokens ct
           INNER JOIN creator_profiles cp ON ct.creator_profile_id = cp.id
           WHERE LOWER(cp.twitter_username) = $1
           LIMIT 1`;

      const result = await this.db.query(query, [identifier.toLowerCase()]);

      if (result.rows.length === 0) {
        return null;
      }

      const token = result.rows[0];

      return {
        address: token.contract_address,
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
        totalSupply: token.total_supply,
        circulatingSupply: token.circulating_supply,
        currentPrice: parseFloat(token.current_price || '0'),
        price: parseFloat(token.current_price || '0'),
        priceChange24h: parseFloat(token.price_change_24h || '0'),
        priceChangePercent: `${token.price_change_24h > 0 ? '+' : ''}${parseFloat(token.price_change_24h || '0').toFixed(2)}%`,
        volume24h: parseFloat(token.volume_24h || '0'),
        marketCap: parseFloat(token.market_cap || '0'),
        totalLiquidity: token.total_liquidity || '0',
        holders: token.unique_traders || 0,
        hasPool: !!token.liquidity_pool_address,
        liquidityPool: token.liquidity_pool_address,
        totalTransactions: token.total_transactions || 0,
        uniqueTraders: token.unique_traders || 0,
        buyCount24h: token.buy_count_24h || 0,
        sellCount24h: token.sell_count_24h || 0
      };
    } catch (error) {
      console.error('❌ Error fetching token info:', error);
      throw error;
    }
  }

  /**
   * Get token price history
   * @param {string} identifier Wallet address or Twitter username
   * @param {Object} options Query options
   * @returns {Promise<Object>} Price history data
   */
  async getPriceHistory(identifier, options = {}) {
    try {
      const {
        interval = '1h',
        limit = 100,
        from = null,
        to = null
      } = options;

      console.log(`📈 Fetching price history for: ${identifier} (interval: ${interval})`);

      // First get the token
      const tokenInfo = await this.getTokenInfo(identifier);
      if (!tokenInfo) {
        return null;
      }

      // Get token ID
      const isAddress = identifier.startsWith('0x');
      const tokenQuery = isAddress
        ? `SELECT ct.id FROM creator_tokens ct
           INNER JOIN creator_profiles cp ON ct.creator_profile_id = cp.id
           WHERE LOWER(cp.wallet_address) = $1`
        : `SELECT ct.id FROM creator_tokens ct
           INNER JOIN creator_profiles cp ON ct.creator_profile_id = cp.id
           WHERE LOWER(cp.twitter_username) = $1`;

      const tokenResult = await this.db.query(tokenQuery, [identifier.toLowerCase()]);
      const tokenId = tokenResult.rows[0]?.id;

      if (!tokenId) {
        return null;
      }

      // Build time filter
      let timeFilter = '';
      const params = [tokenId, interval, limit];
      let paramIndex = 4;

      if (from) {
        timeFilter += ` AND timestamp >= to_timestamp($${paramIndex})`;
        params.push(from);
        paramIndex++;
      }

      if (to) {
        timeFilter += ` AND timestamp <= to_timestamp($${paramIndex})`;
        params.push(to);
      }

      // Get price history
      const historyResult = await this.db.query(`
        SELECT
          EXTRACT(EPOCH FROM timestamp)::bigint as timestamp,
          CAST(open_price AS NUMERIC) as open_price,
          CAST(high_price AS NUMERIC) as high_price,
          CAST(low_price AS NUMERIC) as low_price,
          CAST(close_price AS NUMERIC) as close_price,
          CAST(volume AS NUMERIC) as volume
        FROM token_price_history
        WHERE token_id = $1
          AND interval_type = $2
          ${timeFilter}
        ORDER BY timestamp DESC
        LIMIT $3
      `, params);

      // Format price history
      const priceHistory = historyResult.rows.map(row => ({
        timestamp: parseInt(row.timestamp),
        timestampMs: parseInt(row.timestamp) * 1000,
        open: parseFloat(row.open_price),
        high: parseFloat(row.high_price),
        low: parseFloat(row.low_price),
        close: parseFloat(row.close_price),
        price: parseFloat(row.close_price),
        volume: parseFloat(row.volume || '0'),
        priceChange: parseFloat(row.close_price) - parseFloat(row.open_price),
        priceChangePercent: ((parseFloat(row.close_price) - parseFloat(row.open_price)) / parseFloat(row.open_price) * 100).toFixed(2)
      }));

      return {
        currentPrice: tokenInfo.currentPrice,
        priceChange24h: tokenInfo.priceChange24h,
        priceChangePercent: tokenInfo.priceChangePercent,
        volume24h: tokenInfo.volume24h,
        holders: tokenInfo.holders,
        marketCap: tokenInfo.marketCap,
        priceHistory
      };
    } catch (error) {
      console.error('❌ Error fetching price history:', error);
      throw error;
    }
  }

  /**
   * Get token holders
   * @param {string} identifier Wallet address or Twitter username
   * @param {Object} options Query options
   * @returns {Promise<Object>} Holders data with pagination
   */
  async getTokenHolders(identifier, options = {}) {
    try {
      const { limit = 10, offset = 0 } = options;

      console.log(`👥 Fetching token holders for: ${identifier}`);

      // Get token ID
      const isAddress = identifier.startsWith('0x');
      const tokenQuery = isAddress
        ? `SELECT ct.id, ct.total_supply FROM creator_tokens ct
           INNER JOIN creator_profiles cp ON ct.creator_profile_id = cp.id
           WHERE LOWER(cp.wallet_address) = $1`
        : `SELECT ct.id, ct.total_supply FROM creator_tokens ct
           INNER JOIN creator_profiles cp ON ct.creator_profile_id = cp.id
           WHERE LOWER(cp.twitter_username) = $1`;

      const tokenResult = await this.db.query(tokenQuery, [identifier.toLowerCase()]);
      
      if (tokenResult.rows.length === 0) {
        return null;
      }

      const tokenId = tokenResult.rows[0].id;

      // Get holders
      const holdersResult = await this.db.query(`
        SELECT
          holder_address,
          balance,
          percentage_of_supply,
          first_acquired_at,
          last_transaction_at,
          total_transactions,
          is_whale
        FROM token_holders
        WHERE token_id = $1
        ORDER BY CAST(balance AS NUMERIC) DESC
        LIMIT $2 OFFSET $3
      `, [tokenId, limit, offset]);

      // Get total count
      const countResult = await this.db.query(`
        SELECT COUNT(*)::integer as total
        FROM token_holders
        WHERE token_id = $1
      `, [tokenId]);

      const total = countResult.rows[0]?.total || 0;

      // Format holders
      const holders = holdersResult.rows.map((row, index) => {
        const balance = parseFloat(row.balance);
        const balanceFormatted = balance >= 1000000
          ? `${(balance / 1000000).toFixed(2)}M`
          : balance >= 1000
          ? `${(balance / 1000).toFixed(2)}K`
          : balance.toFixed(2);

        return {
          rank: offset + index + 1,
          address: row.holder_address,
          balance: row.balance,
          balanceFormatted,
          percentage: parseFloat(row.percentage_of_supply || '0'),
          percentageFormatted: `${parseFloat(row.percentage_of_supply || '0').toFixed(2)}%`,
          firstAcquired: row.first_acquired_at,
          lastTransaction: row.last_transaction_at,
          totalTransactions: row.total_transactions || 0,
          isWhale: row.is_whale || false
        };
      });

      return {
        holders,
        pagination: {
          total,
          limit,
          offset,
          hasMore: (offset + limit) < total
        }
      };
    } catch (error) {
      console.error('❌ Error fetching token holders:', error);
      throw error;
    }
  }

  /**
   * Get token transactions
   * @param {string} identifier Wallet address or Twitter username
   * @param {Object} options Query options
   * @returns {Promise<Object>} Transactions data with pagination
   */
  async getTokenTransactions(identifier, options = {}) {
    try {
      const {
        type = 'all',
        limit = 20,
        offset = 0
      } = options;

      console.log(`💸 Fetching token transactions for: ${identifier} (type: ${type})`);

      // Get token ID
      const isAddress = identifier.startsWith('0x');
      const tokenQuery = isAddress
        ? `SELECT ct.id FROM creator_tokens ct
           INNER JOIN creator_profiles cp ON ct.creator_profile_id = cp.id
           WHERE LOWER(cp.wallet_address) = $1`
        : `SELECT ct.id FROM creator_tokens ct
           INNER JOIN creator_profiles cp ON ct.creator_profile_id = cp.id
           WHERE LOWER(cp.twitter_username) = $1`;

      const tokenResult = await this.db.query(tokenQuery, [identifier.toLowerCase()]);
      
      if (tokenResult.rows.length === 0) {
        return null;
      }

      const tokenId = tokenResult.rows[0].id;

      // Build type filter
      let typeFilter = '';
      if (type !== 'all') {
        typeFilter = 'AND transaction_type = $4';
      }

      // Get transactions
      const params = type !== 'all' 
        ? [tokenId, limit, offset, type]
        : [tokenId, limit, offset];

      const transactionsResult = await this.db.query(`
        SELECT
          transaction_hash,
          transaction_type,
          trader_address,
          token_amount,
          payment_amount,
          payment_token,
          price_per_token,
          usd_value,
          gas_used,
          gas_price,
          dex_name,
          block_number,
          timestamp
        FROM token_transactions
        WHERE token_id = $1
          ${typeFilter}
        ORDER BY timestamp DESC
        LIMIT $2 OFFSET $3
      `, params);

      // Get total count
      const countParams = type !== 'all' ? [tokenId, type] : [tokenId];
      const countResult = await this.db.query(`
        SELECT COUNT(*)::integer as total
        FROM token_transactions
        WHERE token_id = $1
          ${typeFilter}
      `, countParams);

      const total = countResult.rows[0]?.total || 0;

      // Format transactions
      const transactions = transactionsResult.rows.map(row => {
        const now = new Date();
        const txTime = new Date(row.timestamp);
        const diffMs = now - txTime;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        let timeAgo;
        if (diffMins < 60) {
          timeAgo = `${diffMins}m ago`;
        } else if (diffHours < 24) {
          timeAgo = `${diffHours}h ago`;
        } else {
          timeAgo = `${diffDays}d ago`;
        }

        return {
          id: row.transaction_hash,
          txHash: row.transaction_hash,
          transactionHash: row.transaction_hash,
          type: row.transaction_type,
          trader: row.trader_address,
          traderAddress: row.trader_address,
          tokenAmount: row.token_amount,
          paymentAmount: row.payment_amount,
          paymentToken: row.payment_token,
          pricePerToken: row.price_per_token ? parseFloat(row.price_per_token).toFixed(6) : '0',
          usdValue: row.usd_value ? parseFloat(row.usd_value).toFixed(2) : '0',
          gasUsed: row.gas_used,
          gasPrice: row.gas_price,
          dex: row.dex_name,
          dexName: row.dex_name ? row.dex_name.charAt(0).toUpperCase() + row.dex_name.slice(1) : 'Unknown',
          blockNumber: row.block_number,
          timestamp: row.timestamp,
          timeAgo
        };
      });

      return {
        transactions,
        pagination: {
          total,
          limit,
          offset,
          type,
          hasMore: (offset + limit) < total
        }
      };
    } catch (error) {
      console.error('❌ Error fetching token transactions:', error);
      throw error;
    }
  }
}

module.exports = TokenService;
