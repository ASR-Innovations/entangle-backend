/**
 * Test Creator API Endpoints
 * Tests all newly implemented creator endpoints
 */

const axios = require('axios');
const { Pool } = require('pg');
require('dotenv').config();

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : {
    rejectUnauthorized: false
  }
});

// Test data
const testCreator = {
  walletAddress: '0x742d35cc6634c0532925a3b844bc9e7595f0beb7',
  twitterUsername: 'elonmusk',
  twitterId: '44196397',
  displayName: 'Elon Musk',
  bio: 'Technoking of Tesla',
  profileImage: 'https://pbs.twimg.com/profile_images/1683325380441128960/yRsRRjGO_400x400.jpg',
  twitterFollowers: 150000000
};

const testToken = {
  contractAddress: '0x1234567890123456789012345678901234567890',
  symbol: 'ELON',
  name: 'Elon Token',
  decimals: 18,
  totalSupply: '1000000000',
  currentPrice: 0.0543,
  priceChange24h: 8.2,
  volume24h: 125000.00,
  marketCap: 54300000.00,
  liquidityPool: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
};

async function setupTestData() {
  console.log('📝 Setting up test data...\n');

  try {
    // First, ensure user exists
    const userResult = await pool.query(`
      INSERT INTO users (para_user_id, wallet_address, display_name, auth_type)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (wallet_address) DO UPDATE SET display_name = EXCLUDED.display_name
      RETURNING id
    `, [
      `para_${testCreator.twitterUsername}`,
      testCreator.walletAddress,
      testCreator.displayName,
      'wallet'
    ]);

    const userId = userResult.rows[0].id;

    // Create creator profile
    const profileResult = await pool.query(`
      INSERT INTO creator_profiles (
        user_id,
        para_user_id,
        wallet_address,
        twitter_username,
        twitter_id,
        bio,
        profile_image,
        twitter_followers_count,
        twitter_verified,
        is_verified,
        total_events_created
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (user_id) 
      DO UPDATE SET
        twitter_username = EXCLUDED.twitter_username,
        twitter_id = EXCLUDED.twitter_id,
        bio = EXCLUDED.bio,
        profile_image = EXCLUDED.profile_image,
        twitter_followers_count = EXCLUDED.twitter_followers_count
      RETURNING id
    `, [
      userId,
      `para_${testCreator.twitterUsername}`,
      testCreator.walletAddress,
      testCreator.twitterUsername,
      testCreator.twitterId,
      testCreator.bio,
      testCreator.profileImage,
      testCreator.twitterFollowers,
      true,
      true,
      5
    ]);

    const creatorProfileId = profileResult.rows[0].id;
    console.log(`✅ Created creator profile (ID: ${creatorProfileId})`);

    // Create token
    await pool.query(`
      INSERT INTO creator_tokens (
        creator_profile_id,
        contract_address,
        symbol,
        name,
        decimals,
        total_supply,
        current_price,
        price_change_24h,
        volume_24h,
        market_cap,
        liquidity_pool_address,
        total_transactions,
        unique_traders,
        buy_count_24h,
        sell_count_24h
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (contract_address)
      DO UPDATE SET
        current_price = EXCLUDED.current_price,
        price_change_24h = EXCLUDED.price_change_24h,
        volume_24h = EXCLUDED.volume_24h,
        market_cap = EXCLUDED.market_cap
      RETURNING id
    `, [
      creatorProfileId,
      testToken.contractAddress,
      testToken.symbol,
      testToken.name,
      testToken.decimals,
      testToken.totalSupply,
      testToken.currentPrice,
      testToken.priceChange24h,
      testToken.volume24h,
      testToken.marketCap,
      testToken.liquidityPool,
      5420,
      1250,
      198,
      144
    ]);

    const tokenResult = await pool.query(
      'SELECT id FROM creator_tokens WHERE contract_address = $1',
      [testToken.contractAddress]
    );
    const tokenId = tokenResult.rows[0].id;
    console.log(`✅ Created token (ID: ${tokenId})`);

    // Create price history
    const now = Math.floor(Date.now() / 1000);
    const priceHistory = [];
    
    for (let i = 23; i >= 0; i--) {
      const timestamp = now - (i * 3600);
      const basePrice = 0.0543;
      const variance = (Math.random() - 0.5) * 0.01;
      
      priceHistory.push({
        timestamp,
        open: basePrice + variance,
        high: basePrice + variance + Math.random() * 0.005,
        low: basePrice + variance - Math.random() * 0.005,
        close: basePrice + variance + (Math.random() - 0.5) * 0.003,
        volume: 5000 + Math.random() * 2000
      });
    }

    for (const price of priceHistory) {
      await pool.query(`
        INSERT INTO token_price_history (
          token_id, timestamp, open_price, high_price, low_price, close_price, volume, interval_type
        ) VALUES ($1, to_timestamp($2), $3, $4, $5, $6, $7, $8)
        ON CONFLICT DO NOTHING
      `, [tokenId, price.timestamp, price.open.toString(), price.high.toString(), price.low.toString(), price.close.toString(), price.volume.toString(), '1h']);
    }

    console.log(`✅ Created ${priceHistory.length} price history entries`);

    // Create token holders
    const holders = [
      { address: '0xabcd1111111111111111111111111111111111ab', balance: '50000000', percentage: 5.0 },
      { address: '0xabcd2222222222222222222222222222222222ab', balance: '30000000', percentage: 3.0 },
      { address: '0xabcd3333333333333333333333333333333333ab', balance: '20000000', percentage: 2.0 },
      { address: '0xabcd4444444444444444444444444444444444ab', balance: '15000000', percentage: 1.5 },
      { address: '0xabcd5555555555555555555555555555555555ab', balance: '10000000', percentage: 1.0 }
    ];

    for (const holder of holders) {
      await pool.query(`
        INSERT INTO token_holders (
          token_id, holder_address, balance, percentage_of_supply, is_whale,
          first_acquired_at, last_transaction_at, total_transactions
        ) VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL '30 days', NOW() - INTERVAL '1 day', $6)
        ON CONFLICT (token_id, holder_address) DO NOTHING
      `, [tokenId, holder.address, holder.balance, holder.percentage, holder.percentage >= 5.0, Math.floor(Math.random() * 50) + 10]);
    }

    console.log(`✅ Created ${holders.length} token holders`);

    // Create transactions
    const transactions = [
      { type: 'buy', trader: '0xbuyer1111111111111111111111111111111111', amount: '1000', payment: '54.30', price: 0.0543 },
      { type: 'sell', trader: '0xseller111111111111111111111111111111111', amount: '500', payment: '27.15', price: 0.0543 },
      { type: 'buy', trader: '0xbuyer2222222222222222222222222222222222', amount: '2000', payment: '108.60', price: 0.0543 },
      { type: 'transfer', trader: '0xtransfer11111111111111111111111111111111', amount: '100', payment: '0', price: 0 }
    ];

    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];
      const fromAddr = tx.type === 'buy' ? tx.trader : testToken.contractAddress;
      const toAddr = tx.type === 'sell' ? tx.trader : testToken.contractAddress;
      
      await pool.query(`
        INSERT INTO token_transactions (
          token_id, transaction_hash, transaction_type, trader_address,
          from_address, to_address,
          token_amount, payment_amount, payment_token, price_per_token,
          usd_value, dex_name, block_number, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (transaction_hash) DO NOTHING
      `, [
        tokenId,
        `0x${i.toString().padStart(64, '0')}`,
        tx.type,
        tx.trader,
        fromAddr,
        toAddr,
        tx.amount,
        tx.payment,
        'USDC',
        tx.price,
        tx.payment,
        'uniswap',
        12345678 + i,
        new Date(Date.now() - i * 3600000)
      ]);
    }

    console.log(`✅ Created ${transactions.length} transactions`);

    // Create Telegram room
    await pool.query(`
      INSERT INTO telegram_rooms (
        creator_profile_id, room_id, room_name, price_per_minute,
        currency, active_members, total_members, total_messages, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (room_id) DO NOTHING
    `, [
      creatorProfileId,
      'telegram_room_elon',
      "Elon's Inner Circle",
      1.00,
      'USDC',
      42,
      156,
      2450,
      true
    ]);

    console.log(`✅ Created Telegram room`);

    console.log('\n✅ Test data setup complete!\n');

  } catch (error) {
    console.error('❌ Error setting up test data:', error);
    throw error;
  }
}

