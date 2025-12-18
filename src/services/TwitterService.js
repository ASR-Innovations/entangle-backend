/**
 * Twitter API Integration Service
 * Fetches creator Twitter data from the Entangle Twitter service
 */

const TWITTER_API_BASE = 'https://entangle-twitter.vercel.app/api/twitter';

class TwitterService {
  constructor() {
    this.cache = new Map(); // In-memory cache
    this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Fetch Twitter user data by username
   * @param {string} username Twitter username (without @)
   * @returns {Promise<Object|null>} Twitter user data
   */
  async getTwitterUser(username) {
    try {
      const cleanUsername = username.startsWith('@') ? username.slice(1) : username;
      const cacheKey = cleanUsername.toLowerCase();

      // Check cache first
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        console.log(`📦 Using cached Twitter data for: ${cleanUsername}`);
        return cached.data;
      }

      const url = `${TWITTER_API_BASE}/user/${cleanUsername}`;
      console.log(`🐦 Fetching Twitter data for: ${cleanUsername}`);

      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`⚠️ Twitter user not found: ${cleanUsername}`);
          return null;
        }
        throw new Error(`Twitter API error: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success || !data.user) {
        console.warn(`⚠️ Invalid Twitter API response for: ${cleanUsername}`);
        return null;
      }

      // Cache the result
      this.cache.set(cacheKey, {
        data: data.user,
        timestamp: Date.now()
      });

      console.log(`✅ Twitter data fetched for: ${cleanUsername}`);
      return data.user;

    } catch (error) {
      console.error(`❌ Error fetching Twitter data for ${username}:`, error.message);
      return null;
    }
  }

  /**
   * Fetch Twitter data for multiple users in parallel
   * @param {string[]} usernames Array of Twitter usernames
   * @returns {Promise<Map<string, Object>>} Map of username to Twitter data
   */
  async getTwitterUsers(usernames) {
    const results = new Map();

    const promises = usernames.map(async (username) => {
      const data = await this.getTwitterUser(username);
      if (data) {
        results.set(username.toLowerCase(), data);
      }
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Cache Twitter data in database
   * @param {Object} db Database connection
   * @param {string} walletAddress Creator wallet address
   * @param {Object} twitterData Twitter user data
   */
  async cacheTwitterData(db, walletAddress, twitterData) {
    try {
      await db.query(`
        INSERT INTO creator_profiles (
          wallet_address,
          twitter_username,
          twitter_id,
          twitter_followers_count,
          twitter_following_count,
          twitter_tweet_count,
          twitter_verified,
          bio,
          profile_image,
          last_synced_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        ON CONFLICT (wallet_address)
        DO UPDATE SET
          twitter_username = EXCLUDED.twitter_username,
          twitter_id = EXCLUDED.twitter_id,
          twitter_followers_count = EXCLUDED.twitter_followers_count,
          twitter_following_count = EXCLUDED.twitter_following_count,
          twitter_tweet_count = EXCLUDED.twitter_tweet_count,
          twitter_verified = EXCLUDED.twitter_verified,
          bio = EXCLUDED.bio,
          profile_image = EXCLUDED.profile_image,
          last_synced_at = NOW()
      `, [
        walletAddress.toLowerCase(),
        twitterData.username,
        twitterData.id,
        twitterData.followersCount,
        twitterData.followingCount,
        twitterData.tweetCount,
        twitterData.verified,
        twitterData.bio || '',
        twitterData.profileImageUrl
      ]);

      console.log(`✅ Cached Twitter data for ${twitterData.username}`);
    } catch (error) {
      console.error('❌ Error caching Twitter data:', error.message);
    }
  }

  /**
   * Get cached Twitter data from database
   * @param {Object} db Database connection
   * @param {string} walletAddress Creator wallet address
   * @returns {Promise<Object|null>} Cached Twitter data or null
   */
  async getCachedTwitterData(db, walletAddress) {
    try {
      const result = await db.query(`
        SELECT
          twitter_id as id,
          twitter_username as username,
          COALESCE(twitter_username, 'Unknown') as name,
          bio,
          twitter_verified as verified,
          twitter_followers_count as "followersCount",
          twitter_following_count as "followingCount",
          twitter_tweet_count as "tweetCount",
          profile_image as "profileImageUrl"
        FROM creator_profiles
        WHERE LOWER(wallet_address) = $1
          AND twitter_username IS NOT NULL
          AND last_synced_at > NOW() - INTERVAL '5 minutes'
        LIMIT 1
      `, [walletAddress.toLowerCase()]);

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      console.error('❌ Error getting cached Twitter data:', error.message);
      return null;
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    console.log('✅ Twitter cache cleared');
  }
}

// Singleton instance
let instance = null;

function getTwitterService() {
  if (!instance) {
    instance = new TwitterService();
  }
  return instance;
}

module.exports = { getTwitterService };
