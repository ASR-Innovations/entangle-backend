#!/usr/bin/env node

/**
 * Sync data from remote database to local database
 */

require('dotenv').config();
const { Pool } = require('pg');

const REMOTE_DB = 'postgresql://entangle_user:entangle_secure_2024@209.38.123.139:5432/entangle_meetings';
const LOCAL_DB = process.env.DATABASE_URL;

async function syncDatabase() {
  console.log('🔄 SYNCING REMOTE DATABASE TO LOCAL');
  console.log('='.repeat(60));
  console.log('');

  const remotePool = new Pool({
    connectionString: REMOTE_DB,
    ssl: { rejectUnauthorized: false }
  });

  const localPool = new Pool({
    connectionString: LOCAL_DB
  });

  try {
    // Sync users
    console.log('👥 Syncing users...');
    const users = await remotePool.query('SELECT * FROM users ORDER BY id');
    
    for (const user of users.rows) {
      await localPool.query(`
        INSERT INTO users (
          id, para_user_id, wallet_address, email, auth_type, oauth_method,
          display_name, profile_image, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (para_user_id) DO UPDATE SET
          wallet_address = EXCLUDED.wallet_address,
          email = EXCLUDED.email,
          display_name = EXCLUDED.display_name,
          profile_image = EXCLUDED.profile_image,
          updated_at = EXCLUDED.updated_at
      `, [
        user.id, user.para_user_id, user.wallet_address, user.email,
        user.auth_type, user.oauth_method, user.display_name, user.profile_image,
        user.created_at, user.updated_at
      ]);
    }
    console.log(`✅ Synced ${users.rows.length} users`);
    console.log('');

    // Sync auctions
    console.log('🎯 Syncing auctions...');
    const auctions = await remotePool.query('SELECT * FROM auctions ORDER BY id');
    
    for (const auction of auctions.rows) {
      await localPool.query(`
        INSERT INTO auctions (
          id, contract_address, creator_para_id, creator_wallet, title, description,
          metadata_ipfs, twitter_id, seller_name, profile_picture, event_date,
          event_start_time, event_end_time, bid_price, duration_blocks, end_block,
          highest_bid, highest_bidder, blocks_remaining, time_remaining_seconds,
          meeting_duration, nft_token_id, jitsi_room_id, auto_ended, ended,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
          $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27
        )
        ON CONFLICT (id) DO UPDATE SET
          highest_bid = EXCLUDED.highest_bid,
          highest_bidder = EXCLUDED.highest_bidder,
          blocks_remaining = EXCLUDED.blocks_remaining,
          time_remaining_seconds = EXCLUDED.time_remaining_seconds,
          auto_ended = EXCLUDED.auto_ended,
          ended = EXCLUDED.ended,
          nft_token_id = EXCLUDED.nft_token_id,
          updated_at = EXCLUDED.updated_at
      `, [
        auction.id, auction.contract_address, auction.creator_para_id,
        auction.creator_wallet, auction.title, auction.description,
        auction.metadata_ipfs, auction.twitter_id, auction.seller_name,
        auction.profile_picture, auction.event_date, auction.event_start_time,
        auction.event_end_time, auction.bid_price, auction.duration_blocks,
        auction.end_block, auction.highest_bid, auction.highest_bidder,
        auction.blocks_remaining, auction.time_remaining_seconds,
        auction.meeting_duration, auction.nft_token_id, auction.jitsi_room_id,
        auction.auto_ended, auction.ended, auction.created_at, auction.updated_at
      ]);
    }
    console.log(`✅ Synced ${auctions.rows.length} auctions`);
    console.log('');

    // Sync meetings
    console.log('📅 Syncing meetings...');
    const meetings = await remotePool.query('SELECT * FROM meetings ORDER BY id');
    
    for (const meeting of meetings.rows) {
      await localPool.query(`
        INSERT INTO meetings (
          id, auction_id, jitsi_room_id, jitsi_room_config,
          creator_access_token, winner_access_token, room_url,
          scheduled_at, expires_at, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          jitsi_room_config = EXCLUDED.jitsi_room_config,
          creator_access_token = EXCLUDED.creator_access_token,
          winner_access_token = EXCLUDED.winner_access_token
      `, [
        meeting.id, meeting.auction_id, meeting.jitsi_room_id,
        meeting.jitsi_room_config, meeting.creator_access_token,
        meeting.winner_access_token, meeting.room_url, meeting.scheduled_at,
        meeting.expires_at, meeting.created_at
      ]);
    }
    console.log(`✅ Synced ${meetings.rows.length} meetings`);
    console.log('');

    // Update sequences
    console.log('🔢 Updating sequences...');
    if (users.rows.length > 0) {
      const maxUserId = Math.max(...users.rows.map(u => u.id));
      await localPool.query(`SELECT setval('users_id_seq', $1, true)`, [maxUserId]);
    }
    if (meetings.rows.length > 0) {
      const maxMeetingId = Math.max(...meetings.rows.map(m => m.id));
      await localPool.query(`SELECT setval('meetings_id_seq', $1, true)`, [maxMeetingId]);
    }
    console.log('✅ Sequences updated');
    console.log('');

    console.log('🎉 DATABASE SYNC COMPLETED!');
    console.log('='.repeat(60));
    console.log(`📊 Summary:`);
    console.log(`   Users: ${users.rows.length}`);
    console.log(`   Auctions: ${auctions.rows.length}`);
    console.log(`   Meetings: ${meetings.rows.length}`);
    console.log('');
    console.log('✅ Local database is now ready to use!');

  } catch (error) {
    console.error('❌ Sync failed:', error);
    console.error(error.stack);
  } finally {
    await remotePool.end();
    await localPool.end();
  }
}

// Run sync
syncDatabase().catch(console.error);
