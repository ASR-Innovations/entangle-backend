const { ethers } = require('ethers');
const { Pool } = require('pg');
const MeetingAuctionABI = require('./src/contracts/MeetingAuction.json');

/**
 * Sync all auctions from blockchain to REMOTE database
 * This script connects directly to the remote database
 */

// Remote database connection
const remotePool = new Pool({
  connectionString: 'postgresql://entangle_user:entangle_secure_2024@209.38.123.139:5432/entangle_meetings',
  ssl: false
});

async function syncAllAuctions() {
  console.log('🔄 STARTING FULL AUCTION SYNC FROM BLOCKCHAIN TO REMOTE DATABASE');
  console.log('='.repeat(70));
  console.log('');

  try {
    // Initialize blockchain connection
    console.log('📡 Initializing blockchain connection...');
    const rpcUrl = 'https://api.avax-test.network/ext/bc/C/rpc';
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contractAddress = '0x6fD65aE833C9679cBC571581CE0f5Cd73D565796';
    const contract = new ethers.Contract(contractAddress, MeetingAuctionABI, provider);
    
    console.log('✅ Connected to blockchain');
    console.log(`📝 Contract: ${contractAddress}`);
    console.log('');

    // Test database connection
    console.log('💾 Testing remote database connection...');
    const testResult = await remotePool.query('SELECT NOW()');
    console.log('✅ Connected to remote database');
    console.log('');

    // Get current block
    const currentBlock = await provider.getBlockNumber();
    console.log(`📦 Current Block: ${currentBlock}`);
    console.log('');

    // Get all auctions from remote database
    console.log('💾 Fetching all auctions from remote database...');
    const result = await remotePool.query('SELECT id FROM auctions ORDER BY id ASC');
    const auctionIds = result.rows.map(row => row.id);
    
    console.log(`📊 Found ${auctionIds.length} auctions in remote database`);
    console.log(`📋 Auction IDs: ${auctionIds.slice(0, 10).join(', ')}${auctionIds.length > 10 ? '...' : ''}`);
    console.log('');

    if (auctionIds.length === 0) {
      console.log('⚠️  No auctions found in database. Nothing to sync.');
      return;
    }

    // Sync each auction
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    console.log('🔄 Starting sync process...');
    console.log('-'.repeat(70));
    console.log('');

    for (let i = 0; i < auctionIds.length; i++) {
      const auctionId = auctionIds[i];
      const progress = `[${i + 1}/${auctionIds.length}]`;

      try {
        console.log(`${progress} 🔍 Syncing Auction #${auctionId}...`);

        // Fetch auction data from blockchain
        const auction = await contract.getAuction(auctionId);

        // Check if auction exists on blockchain
        if (!auction || auction.host === ethers.ZeroAddress) {
          console.log(`${progress} ⚠️  Auction #${auctionId} not found on blockchain, skipping...`);
          skippedCount++;
          continue;
        }

        // Calculate time remaining
        const endBlock = Number(auction.endBlock);
        const blocksRemaining = Math.max(0, endBlock - currentBlock);
        const timeRemainingSeconds = blocksRemaining * 2; // Avalanche: ~2 sec/block

        // Prepare update data
        const updateData = {
          bid_price: auction.reservePrice.toString(),
          highest_bid: auction.highestBid.toString(),
          highest_bidder: auction.highestBidder,
          end_block: endBlock,
          blocks_remaining: blocksRemaining,
          time_remaining_seconds: timeRemainingSeconds,
          ended: auction.ended,
          nft_token_id: auction.nftTokenId && Number(auction.nftTokenId) > 0 ? Number(auction.nftTokenId) : null,
          seller_name: auction.sellerName || null,
          profile_picture: auction.profilePicture || null,
          event_date: auction.eventDate && Number(auction.eventDate) > 0 
            ? new Date(Number(auction.eventDate) * 1000).toISOString() 
            : null,
          event_start_time: auction.eventStartTime && Number(auction.eventStartTime) > 0 
            ? new Date(Number(auction.eventStartTime) * 1000).toISOString() 
            : null,
          event_end_time: auction.eventEndTime && Number(auction.eventEndTime) > 0 
            ? new Date(Number(auction.eventEndTime) * 1000).toISOString() 
            : null,
        };

        // Update remote database
        await remotePool.query(`
          UPDATE auctions
          SET
            bid_price = $1,
            highest_bid = $2,
            highest_bidder = $3,
            end_block = $4,
            blocks_remaining = $5,
            time_remaining_seconds = $6,
            ended = $7,
            nft_token_id = $8,
            seller_name = $9,
            profile_picture = $10,
            event_date = $11,
            event_start_time = $12,
            event_end_time = $13,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $14
        `, [
          updateData.bid_price,
          updateData.highest_bid,
          updateData.highest_bidder,
          updateData.end_block,
          updateData.blocks_remaining,
          updateData.time_remaining_seconds,
          updateData.ended,
          updateData.nft_token_id,
          updateData.seller_name,
          updateData.profile_picture,
          updateData.event_date,
          updateData.event_start_time,
          updateData.event_end_time,
          auctionId
        ]);

        // Log details
        const hasHighestBid = auction.highestBidder !== ethers.ZeroAddress;
        const statusIcon = auction.ended ? '🏁' : (hasHighestBid ? '🔥' : '📡');
        const status = auction.ended ? 'ENDED' : (hasHighestBid ? 'HOT' : 'LIVE');
        
        console.log(`${progress} ${statusIcon} Auction #${auctionId}: ${status}`);
        console.log(`       Seller: ${updateData.seller_name || 'N/A'}`);
        console.log(`       Floor Price: ${ethers.formatEther(auction.reservePrice)} AVAX`);
        
        if (hasHighestBid) {
          console.log(`       Highest Bid: ${ethers.formatEther(auction.highestBid)} AVAX`);
          console.log(`       Bidder: ${auction.highestBidder.slice(0, 10)}...`);
        }
        
        if (auction.ended) {
          console.log(`       Status: Ended`);
          if (updateData.nft_token_id) {
            console.log(`       NFT Token ID: ${updateData.nft_token_id}`);
          }
        } else {
          console.log(`       Blocks Remaining: ${blocksRemaining}`);
          console.log(`       Time Remaining: ${Math.floor(timeRemainingSeconds / 60)} minutes`);
        }
        
        console.log(`${progress} ✅ Synced successfully`);
        console.log('');
        
        successCount++;

        // Small delay to avoid rate limiting
        if (i < auctionIds.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (error) {
        console.log(`${progress} ❌ Error syncing Auction #${auctionId}:`, error.message);
        console.log('');
        errorCount++;
      }
    }

    // Summary
    console.log('');
    console.log('='.repeat(70));
    console.log('📊 SYNC SUMMARY');
    console.log('='.repeat(70));
    console.log(`✅ Successfully synced: ${successCount} auctions`);
    console.log(`❌ Errors: ${errorCount} auctions`);
    console.log(`⚠️  Skipped: ${skippedCount} auctions`);
    console.log(`📦 Total processed: ${auctionIds.length} auctions`);
    console.log('='.repeat(70));
    console.log('');

    if (successCount > 0) {
      console.log('🎉 Sync completed successfully!');
      console.log('💡 All auction data has been updated from the blockchain.');
      console.log('');
      console.log('Next steps:');
      console.log('1. ✅ Remote database is now in sync with blockchain');
      console.log('2. ✅ Cron job will keep it updated every 10 seconds');
      console.log('3. ✅ Frontend can now use the database endpoints');
    }

  } catch (error) {
    console.error('');
    console.error('❌ FATAL ERROR:', error.message);
    console.error('');
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  } finally {
    // Close database connection
    await remotePool.end();
  }
}

// Run the sync
console.log('');
console.log('╔════════════════════════════════════════════════════════════════════╗');
console.log('║      BLOCKCHAIN TO REMOTE DATABASE SYNC SCRIPT                     ║');
console.log('║      Syncing all auction data from blockchain                      ║');
console.log('║      Target: 209.38.123.139:5432/entangle_meetings                 ║');
console.log('╚════════════════════════════════════════════════════════════════════╝');
console.log('');

syncAllAuctions()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Script failed:', err);
    process.exit(1);
  });
