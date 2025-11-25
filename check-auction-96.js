#!/usr/bin/env node

/**
 * Fetch and display details for Auction 96
 */

require('dotenv').config();
const ethers = require('ethers');
const MeetingAuctionABI = require('./src/contracts/MeetingAuction.json');
const { pool } = require('./src/config/database');

async function checkAuction96() {
  // Get auction ID from command line argument or default to 96
  const auctionId = process.argv[2] || '96';
  
  console.log(`🔍 FETCHING AUCTION ${auctionId} DETAILS`);
  console.log('='.repeat(60));
  console.log('');

  try {
    // Initialize contract connection
    const contractAddress = process.env.CONTRACT_ADDRESS || '0x9171Cf8E1d3c7EBf7bf8866CcD2c8C58512A3Be8';
    const rpcUrl = process.env.RPC_URL || process.env.AVALANCHE_RPC || 'https://api.avax-test.network/ext/bc/C/rpc';
    
    console.log('📡 BLOCKCHAIN CONNECTION');
    console.log('-'.repeat(30));
    console.log(`Contract: ${contractAddress}`);
    console.log(`RPC: ${rpcUrl}`);

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(contractAddress, MeetingAuctionABI, provider);

    // Get current block and network info
    const currentBlock = await provider.getBlockNumber();
    const network = await provider.getNetwork();
    console.log(`✅ Connected to ${network.name} (Chain ID: ${network.chainId})`);
    console.log(`✅ Current block: ${currentBlock}`);
    console.log('');

    // Fetch auction from blockchain
    console.log(`⛓️  BLOCKCHAIN DATA FOR AUCTION ${auctionId}`);
    console.log('-'.repeat(60));
    
    const auction = await contract.getAuction(auctionId);
    
    const endBlock = Number(auction.endBlock);
    const blocksRemaining = Math.max(0, endBlock - currentBlock);
    const timeRemainingSeconds = blocksRemaining * 2; // Avalanche: ~2 sec/block
    const hasWinner = auction.highestBidder !== ethers.ZeroAddress;
    
    console.log(`Auction ID: ${auctionId}`);
    console.log(`Host/Creator: ${auction.host}`);
    console.log(`Seller Name: ${auction.sellerName || 'N/A'}`);
    console.log(`Profile Picture: ${auction.profilePicture || 'N/A'}`);
    console.log(`Twitter ID: ${auction.hostTwitterId || 'N/A'}`);
    console.log('');
    
    console.log(`Reserve Price: ${ethers.formatEther(auction.reservePrice)} AVAX`);
    console.log(`Highest Bid: ${ethers.formatEther(auction.highestBid)} AVAX`);
    console.log(`Highest Bidder: ${hasWinner ? auction.highestBidder : 'No bids yet'}`);
    console.log('');
    
    console.log(`Start Block: ${auction.startBlock ? auction.startBlock.toString() : 'N/A'}`);
    console.log(`End Block: ${endBlock}`);
    console.log(`Current Block: ${currentBlock}`);
    console.log(`Blocks Remaining: ${blocksRemaining}`);
    console.log(`Time Remaining: ${Math.floor(timeRemainingSeconds / 60)} minutes ${timeRemainingSeconds % 60} seconds`);
    console.log('');
    
    console.log(`Ended: ${auction.ended ? 'YES' : 'NO'}`);
    console.log(`NFT Token ID: ${auction.nftTokenId && Number(auction.nftTokenId) > 0 ? auction.nftTokenId.toString() : 'Not minted yet'}`);
    console.log('');
    
    // Duration
    if (auction.duration) {
      console.log(`Duration: ${auction.duration.toString()} minutes`);
    }
    
    // Event date/time info
    if (auction.eventDate && Number(auction.eventDate) > 0) {
      const eventDate = new Date(Number(auction.eventDate) * 1000);
      console.log(`Event Date: ${eventDate.toISOString()}`);
    }
    if (auction.eventStartTime && Number(auction.eventStartTime) > 0) {
      const startTime = new Date(Number(auction.eventStartTime) * 1000);
      console.log(`Event Start Time: ${startTime.toISOString()}`);
    }
    if (auction.eventEndTime && Number(auction.eventEndTime) > 0) {
      const endTime = new Date(Number(auction.eventEndTime) * 1000);
      console.log(`Event End Time: ${endTime.toISOString()}`);
    }
    console.log('');
    
    // Status summary
    console.log('📊 STATUS SUMMARY');
    console.log('-'.repeat(30));
    if (auction.ended) {
      console.log(`✅ Auction has ended`);
      if (hasWinner) {
        console.log(`🏆 Winner: ${auction.highestBidder}`);
        console.log(`💰 Winning bid: ${ethers.formatEther(auction.highestBid)} AVAX`);
      } else {
        console.log(`⚠️  No bids were placed`);
      }
    } else if (blocksRemaining === 0) {
      console.log(`⏰ Auction is ready to end (${currentBlock - endBlock} blocks overdue)`);
      if (hasWinner) {
        console.log(`🏆 Current winner: ${auction.highestBidder}`);
        console.log(`💰 Current bid: ${ethers.formatEther(auction.highestBid)} AVAX`);
      } else {
        console.log(`⚠️  No bids placed yet`);
      }
    } else {
      console.log(`📈 Auction is active`);
      console.log(`⏱️  ${blocksRemaining} blocks remaining (~${Math.floor(timeRemainingSeconds / 60)} minutes)`);
      if (hasWinner) {
        console.log(`💰 Current bid: ${ethers.formatEther(auction.highestBid)} AVAX`);
      } else {
        console.log(`⚠️  No bids yet`);
      }
    }
    console.log('');

    // Check database
    console.log(`💾 DATABASE DATA FOR AUCTION ${auctionId}`);
    console.log('-'.repeat(60));
    
    try {
      const dbResult = await pool.query('SELECT * FROM auctions WHERE id = $1', [auctionId]);
      
      if (dbResult.rows.length > 0) {
        const dbAuction = dbResult.rows[0];
        console.log(`Found in database: YES`);
        console.log(`Title: ${dbAuction.title || 'N/A'}`);
        console.log(`Creator Wallet: ${dbAuction.creator_wallet || 'N/A'}`);
        console.log(`Highest Bid (DB): ${dbAuction.highest_bid || 'N/A'}`);
        console.log(`Highest Bidder (DB): ${dbAuction.highest_bidder || 'N/A'}`);
        console.log(`End Block (DB): ${dbAuction.end_block || 'N/A'}`);
        console.log(`Blocks Remaining (DB): ${dbAuction.blocks_remaining || 'N/A'}`);
        console.log(`Time Remaining (DB): ${dbAuction.time_remaining_seconds || 'N/A'} seconds`);
        console.log(`Ended (DB): ${dbAuction.ended ? 'YES' : 'NO'}`);
        console.log(`Auto Ended (DB): ${dbAuction.auto_ended ? 'YES' : 'NO'}`);
        console.log(`NFT Token ID (DB): ${dbAuction.nft_token_id || 'N/A'}`);
        console.log(`Last Updated: ${dbAuction.updated_at || 'N/A'}`);
        console.log('');
        
        // Compare blockchain vs database
        console.log('🔄 BLOCKCHAIN vs DATABASE COMPARISON');
        console.log('-'.repeat(60));
        
        const bidMatch = dbAuction.highest_bid === auction.highestBid.toString();
        const bidderMatch = dbAuction.highest_bidder?.toLowerCase() === auction.highestBidder.toLowerCase();
        const endedMatch = dbAuction.ended === auction.ended;
        const blocksMatch = Number(dbAuction.blocks_remaining) === blocksRemaining;
        
        console.log(`Highest Bid Match: ${bidMatch ? '✅' : '❌'}`);
        if (!bidMatch) {
          console.log(`  Blockchain: ${ethers.formatEther(auction.highestBid)} AVAX`);
          console.log(`  Database: ${dbAuction.highest_bid ? ethers.formatEther(dbAuction.highest_bid) : 'N/A'} AVAX`);
        }
        
        console.log(`Highest Bidder Match: ${bidderMatch ? '✅' : '❌'}`);
        if (!bidderMatch) {
          console.log(`  Blockchain: ${auction.highestBidder}`);
          console.log(`  Database: ${dbAuction.highest_bidder || 'N/A'}`);
        }
        
        console.log(`Ended Status Match: ${endedMatch ? '✅' : '❌'}`);
        if (!endedMatch) {
          console.log(`  Blockchain: ${auction.ended}`);
          console.log(`  Database: ${dbAuction.ended}`);
        }
        
        console.log(`Blocks Remaining Match: ${blocksMatch ? '✅' : '❌'}`);
        if (!blocksMatch) {
          console.log(`  Blockchain: ${blocksRemaining}`);
          console.log(`  Database: ${dbAuction.blocks_remaining || 'N/A'}`);
        }
        
        console.log('');
        
        if (bidMatch && bidderMatch && endedMatch && blocksMatch) {
          console.log('✅ Database is in sync with blockchain!');
        } else {
          console.log('⚠️  Database is out of sync with blockchain!');
          console.log('💡 The cron job should update this data every 10 seconds.');
        }
        
      } else {
        console.log(`❌ Auction ${auctionId} NOT found in database`);
        console.log(`💡 This auction may need to be synced from blockchain to database`);
      }
      
    } catch (dbError) {
      console.log(`❌ Database error: ${dbError.message}`);
    }
    
    console.log('');
    console.log(`✅ Auction ${auctionId} details fetched successfully!`);

  } catch (error) {
    console.error(`❌ Error fetching auction ${auctionId}:`, error);
    console.error(error.stack);
  } finally {
    // Close database connection
    await pool.end();
  }
}

// Run the check
checkAuction96().catch(console.error);
