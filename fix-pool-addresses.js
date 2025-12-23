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
const poolManagerAddress = process.env.CREATOR_POOL_MANAGER_ADDRESS;

// Tokens that have pools on-chain
const tokensWithPools = [
  '0x1856168f689523a4f8884331c86e227c07188948', // PRO
  '0x3489d49e1d83318072689706515bc0dba037e5d3', // ABHI
  '0x7d450acc7850d36cc75e81b7523e0b84312b4124', // SACHIN
  '0x3c3c9d9fc4b09a03ba8596cc35129a4bf1783dbf', // CAP10
  '0x72631fdcd7ebff9af8cfa59400c7e17f65925711'  // FUNDFLOW
];

(async () => {
  try {
    console.log('🔧 Manually updating pool addresses...');
    console.log(`Pool Manager: ${poolManagerAddress}\n`);

    for (const tokenAddress of tokensWithPools) {
      const result = await pool.query(`
        UPDATE creator_tokens
        SET liquidity_pool_address = $1,
            updated_at = NOW()
        WHERE contract_address = $2
      `, [poolManagerAddress, tokenAddress.toLowerCase()]);

      console.log(`✅ Updated ${tokenAddress}: ${result.rowCount} row(s)`);
    }

    console.log('\n📊 Checking results...\n');

    // Check how many tokens now have pools
    const checkResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM creator_tokens
      WHERE liquidity_pool_address IS NOT NULL
        AND liquidity_pool_address != '0x0000000000000000000000000000000000000000'
    `);

    console.log(`✅ Tokens with pools: ${checkResult.rows[0].count}`);

    // Test trending query
    const trendingResult = await pool.query(`
      SELECT
        cp.twitter_username,
        ct.symbol,
        ct.contract_address,
        ct.liquidity_pool_address
      FROM creator_profiles cp
      JOIN creator_tokens ct ON ct.creator_profile_id = cp.id
      WHERE ct.liquidity_pool_address IS NOT NULL
        AND ct.liquidity_pool_address != '0x0000000000000000000000000000000000000000'
      ORDER BY cp.twitter_followers_count DESC
      LIMIT 10
    `);

    console.log(`\n🔥 Trending creators (${trendingResult.rows.length}):\n`);
    trendingResult.rows.forEach((creator, idx) => {
      console.log(`${idx + 1}. ${creator.symbol} - @${creator.twitter_username || 'N/A'}`);
    });

    console.log('\n✅ Done! Pool addresses updated successfully.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
})();
