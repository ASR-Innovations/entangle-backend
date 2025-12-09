const { ethers } = require('ethers');
const { getContractService } = require('./src/services/ContractService');

async function testCronUpdateFields() {
  console.log('🔍 Testing Cron Job Update Fields...\n');
  console.log('='.repeat(80));

  try {
    const contractService = getContractService();
    await contractService.initialize();

    const auctionId = 77;
    const auction = await contractService.contract.getAuction(auctionId);
    const currentBlock = await contractService.provider.getBlockNumber();

    const endBlock = Number(auction.endBlock);
    const blocksRemaining = Math.max(0, endBlock - currentBlock);
    const timeRemainingSeconds = blocksRemaining * 12; // Ethereum Sepolia: 12 seconds/block

    console.log('WHAT THE CRON JOB WILL UPDATE IN DATABASE EVERY 2 MINUTES');
    console.log('='.repeat(80));
    console.log('');

    console.log('📊 For Auction #77:');
    console.log('');

    const updates = [
      {
        field: 'highest_bid',
        current: 'Unknown (in DB)',
        newValue: auction.highestBid.toString(),
        formatted: `${ethers.formatEther(auction.highestBid)} AVAX`,
        source: 'FROM BLOCKCHAIN ⛓️',
        changes: '✅ Updates when someone bids'
      },
      {
        field: 'highest_bidder',
        current: 'Unknown (in DB)',
        newValue: auction.highestBidder,
        formatted: auction.highestBidder.slice(0, 20) + '...',
        source: 'FROM BLOCKCHAIN ⛓️',
        changes: '✅ Updates when someone bids'
      },
      {
        field: 'end_block',
        current: 'Unknown (in DB)',
        newValue: endBlock.toString(),
        formatted: endBlock.toString(),
        source: 'FROM BLOCKCHAIN ⛓️',
        changes: '✅ Can change with anti-snipe extension'
      },
      {
        field: 'blocks_remaining',
        current: 'Unknown (in DB)',
        newValue: blocksRemaining.toString(),
        formatted: `${blocksRemaining} blocks`,
        source: 'CALCULATED 🧮',
        changes: '✅ Decreases every 2 seconds'
      },
      {
        field: 'time_remaining_seconds',
        current: 'Unknown (in DB)',
        newValue: timeRemainingSeconds.toString(),
        formatted: `${Math.floor(timeRemainingSeconds / 60)} minutes`,
        source: 'CALCULATED 🧮',
        changes: '✅ Decreases every 2 minutes'
      },
      {
        field: 'ended',
        current: 'Unknown (in DB)',
        newValue: auction.ended.toString(),
        formatted: auction.ended ? 'YES' : 'NO',
        source: 'FROM BLOCKCHAIN ⛓️',
        changes: '✅ Changes to true when auction ends'
      },
      {
        field: 'bid_price',
        current: 'Unknown (in DB)',
        newValue: auction.reservePrice.toString(),
        formatted: `${ethers.formatEther(auction.reservePrice)} AVAX`,
        source: 'FROM BLOCKCHAIN ⛓️',
        changes: '⚠️ Stays same (reserve price)'
      },
      {
        field: 'seller_name',
        current: 'Unknown (in DB)',
        newValue: auction.sellerName || 'null',
        formatted: auction.sellerName || 'N/A',
        source: 'FROM BLOCKCHAIN ⛓️',
        changes: '⚠️ Usually stays same'
      },
      {
        field: 'profile_picture',
        current: 'Unknown (in DB)',
        newValue: auction.profilePicture ? auction.profilePicture.slice(0, 30) + '...' : 'null',
        formatted: auction.profilePicture ? 'URL present' : 'N/A',
        source: 'FROM BLOCKCHAIN ⛓️',
        changes: '⚠️ Usually stays same'
      },
      {
        field: 'event_date',
        current: 'Unknown (in DB)',
        newValue: auction.eventDate && Number(auction.eventDate) > 0
          ? new Date(Number(auction.eventDate) * 1000).toISOString()
          : 'null',
        formatted: auction.eventDate && Number(auction.eventDate) > 0
          ? new Date(Number(auction.eventDate) * 1000).toISOString().split('T')[0]
          : 'N/A',
        source: 'FROM BLOCKCHAIN ⛓️',
        changes: '⚠️ Usually stays same'
      },
      {
        field: 'event_start_time',
        current: 'Unknown (in DB)',
        newValue: auction.eventStartTime && Number(auction.eventStartTime) > 0
          ? new Date(Number(auction.eventStartTime) * 1000).toISOString()
          : 'null',
        formatted: auction.eventStartTime && Number(auction.eventStartTime) > 0
          ? new Date(Number(auction.eventStartTime) * 1000).toLocaleString()
          : 'N/A',
        source: 'FROM BLOCKCHAIN ⛓️',
        changes: '⚠️ Usually stays same'
      },
      {
        field: 'event_end_time',
        current: 'Unknown (in DB)',
        newValue: auction.eventEndTime && Number(auction.eventEndTime) > 0
          ? new Date(Number(auction.eventEndTime) * 1000).toISOString()
          : 'null',
        formatted: auction.eventEndTime && Number(auction.eventEndTime) > 0
          ? new Date(Number(auction.eventEndTime) * 1000).toLocaleString()
          : 'N/A',
        source: 'FROM BLOCKCHAIN ⛓️',
        changes: '⚠️ Usually stays same'
      },
      {
        field: 'updated_at',
        current: 'Unknown (in DB)',
        newValue: 'CURRENT_TIMESTAMP',
        formatted: new Date().toISOString(),
        source: 'AUTO TIMESTAMP ⏰',
        changes: '✅ Updates every cron run'
      }
    ];

    console.table(updates.map(u => ({
      'Field': u.field,
      'New Value': u.formatted,
      'Source': u.source,
      'Updates?': u.changes
    })));

    console.log('');
    console.log('='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log('');
    console.log('✅ FIELDS THAT CHANGE WITH TIME (Updated every 2 min):');
    console.log('   1. highest_bid - When someone places a new bid');
    console.log('   2. highest_bidder - When someone places a new bid');
    console.log('   3. end_block - If anti-snipe extends auction');
    console.log('   4. blocks_remaining - Decreases as blocks pass');
    console.log('   5. time_remaining_seconds - Decreases as time passes');
    console.log('   6. ended - Changes to true when auction ends');
    console.log('   7. updated_at - Always updated');
    console.log('');
    console.log('⚠️  FIELDS THAT USUALLY STAY SAME (But synced anyway):');
    console.log('   8. bid_price (reserve price)');
    console.log('   9. seller_name');
    console.log('   10. profile_picture');
    console.log('   11. event_date');
    console.log('   12. event_start_time');
    console.log('   13. event_end_time');
    console.log('');
    console.log('📊 TOTAL: 13 fields updated from blockchain every 2 minutes');
    console.log('');
    console.log('🔄 This ensures frontend always shows LIVE data!');
    console.log('');
    console.log('='.repeat(80));

    console.log('');
    console.log('SQL QUERY THAT WILL RUN:');
    console.log('='.repeat(80));
    console.log(`
UPDATE auctions
SET
  highest_bid = '${auction.highestBid.toString()}',
  highest_bidder = '${auction.highestBidder}',
  end_block = ${endBlock},
  blocks_remaining = ${blocksRemaining},
  time_remaining_seconds = ${timeRemainingSeconds},
  ended = ${auction.ended},
  bid_price = '${auction.reservePrice.toString()}',
  seller_name = '${auction.sellerName || 'NULL'}',
  profile_picture = '${auction.profilePicture ? auction.profilePicture.slice(0, 50) + '...' : 'NULL'}',
  event_date = '${auction.eventDate && Number(auction.eventDate) > 0 ? new Date(Number(auction.eventDate) * 1000).toISOString() : 'NULL'}',
  event_start_time = '${auction.eventStartTime && Number(auction.eventStartTime) > 0 ? new Date(Number(auction.eventStartTime) * 1000).toISOString() : 'NULL'}',
  event_end_time = '${auction.eventEndTime && Number(auction.eventEndTime) > 0 ? new Date(Number(auction.eventEndTime) * 1000).toISOString() : 'NULL'}',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 77;
    `);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testCronUpdateFields().then(() => process.exit(0));
