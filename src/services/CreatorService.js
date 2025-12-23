/**
 * Creator Service
 * Handles all creator-related business logic
 */

const { getTwitterService } = require('./TwitterService');

class CreatorService {
  constructor(db) {
    this.db = db;
    this.twitterService = getTwitterService();
  }

  /**
   * Get trending creators
   * @param {Object} options Query options
   * @returns {Promise<Array>} List of trending creators
   */
  async getTrendingCreators(options = {}) {
    const {
      limit = 7,
      sortBy = 'volume',
      timeframe = '24h'
    } = options;

    try {
      console.log(`📊 Fetching trending creators (limit: ${limit}, sortBy: ${sortBy})`);

      // Get trending creators from database
      // ✅ IMPORTANT: Only show creators who have BOTH token AND pool
      const result = await this.db.query(`
        SELECT
          cp.wallet_address as id,
          cp.twitter_username as username,
          cp.profile_image as avatar,
          cp.twitter_verified as verified,
          ct.contract_address as token_address,
          ct.symbol as token_symbol,
          ct.name as token_name,
          ct.current_price,
          ct.price_change_24h,
          ct.volume_24h,
          ct.market_cap,
          ct.total_transactions,
          ct.unique_traders as holders,
          ct.liquidity_pool_address
        FROM creator_profiles cp
        INNER JOIN creator_tokens ct ON cp.id = ct.creator_profile_id
        WHERE ct.contract_address IS NOT NULL
          AND ct.liquidity_pool_address IS NOT NULL
        ORDER BY
          CASE
            WHEN $1 = 'volume' THEN CAST(ct.volume_24h AS NUMERIC)
            WHEN $1 = 'holders' THEN ct.unique_traders
            WHEN $1 = 'price_change' THEN ct.price_change_24h
            ELSE CAST(ct.volume_24h AS NUMERIC)
          END DESC
        LIMIT $2
      `, [sortBy, limit]);

      if (result.rows.length === 0) {
        console.log('ℹ️ No trending creators found in database');
        return [];
      }

      // Fetch Twitter data for creators who have usernames
      const usernames = result.rows
        .filter(row => row.username)
        .map(row => row.username);

      let twitterDataMap = new Map();
      if (usernames.length > 0) {
        console.log(`🐦 Fetching Twitter data for ${usernames.length} creators`);
        twitterDataMap = await this.twitterService.getTwitterUsers(usernames);
      }

      // Format response
      const creators = result.rows.map((row, index) => {
        const twitterData = row.username ? twitterDataMap.get(row.username.toLowerCase()) : null;

        return {
          id: row.id,
          name: twitterData?.name || row.username || `Creator ${index + 1}`,
          username: row.username || row.id.slice(0, 10),
          avatar: twitterData?.profileImageUrl || row.avatar || '/assets/home-page/person.png',
          verified: twitterData?.verified || row.verified || false,
          token: {
            address: row.token_address,
            symbol: row.token_symbol,
            name: row.token_name,
            price: parseFloat(row.current_price || '0'), // Send raw price, let frontend format it
            priceChange24h: parseFloat(row.price_change_24h || '0'),
            volume24h: row.volume_24h || '0',
            marketCap: row.market_cap || '0',
            hasPool: !!row.liquidity_pool_address
          },
          stats: {
            holders: row.holders || 0,
            totalVolume: row.volume_24h || '0',
            rank: index + 1
          }
        };
      });

      console.log(`✅ Returning ${creators.length} trending creators`);
      return creators;

    } catch (error) {
      console.error('❌ Error fetching trending creators:', error);
      throw error;
    }
  }