async function testEndpoints() {
  console.log('🧪 Testing Creator API Endpoints\n');
  console.log('='.repeat(60));

  try {
    // Test 1: Get token info by wallet address
    console.log('\n1️⃣  Testing GET /api/creators/:address/token');
    console.log('-'.repeat(60));
    
    const tokenResponse = await axios.get(
      `${BASE_URL}/api/creators/${testCreator.walletAddress}/token`
    );
    
    console.log('✅ Status:', tokenResponse.status);
    console.log('📊 Token Info:');
    console.log('   Symbol:', tokenResponse.data.data.symbol);
    console.log('   Price:', tokenResponse.data.data.currentPrice);
    console.log('   Market Cap:', tokenResponse.data.data.marketCap);
    console.log('   Holders:', tokenResponse.data.data.holders);

    // Test 2: Get token info by username
    console.log('\n2️⃣  Testing GET /api/creators/:username/token');
    console.log('-'.repeat(60));
    
    const tokenByUsernameResponse = await axios.get(
      `${BASE_URL}/api/creators/${testCreator.twitterUsername}/token`
    );
    
    console.log('✅ Status:', tokenByUsernameResponse.status);
    console.log('📊 Token Info (by username):');
    console.log('   Symbol:', tokenByUsernameResponse.data.data.symbol);
    console.log('   Price:', tokenByUsernameResponse.data.data.currentPrice);

    // Test 3: Get price history
    console.log('\n3️⃣  Testing GET /api/creators/:identifier/token/price-history');
    console.log('-'.repeat(60));
    
    const priceHistoryResponse = await axios.get(
      `${BASE_URL}/api/creators/${testCreator.walletAddress}/token/price-history?interval=1h&limit=24`
    );
    
    console.log('✅ Status:', priceHistoryResponse.status);
    console.log('📈 Price History:');
    console.log('   Data Points:', priceHistoryResponse.data.data.priceHistory.length);
    console.log('   Current Price:', priceHistoryResponse.data.data.currentPrice);
    console.log('   24h Change:', priceHistoryResponse.data.data.priceChangePercent);
    if (priceHistoryResponse.data.data.priceHistory.length > 0) {
      const latest = priceHistoryResponse.data.data.priceHistory[0];
      console.log('   Latest OHLC:', {
        open: latest.open,
        high: latest.high,
        low: latest.low,
        close: latest.close
      });
    }

    // Test 4: Get token holders
    console.log('\n4️⃣  Testing GET /api/creators/:identifier/token/holders');
    console.log('-'.repeat(60));
    
    const holdersResponse = await axios.get(
      `${BASE_URL}/api/creators/${testCreator.walletAddress}/token/holders?limit=5`
    );
    
    console.log('✅ Status:', holdersResponse.status);
    console.log('👥 Token Holders:');
    console.log('   Total Holders:', holdersResponse.data.meta.totalHolders);
    console.log('   Top Holders:');
    holdersResponse.data.data.forEach(holder => {
      console.log(`     ${holder.rank}. ${holder.address.slice(0, 10)}... - ${holder.balanceFormatted} (${holder.percentageFormatted})${holder.isWhale ? ' 🐋' : ''}`);
    });

    // Test 5: Get transactions
    console.log('\n5️⃣  Testing GET /api/creators/:identifier/token/transactions');
    console.log('-'.repeat(60));
    
    const transactionsResponse = await axios.get(
      `${BASE_URL}/api/creators/${testCreator.walletAddress}/token/transactions?limit=10`
    );
    
    console.log('✅ Status:', transactionsResponse.status);
    console.log('💸 Recent Transactions:');
    console.log('   Total:', transactionsResponse.data.meta.total);
    console.log('   Recent:');
    transactionsResponse.data.data.slice(0, 3).forEach(tx => {
      console.log(`     ${tx.type.toUpperCase()} - ${tx.tokenAmount} ${testToken.symbol} - ${tx.timeAgo}`);
    });

    // Test 6: Get Telegram room
    console.log('\n6️⃣  Testing GET /api/creators/:identifier/telegram');
    console.log('-'.repeat(60));
    
    const telegramResponse = await axios.get(
      `${BASE_URL}/api/creators/${testCreator.walletAddress}/telegram`
    );
    
    console.log('✅ Status:', telegramResponse.status);
    console.log('📱 Telegram Room:');
    console.log('   Name:', telegramResponse.data.data.roomName);
    console.log('   Price:', `$${telegramResponse.data.data.pricePerMinute}/min`);
    console.log('   Active Members:', telegramResponse.data.data.activeMembers);
    console.log('   Total Members:', telegramResponse.data.data.totalMembers);

    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests passed successfully!');
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

async function main() {
  try {
    console.log('🚀 Creator API Endpoint Testing\n');
    
    await setupTestData();
    await testEndpoints();

    console.log('🎉 All operations completed successfully!\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
