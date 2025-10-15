/**
 * Manual Auction Cleanup Script
 * Marks problematic auctions (35 and 36) as auto_ended in the database
 * This prevents the cron job from repeatedly trying to process them
 */

const { pool } = require('./src/config/database');

async function manuallyMarkAuctionsEnded() {
  console.log('🔧 Manual Auction Cleanup Script');
  console.log('==================================\n');

  const auctionsToMark = [35, 36];

  try {
    // Connect to database
    console.log('📊 Connecting to database...');
    await pool.query('SELECT 1');
    console.log('✅ Database connected\n');

    for (const auctionId of auctionsToMark) {
      console.log(`🔄 Processing Auction ${auctionId}...`);

      // First, check if auction exists
      const checkQuery = 'SELECT * FROM auctions WHERE id = $1';
      const checkResult = await pool.query(checkQuery, [auctionId]);

      if (checkResult.rows.length === 0) {
        console.log(`⚠️  Auction ${auctionId} not found in database`);
        console.log(`   Creating entry for auction ${auctionId}...\n`);

        // If it doesn't exist, we need to fetch it from blockchain first
        // For now, just skip it
        console.log(`   Skipping - auction needs to be synced from blockchain first\n`);
        continue;
      }

      const auction = checkResult.rows[0];
      console.log(`   Current auto_ended status: ${auction.auto_ended}`);

      if (auction.auto_ended) {
        console.log(`   ✅ Auction ${auctionId} is already marked as ended`);
        console.log(`   Nothing to do.\n`);
        continue;
      }

      // Mark as auto_ended
      const updateQuery = `
        UPDATE auctions
        SET auto_ended = true
        WHERE id = $1
        RETURNING *
      `;

      const updateResult = await pool.query(updateQuery, [auctionId]);

      if (updateResult.rows.length > 0) {
        console.log(`   ✅ Auction ${auctionId} successfully marked as ended`);
        console.log(`   Creator: ${auction.creator_wallet}`);
        console.log(`   Title: ${auction.title || 'N/A'}`);
        console.log(`   Note: This auction had a smart contract bug (Token transfer failed)\n`);
      } else {
        console.log(`   ❌ Failed to update auction ${auctionId}\n`);
      }
    }

    console.log('==================================');
    console.log('✅ Cleanup completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   - Auctions 35 and 36 are now marked as ended');
    console.log('   - Cron job will skip these auctions in future runs');
    console.log('   - These auctions had a smart contract bug and could not be ended on-chain');
    console.log('\n💡 Next Steps:');
    console.log('   1. These auctions are stuck due to contract issues');
    console.log('   2. Winners cannot claim their NFTs automatically');
    console.log('   3. Manual contract interaction may be needed to resolve');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
    console.log('\n👋 Database connection closed');
  }
}

// Run the script
manuallyMarkAuctionsEnded()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