  /**
   * Get creator profile
   * @param {string} address Creator wallet address
   * @param {Object} options Query options
   * @returns {Promise<Object>} Creator profile data
   */
  async getCreatorProfile(address, options = {}) {
    const { include = [], twitterUsername = null } = options;

    try {
      console.log(`👤 Fetching creator profile: ${address}`);

      // Get creator from database
      const result = await this.db.query(`
        SELECT
          cp.wallet_address,
          cp.twitter_username,
          cp.twitter_id,
          cp.bio,
          cp.profile_image,
          cp.cover_image,
          cp.twitter_verified,
          cp.twitter_followers_count,
          cp.website_url,
          cp.twitter_url,
          cp.telegram_url,
          cp.is_verified,
          cp.badge_tier,
          cp.total_events_created,
          cp.last_synced_at,
          ct.contract_address as token_address,
          ct.symbol as token_symbol,
          ct.name as token_name,
          ct.decimals,
          ct.total_supply,
          ct.current_price,
          ct.market_cap,
          ct.unique_traders as token_holders,
          ct.total_transactions,
          ct.liquidity_pool_address
        FROM creator_profiles cp
        LEFT JOIN creator_tokens ct ON cp.id = ct.creator_profile_id
        WHERE LOWER(cp.wallet_address) = $1
        LIMIT 1
      `, [address.toLowerCase()]);

      let creatorData = result.rows[0];
      let twitterData = null;

      // Fetch Twitter data if needed
      const username = twitterUsername || creatorData?.twitter_username;

      if (username) {
        twitterData = await this.twitterService.getTwitterUser(username);

        // Cache the Twitter data if fetched successfully
        if (twitterData) {
          await this.twitterService.cacheTwitterData(this.db, address, twitterData);
        }
      } else if (creatorData) {
        // Try to get cached Twitter data
        twitterData = await this.twitterService.getCachedTwitterData(this.db, address);
      }

      // Get stats if requested
      let stats = null;
      if (include.includes('stats')) {
        stats = {
          followers: twitterData?.followersCount || creatorData?.twitter_followers_count || 0,
          tokenHolders: creatorData?.token_holders || 0,
          totalEvents: creatorData?.total_events_created || 0,
          totalVolume: '0'
        };
      }

      // Build response
      const creator = {
        id: address.toLowerCase(),
        walletAddress: address.toLowerCase(),
        username: twitterData?.username || creatorData?.twitter_username || address.slice(0, 10),
        displayName: twitterData?.name || creatorData?.twitter_username || 'Unknown Creator',
        bio: twitterData?.bio || creatorData?.bio || '',
        profileImage: twitterData?.profileImageUrl || creatorData?.profile_image || '/assets/home-page/person.png',
        coverImage: creatorData?.cover_image || null,
        verified: twitterData?.verified || creatorData?.is_verified || false,
        badges: creatorData?.is_verified ? ['verified'] : [],
        social: {
          twitter: twitterData ? {
            username: twitterData.username,
            url: `https://twitter.com/${twitterData.username}`,
            followers: twitterData.followersCount,
            verified: twitterData.verified
          } : null,
          telegram: creatorData?.telegram_url || null,
          website: creatorData?.website_url || null
        }
      };

      // Add stats if requested
      if (stats) {
        creator.stats = stats;
      }

      // Add token if requested
      if (include.includes('token') && creatorData?.token_address) {
        creator.token = {
          address: creatorData.token_address,
          symbol: creatorData.token_symbol,
          name: creatorData.token_name,
          decimals: creatorData.decimals,
          totalSupply: creatorData.total_supply,
          currentPrice: creatorData.current_price,
          marketCap: creatorData.market_cap,
          hasPool: !!creatorData.liquidity_pool_address
        };
      }

      console.log(`✅ Creator profile fetched: ${creator.username}`);
      return creator;

    } catch (error) {
      console.error('❌ Error fetching creator profile:', error);
      throw error;
    }
  }

  /**
   * Follow or unfollow a creator
   * @param {string} identifier Creator wallet address or username
   * @param {Object} followData Follow action data
   * @returns {Promise<Object>} Follow result
   */
  async toggleFollow(identifier, followData) {
    try {
      const { action, userParaId, walletAddress, enableNotifications = true } = followData;

      console.log(`${action === 'follow' ? '➕' : '➖'} ${action} creator: ${identifier}`);

      // Get creator profile ID
      const isAddress = identifier.startsWith('0x');
      const creatorQuery = isAddress
        ? 'SELECT id FROM creator_profiles WHERE LOWER(wallet_address) = $1'
        : 'SELECT id FROM creator_profiles WHERE LOWER(twitter_username) = $1';

      const creatorResult = await this.db.query(creatorQuery, [identifier.toLowerCase()]);

      if (creatorResult.rows.length === 0) {
        throw new Error('Creator not found');
      }

      const creatorProfileId = creatorResult.rows[0].id;

      if (action === 'follow') {
        // Add follower
        await this.db.query(`
          INSERT INTO creator_followers (
            creator_profile_id,
            follower_para_id,
            follower_wallet,
            notifications_enabled
          ) VALUES ($1, $2, $3, $4)
          ON CONFLICT (creator_profile_id, follower_para_id)
          DO UPDATE SET
            notifications_enabled = EXCLUDED.notifications_enabled,
            followed_at = CURRENT_TIMESTAMP
        `, [creatorProfileId, userParaId, walletAddress.toLowerCase(), enableNotifications]);

        // Update follower count
        await this.db.query(`
          UPDATE creator_profiles
          SET total_followers = (
            SELECT COUNT(*)
            FROM creator_followers
            WHERE creator_profile_id = $1
          )
          WHERE id = $1
        `, [creatorProfileId]);

      } else if (action === 'unfollow') {
        // Remove follower
        await this.db.query(`
          DELETE FROM creator_followers
          WHERE creator_profile_id = $1
            AND follower_para_id = $2
        `, [creatorProfileId, userParaId]);

        // Update follower count
        await this.db.query(`
          UPDATE creator_profiles
          SET total_followers = (
            SELECT COUNT(*)
            FROM creator_followers
            WHERE creator_profile_id = $1
          )
          WHERE id = $1
        `, [creatorProfileId]);
      }

      // Get updated follower count
      const countResult = await this.db.query(`
        SELECT total_followers
        FROM creator_profiles
        WHERE id = $1
      `, [creatorProfileId]);

      const followerCount = countResult.rows[0]?.total_followers || 0;

      console.log(`✅ ${action} successful. New follower count: ${followerCount}`);

      return {
        following: action === 'follow',
        notificationsEnabled: action === 'follow' ? enableNotifications : false,
        followerCount
      };
    } catch (error) {
      console.error('❌ Error toggling follow:', error);
      throw error;
    }
  }

