/**
 * Telegram Service
 * Handles Telegram room access and purchases
 */

class TelegramService {
  constructor(db) {
    this.db = db;
  }

  /**
   * Get Telegram room info by creator identifier
   * @param {string} identifier Wallet address or Twitter username
   * @returns {Promise<Object>} Telegram room data
   */
  async getTelegramRoom(identifier) {
    try {
      console.log(`📱 Fetching Telegram room for: ${identifier}`);

      const isAddress = identifier.startsWith('0x');
      const query = isAddress
        ? `SELECT tr.*, cp.wallet_address, cp.twitter_username
           FROM telegram_rooms tr
           INNER JOIN creator_profiles cp ON tr.creator_profile_id = cp.id
           WHERE LOWER(cp.wallet_address) = $1 AND tr.is_active = true
           LIMIT 1`
        : `SELECT tr.*, cp.wallet_address, cp.twitter_username
           FROM telegram_rooms tr
           INNER JOIN creator_profiles cp ON tr.creator_profile_id = cp.id
           WHERE LOWER(cp.twitter_username) = $1 AND tr.is_active = true
           LIMIT 1`;

      const result = await this.db.query(query, [identifier.toLowerCase()]);

      if (result.rows.length === 0) {
        return null;
      }

      const room = result.rows[0];

      // Get recent activity (mock data for now)
      const recentActivity = [
        {
          message: 'Discussed upcoming product launch strategies...',
          timestamp: '2m ago'
        },
        {
          message: 'Shared exclusive market insights...',
          timestamp: '15m ago'
        }
      ];

      return {
        id: room.id,
        roomId: room.room_id,
        roomName: room.room_name,
        pricePerMinute: parseFloat(room.price_per_minute),
        currency: room.currency,
        activeMembers: room.active_members || 0,
        totalMembers: room.total_members || 0,
        totalMessages: room.total_messages || 0,
        isActive: room.is_active,
        recentActivity
      };
    } catch (error) {
      console.error('❌ Error fetching Telegram room:', error);
      throw error;
    }
  }

  /**
   * Purchase Telegram access
   * @param {string} identifier Wallet address or Twitter username
   * @param {Object} purchaseData Purchase details
   * @returns {Promise<Object>} Purchase result with invite link
   */
  async purchaseTelegramAccess(identifier, purchaseData) {
    try {
      const {
        durationMinutes,
        paymentToken,
        transactionHash,
        userParaId,
        walletAddress
      } = purchaseData;

      console.log(`💳 Processing Telegram access purchase for: ${identifier}`);

      // Get Telegram room
      const room = await this.getTelegramRoom(identifier);
      if (!room) {
        throw new Error('Telegram room not found');
      }

      // Calculate price
      const pricePaid = room.pricePerMinute * durationMinutes;

      // Calculate expiry
      const accessGrantedAt = new Date();
      const accessExpiresAt = new Date(accessGrantedAt.getTime() + durationMinutes * 60000);

      // Generate invite link (in production, this would call Telegram API)
      const inviteLink = `https://t.me/+${this.generateInviteCode()}`;

      // Store purchase
      const result = await this.db.query(`
        INSERT INTO telegram_access_purchases (
          room_id,
          para_user_id,
          wallet_address,
          duration_minutes,
          price_paid,
          payment_token,
          transaction_hash,
          invite_link,
          access_granted_at,
          access_expires_at,
          is_active,
          status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
      `, [
        room.id,
        userParaId,
        walletAddress.toLowerCase(),
        durationMinutes,
        pricePaid,
        paymentToken,
        transactionHash,
        inviteLink,
        accessGrantedAt,
        accessExpiresAt,
        true,
        'active'
      ]);

      const purchaseId = result.rows[0].id;

      // Update room member count
      await this.db.query(`
        UPDATE telegram_rooms
        SET active_members = active_members + 1,
            total_members = total_members + 1
        WHERE id = $1
      `, [room.id]);

      console.log(`✅ Telegram access purchased: ${purchaseId}`);

      return {
        purchaseId,
        inviteLink,
        accessGrantedAt: accessGrantedAt.toISOString(),
        accessExpiresAt: accessExpiresAt.toISOString(),
        durationMinutes,
        pricePaid: pricePaid.toFixed(2),
        currency: room.currency,
        status: 'active'
      };
    } catch (error) {
      console.error('❌ Error purchasing Telegram access:', error);
      throw error;
    }
  }

  /**
   * Generate random invite code
   * @returns {string} Random invite code
   */
  generateInviteCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < 22; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Expire old Telegram access
   * Should be called by a cron job
   */
  async expireOldAccess() {
    try {
      console.log('🔄 Expiring old Telegram access...');

      // Update expired purchases
      const result = await this.db.query(`
        UPDATE telegram_access_purchases
        SET status = 'expired', is_active = false
        WHERE status = 'active'
          AND access_expires_at < NOW()
        RETURNING room_id
      `);

      // Update room member counts
      if (result.rows.length > 0) {
        const roomIds = [...new Set(result.rows.map(r => r.room_id))];
        
        for (const roomId of roomIds) {
          await this.db.query(`
            UPDATE telegram_rooms
            SET active_members = (
              SELECT COUNT(*)
              FROM telegram_access_purchases
              WHERE room_id = $1
                AND status = 'active'
                AND access_expires_at > NOW()
            )
            WHERE id = $1
          `, [roomId]);
        }
      }

      console.log(`✅ Expired ${result.rows.length} Telegram access entries`);
      return result.rows.length;
    } catch (error) {
      console.error('❌ Error expiring Telegram access:', error);
      throw error;
    }
  }
}

module.exports = TelegramService;
