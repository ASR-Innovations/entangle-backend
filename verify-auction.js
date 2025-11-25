const { ethers } = require('ethers');
const { pool } = require('./src/config/database');

// Configuration
const provider = new ethers.JsonRpcProvider('https://sepolia-rollup.arbitrum.io/rpc');
const contractAddress = '0xD1629AAAA65548e367a6FEB07D8eC3aF3E6eD12d'; // NEW contract - Clean bytecode v3

// Minimal ABI for getAuction
const abi = [
  "function getAuction(uint256 _auctionId) view returns (tuple(uint256 id, address host, uint256 endBlock, uint256 reservePrice, uint256 highestBid, address highestBidder, string metadataIPFS, string hostTwitterId, bool ended, bool meetingScheduled, uint256 duration, uint256 nftTokenId, string sellerName, string eventName, uint256 eventDate, uint256 eventStartTime, uint256 eventEndTime, string profilePicture))"
];

const contract = new ethers.Contract(contractAddress, abi, provider);

async function verifyAuction(auctionId) {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  AUCTION VERIFICATION');
  console.log('  New Contract: 0xD1629AAAA65548e367a6FEB07D8eC3aF3E6eD12d');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    // 1. Get current block
    const currentBlock = await provider.getBlockNumber();
    console.log('📊 Current Blockchain State:');
    console.log('   Current Block:', currentBlock.toLocaleString());
    console.log('');

    // 2. Get auction from blockchain
    console.log('🔗 Fetching Auction from Blockchain...');
    const auction = await contract.getAuction(auctionId);

    const endBlock = Number(auction.endBlock);
    const blocksRemaining = endBlock - currentBlock;
    const timeRemainingSeconds = Math.floor(blocksRemaining * 0.25);
    const timeRemainingMinutes = Math.floor(timeRemainingSeconds / 60);

    console.log('   Auction ID:', auction.id.toString());
    console.log('   Host:', auction.host);
    console.log('   Event Name:', auction.eventName);
    console.log('   Seller Name:', auction.sellerName);
    console.log('   End Block:', endBlock.toLocaleString());
    console.log('   Duration (meeting mins):', auction.duration.toString());
    console.log('   Ended:', auction.ended);
    console.log('');

    console.log('⏱️  Timing Calculation:');
    console.log('   Current Block:', currentBlock.toLocaleString());
    console.log('   End Block:', endBlock.toLocaleString());
    console.log('   Blocks Remaining:', blocksRemaining.toLocaleString(), blocksRemaining > 0 ? '✅' : '❌');
    console.log('   Time Remaining:', timeRemainingMinutes, 'minutes', timeRemainingSeconds % 60, 'seconds');
    console.log('');

    // 3. Get auction from database
    console.log('💾 Fetching Auction from Database...');
    const dbResult = await pool.query(
      'SELECT id, end_block, blocks_remaining, time_remaining_seconds, ended, created_at FROM auctions WHERE id = $1',
      [auctionId]
    );

    if (dbResult.rows.length === 0) {
      console.log('   ❌ Auction not found in database!');
      return;
    }

    const dbAuction = dbResult.rows[0];
    console.log('   ID:', dbAuction.id);
    console.log('   End Block:', dbAuction.end_block.toLocaleString());
    console.log('   Blocks Remaining:', dbAuction.blocks_remaining.toLocaleString(), dbAuction.blocks_remaining > 0 ? '✅' : '❌');
    console.log('   Time Remaining:', Math.floor(dbAuction.time_remaining_seconds / 60), 'minutes', dbAuction.time_remaining_seconds % 60, 'seconds');
    console.log('   Ended:', dbAuction.ended);
    console.log('   Created At:', dbAuction.created_at);
    console.log('');

    // 4. Verification
    console.log('═══════════════════════════════════════════════════════');
    console.log('  VERIFICATION RESULTS');
    console.log('═══════════════════════════════════════════════════════\n');

    const checks = [];

    // Check 1: endBlock is reasonable (should be close to current + duration)
    const endBlockReasonable = endBlock > currentBlock && endBlock < currentBlock + 500000;
    checks.push({
      name: 'EndBlock is reasonable (future block)',
      status: endBlockReasonable,
      details: `${endBlock.toLocaleString()} should be > ${currentBlock.toLocaleString()}`
    });

    // Check 2: blocksRemaining is positive
    const blocksRemainingPositive = blocksRemaining > 0;
    checks.push({
      name: 'Blocks remaining is positive',
      status: blocksRemainingPositive,
      details: `${blocksRemaining.toLocaleString()} blocks remaining`
    });

    // Check 3: Database matches blockchain
    const dbMatchesBlockchain = Math.abs(dbAuction.end_block - endBlock) < 10;
    checks.push({
      name: 'Database endBlock matches blockchain',
      status: dbMatchesBlockchain,
      details: `DB: ${dbAuction.end_block.toLocaleString()}, Chain: ${endBlock.toLocaleString()}`
    });

    // Check 4: Database blocks remaining is positive
    const dbBlocksPositive = dbAuction.blocks_remaining > 0;
    checks.push({
      name: 'Database blocks_remaining is positive',
      status: dbBlocksPositive,
      details: `${dbAuction.blocks_remaining.toLocaleString()} blocks`
    });

    // Check 5: Auction not ended
    const notEnded = !auction.ended && !dbAuction.ended;
    checks.push({
      name: 'Auction is active (not ended)',
      status: notEnded,
      details: `Chain: ${auction.ended ? 'ended' : 'active'}, DB: ${dbAuction.ended ? 'ended' : 'active'}`
    });

    // Print results
    let allPassed = true;
    checks.forEach((check, index) => {
      const icon = check.status ? '✅' : '❌';
      console.log(`${index + 1}. ${icon} ${check.name}`);
      console.log(`   ${check.details}`);
      if (!check.status) allPassed = false;
    });

    console.log('');
    if (allPassed) {
      console.log('🎉 All checks passed! The auction is working correctly!');
    } else {
      console.log('❌ Some checks failed. Please review the issues above.');
    }

    console.log('\n═══════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error during verification:', error.message);
    if (error.code === 'CALL_EXCEPTION') {
      console.error('   This might mean the auction ID does not exist on the blockchain.');
    }
  } finally {
    await pool.end();
  }
}

// Get auction ID from command line or use default
const auctionId = process.argv[2] || 1;
console.log(`Verifying auction ID: ${auctionId}\n`);
verifyAuction(auctionId);