  /**
   * Get creator events/auctions
   * @param {string} address Creator wallet address
   * @param {Object} options Query options
   * @returns {Promise<Object>} Events data with pagination
   */
  async getCreatorEvents(address, options = {}) {
    const {
      status = 'upcoming',
      limit = 10,
      offset = 0
    } = options;

    try {
      console.log(`📅 Fetching events for creator: ${address} (status: ${status})`);

      // Build status condition
      let statusCondition = '';
      if (status === 'upcoming') {
        // Original: Auctions that haven't ended yet and meeting is in future
        statusCondition = 'AND a.event_start_time > NOW() AND a.ended = false';
      } else if (status === 'upcoming_calls' || status === 'awaiting_meeting') {
        // NEW: Auctions that have ended but meeting hasn't started yet
        // This is the window between auction end and meeting start
        statusCondition = 'AND a.ended = true AND a.event_start_time > NOW()';
      } else if (status === 'live') {
        statusCondition = 'AND a.event_start_time <= NOW() AND a.event_end_time > NOW() AND a.ended = false';
      } else if (status === 'ended') {
        statusCondition = 'AND a.ended = true';
      }

      // Get events
      const result = await this.db.query(`
        SELECT
          a.id,
          a.title,
          a.metadata_ipfs as description,
          a.event_start_time as start_time,
          a.event_end_time as end_time,
          a.meeting_duration as duration,
          a.bid_price as reserve_price,
          a.highest_bid,
          a.highest_bidder as winner,
          a.ended as auction_ended,
          a.nft_token_id,
          0 as bid_count,
          CASE
            WHEN a.event_start_time > NOW() THEN 'upcoming'
            WHEN a.event_start_time <= NOW() AND a.event_end_time > NOW() THEN 'live'
            ELSE 'ended'
          END as status
        FROM auctions a
        WHERE LOWER(a.creator_wallet) = $1
          ${statusCondition}
        ORDER BY a.event_start_time ASC
        LIMIT $2 OFFSET $3
      `, [address.toLowerCase(), limit, offset]);

      // Get total count
      const countResult = await this.db.query(`
        SELECT COUNT(*)::integer as total
        FROM auctions a
        WHERE LOWER(a.creator_wallet) = $1
          ${statusCondition}
      `, [address.toLowerCase()]);

      const total = parseInt(countResult.rows[0]?.total || '0');

      // Format events
      const events = result.rows.map(row => ({
        id: row.id.toString(),
        title: row.title || 'Meeting Event',
        description: row.description || '',
        type: 'auction',
        status: row.status,
        startTime: row.start_time,
        endTime: row.end_time,
        duration: row.duration,
        auction: {
          reservePrice: row.reserve_price,
          currentBid: row.highest_bid || '0',
          bidCount: parseInt(row.bid_count || '0'),
          winner: row.winner,
          auctionEnded: row.auction_ended
        },
        meeting: {
          platform: 'jitsi',
          roomUrl: row.nft_token_id ? `https://meet.jit.si/entangle-meeting-${row.id}` : null
        }
      }));

      console.log(`✅ Found ${events.length} events for creator`);

      return {
        events,
        pagination: {
          total,
          limit,
          offset,
          hasMore: (offset + limit) < total
        }
      };

    } catch (error) {
      console.error('❌ Error fetching creator events:', error);
      throw error;
    }
  }
}

module.exports = CreatorService;
