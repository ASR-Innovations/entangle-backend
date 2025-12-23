#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config();

const dbConfig = process.env.DATABASE_URL ? {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
} : {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
};

const pool = new Pool(dbConfig);

(async () => {
  try {
    // Check creator profiles
    const profilesResult = await pool.query(`
      SELECT
        wallet_address,
        twitter_username,
        twitter_id,
        twitter_followers_count,
        is_verified,
        created_at
      FROM creator_profiles
      ORDER BY created_at DESC;
    `);

    console.log('📊 CREATOR PROFILES:');
    console.log('='.repeat(80));
    console.log(`Found ${profilesResult.rows.length} creator profiles\n`);

    profilesResult.rows.forEach((profile, idx) => {
      console.log(`${idx + 1}. @${profile.twitter_username || 'N/A'}`);
      console.log(`   Wallet: ${profile.wallet_address}`);
      console.log(`   Followers: ${profile.twitter_followers_count || 0}`);
      console.log('');
    });

    // Check creator tokens with pools
    const tokensResult = await pool.query(`
      SELECT
        ct.contract_address,
        ct.symbol,
        ct.name,
        ct.current_price,
        ct.liquidity_pool_address,
        ct.total_liquidity,
        cp.wallet_address,
        cp.twitter_username
      FROM creator_tokens ct
      JOIN creator_profiles cp ON ct.creator_profile_id = cp.id
      ORDER BY ct.created_at DESC;
    `);

    console.log('\n💰 CREATOR TOKENS:');
    console.log('='.repeat(80));
    console.log(`Found ${tokensResult.rows.length} creator tokens\n`);

    let tokensWithPools = 0;

    tokensResult.rows.forEach((token, idx) => {
      const zeroAddress = '0x0000000000000000000000000000000000000000';
      const hasPool = token.liquidity_pool_address &&
                      token.liquidity_pool_address !== zeroAddress &&
                      token.liquidity_pool_address !== null;

      if (hasPool) tokensWithPools++;

      console.log(`${idx + 1}. ${token.symbol} - @${token.twitter_username || 'N/A'}`);
      console.log(`   Token: ${token.contract_address}`);
      console.log(`   Creator: ${token.wallet_address}`);
      console.log(`   Price: ${token.current_price || '0'}`);
      console.log(`   Pool: ${hasPool ? '✅ YES' : '❌ NO'}`);
      if (hasPool) {
        console.log(`   Pool Address: ${token.liquidity_pool_address}`);
        console.log(`   Liquidity: ${token.total_liquidity || '0'}`);
      }
      console.log('');
    });

    console.log('\n📈 SUMMARY:');
    console.log('='.repeat(80));
    console.log(`Total Profiles: ${profilesResult.rows.length}`);
    console.log(`Total Tokens: ${tokensResult.rows.length}`);
    console.log(`Tokens with Pools: ${tokensWithPools}`);
    console.log(`Tokens without Pools: ${tokensResult.rows.length - tokensWithPools}`);

    // Check what the trending API returns
    console.log('\n\n🔍 TESTING TRENDING API QUERY:');
    console.log('='.repeat(80));

    const trendingQuery = `
      SELECT
        cp.wallet_address as id,
        cp.twitter_username as username,
        COALESCE(cp.twitter_username, 'Unknown') as name,
        cp.profile_image as avatar,
        cp.twitter_verified as verified,
        COALESCE(cp.bio, '') as bio,
        ct.contract_address as token_address,
        ct.symbol as token_symbol,
        ct.name as token_name,
        ct.current_price as token_price,
        ct.liquidity_pool_address,
        ct.total_liquidity
      FROM creator_profiles cp
      LEFT JOIN creator_tokens ct ON ct.creator_profile_id = cp.id
      WHERE ct.liquidity_pool_address IS NOT NULL
        AND ct.liquidity_pool_address != '0x0000000000000000000000000000000000000000'
      ORDER BY cp.twitter_followers_count DESC
      LIMIT 10;
    `;

    const trendingResult = await pool.query(trendingQuery);

    console.log(`Trending query returned: ${trendingResult.rows.length} creators\n`);

    trendingResult.rows.forEach((creator, idx) => {
      console.log(`${idx + 1}. @${creator.username}`);
      console.log(`   Token: ${creator.token_symbol} (${creator.token_address})`);
      console.log(`   Price: ${creator.token_price}`);
      console.log(`   Pool: ${creator.liquidity_pool_address}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
})();
