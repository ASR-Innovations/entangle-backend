#!/usr/bin/env node

/**
 * Sync all auctions from blockchain to local database
 */

require('dotenv').config();
const ethers = require('ethers');
const { pool } = require('./src/config/database');
const MeetingAuctionABI = require('./src/contracts/MeetingAuction.json');

async function syncFromBlockchain() {
  console.log('⛓️  SYNCING AUCTIONS FROM BLOCKCHAIN TO LOCAL DATABASE');
  console.log('='.repeat(60));
  console.log('');

  try {
    // Initialize blockchain connection
    const contractAddress = process.env.CONTRACT_ADDRESS || '0x6fD65aE833C9679cBC571581CE0f5Cd73D565796';
    const rpcUrl = process.env.RPC_URL || 'https://avax-fuji.g.alchemy.com/v2/Yo4enHB113igpnycl13On';
    
    console.log('📡 Connecting to blockchain...');
    console.log(`Contract: ${contractAddress}`);
    console.log(`RPC: ${rpcUrl}`);
    
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(contractAddress, MeetingAuctionABI, provider);
    
    const currentBlock = await provider.getBlockNumber();
    const network = await provider.getNetwork();
    console.log(`✅ Connected to ${network.name} (Chain ID: ${network.chainId})`);
    console.log(`✅ Current block: ${currentBlock}`);
    console.log('');
    
    // Get total auction count
    const auctionCounter = await contract.auctionCounter();
    const totalAuctions = Number(auctionCounter);
    console.log(`📊 Total auctions on blockchain: ${totalAuctions}`);
    console.log('');
    
    if (totalAuctions === 0) {
      console.log('⚠️  No auctions found on blockchain');
      return;
    }
    
    // Sync each auction
    console.log('🔄 Syncing auctions...');
    let syncedCount = 0;
    let skippedCount = 0;
    
    for (let auctionId = 1; auctionId <= totalAuctions; auctionId++) {
      try {
        process.stdout.write(`  Processing auction ${auctionId}/${totalAuctions}... `);
        
        // Fetch auction from blockchain
        const auction = await contract.getAuction(auctionId);
        
        // Calculate time remaining
        const endBlock = Number(auction.endBlock);
        const blocksRemaining = Math.max(0, endBlock - currentBlock);
        const timeRemainingSeconds = blocksRemaining * 12; // Ethereum Sepolia: 12 seconds/block
        
        // Insert or update in database
        await pool.query(`
          INSERT INTO auctions (
            id, contract_address, creator_para_id, creator_wallet,
            title, description, twitter_id, seller_name, profile_picture,
            event_date, event_start_time, event_end_time,
            bid_price, end_block, highest_bid, highest_bidder,
            blocks_remaining, time_remaining_seconds, meeting_duration,
            nft_token_id, auto_ended, ended, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
            $17, $18, $19, $20, $21, $22, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
          ON CONFLICT (id) DO UPDATE SET
            highest_bid = EXCLUDED.highest_bid,
            highest_bidder = EXCLUDED.highest_bidder,
            blocks_remaining = EXCLUDED.blocks_remaining,
            time_remaining_seconds = EXCLUDED.time_remaining_seconds,
            ended = EXCLUDED.ended,
            nft_token_id = EXCLUDED.nft_token_id,
            updated_at = CURRENT_TIMESTAMP
        `, [
          auctionId,
          contractAddress,
          `blockchain-${auction.host}`, // Para ID placeholder
          auction.host.toLowerCase(),
          `Auction ${auctionId}`, // Title placeholder
          '', // Description placeholder
          auction.hostTwitterId || '',
          auction.sellerName || '',
          auction.profilePicture || '',
          auction.eventDate && Number(auction.eventDate) > 0
            ? new Date(Number(auction.eventDate) * 1000)
            : null,
          auction.eventStartTime && Number(auction.eventStartTime) > 0
            ? new Date(Number(auction.eventStartTime) * 1000)
            : null,
          auction.eventEndTime && Number(auction.eventEndTime) > 0
            ? new Date(Number(auction.eventEndTime) * 1000)
            : null,
          auction.reservePrice.toString(),
          endBlock,
          auction.highestBid.toString(),
          auction.highestBidder.toLowerCase(),
          blocksRemaining,
          timeRemainingSeconds,
          auction.duration ? Number(auction.duration) : 60,
          auction.nftTokenId && Number(auction.nftTokenId) > 0
            ? Number(auction.nftTokenId)
            : null,
          auction.ended,
          auction.ended
        ]);
        
        console.log(`✅`);
        syncedCount++;
        
      } catch (error) {
        console.log(`❌ ${error.message}`);
        skippedCount++;
      }
    }
    
    console.log('');
    console.log('🎉 BLOCKCHAIN SYNC COMPLETED!');
    console.log('='.repeat(60));
    console.log(`📊 Summary:`);
    console.log(`   Total auctions: ${totalAuctions}`);
    console.log(`   Synced: ${syncedCount}`);
    console.log(`   Skipped: ${skippedCount}`);
    console.log('');
    console.log('✅ Local database is now synced with blockchain!');
    
  } catch (error) {
    console.error('❌ Sync failed:', error);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

// Run sync
syncFromBlockchain().catch(console.error);
