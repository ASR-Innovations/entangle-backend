#!/usr/bin/env node

/**
 * MANUALLY END AUCTIONS AND CREATE MEETINGS
 */

require('dotenv').config();
const ethers = require('ethers');
const MeetingAuctionABI = require('./src/contracts/MeetingAuction.json');
const { getJitsiService } = require('./src/services/JitsiService');
const { pool } = require('./src/config/database');

async function manualEndAuctions() {
  console.log('🎯 MANUALLY ENDING AUCTIONS AND CREATING MEETINGS');
  console.log('='.repeat(50));
  console.log('');

  try {
    const contractAddress = '0xceBD87246e91C7D70C82D5aE5C196a0028543933';
    const rpcUrl = 'https://api.avax-test.network/ext/bc/C/rpc';
    
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(contractAddress, MeetingAuctionABI, provider);

    // Get current block
    const currentBlock = await provider.getBlockNumber();
    console.log(`📊 Current Block: ${currentBlock}`);
    console.log('');

    // Find ended auctions
    const readyToEnd = [1, 2, 8, 9]; // From our previous test
    
    for (const auctionId of readyToEnd) {
      try {
        console.log(`🔍 Processing Auction ${auctionId}...`);
        
        const auction = await contract.getAuction(auctionId);
        
        if (auction.ended) {
          console.log(`⚠️  Auction ${auctionId} already ended`);
          continue;
        }

        if (currentBlock < auction.endBlock) {
          console.log(`⏰ Auction ${auctionId} not ready yet (ends at block ${auction.endBlock.toString()})`);
          continue;
        }

        console.log(`✅ Auction ${auctionId} ready to end:`);
        console.log(`   Host: ${auction.host}`);
        console.log(`   End Block: ${auction.endBlock.toString()}`);
        console.log(`   Highest Bid: ${ethers.utils.formatEther(auction.highestBid)} AVAX`);
        console.log(`   Highest Bidder: ${auction.highestBidder}`);
        
        // Create meeting for this auction (simulate what cron would do)
        await createMeetingForAuction(auctionId, auction);
        
        console.log('');
        
      } catch (error) {
        console.log(`❌ Error processing auction ${auctionId}:`, error.message);
      }
    }

  } catch (error) {
    console.error('❌ Process failed:', error);
  }
}

async function createMeetingForAuction(auctionId, auction) {
  try {
    console.log(`🏗️  Creating meeting for auction ${auctionId}...`);
    
    // Get Jitsi service
    const jitsi = getJitsiService();
    
    // Create meeting
    const hasWinner = auction.highestBidder !== ethers.constants.AddressZero;
    
    const meetingData = {
      auctionId: auctionId.toString(),
      hostData: {
        paraId: 'host-sim',
        name: `Auction ${auctionId} Host`,
        email: 'host@example.com'
      },
      duration: 60
    };

    if (hasWinner) {
      meetingData.winnerData = {
        paraId: 'winner-sim',
        name: `Auction ${auctionId} Winner`,
        email: 'winner@example.com'
      };
    }

    const meeting = jitsi.createAuctionMeeting(meetingData);
    
    if (meeting.success) {
      console.log(`✅ Meeting created successfully!`);
      console.log(`   Room ID: ${meeting.meeting.roomId}`);
      console.log(`   Host URL: ${meeting.host.url.substring(0, 80)}...`);
      
      if (meeting.winner) {
        console.log(`   Winner URL: ${meeting.winner.url.substring(0, 80)}...`);
      }
      
      // Store in database (simulate)
      try {
        await pool.query(`
          INSERT INTO meetings (
            auction_id, jitsi_room_id, room_url,
            creator_access_token, winner_access_token
          ) VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (auction_id) DO NOTHING
        `, [
          auctionId.toString(),
          meeting.meeting.roomId,
          meeting.meeting.baseUrl,
          meeting.host.token || '',
          meeting.winner?.token || ''
        ]);
        
        console.log(`✅ Meeting stored in database`);
        
      } catch (dbError) {
        console.log(`⚠️  Database error (may already exist):`, dbError.message);
      }
      
    } else {
      console.log(`❌ Meeting creation failed:`, meeting.error);
    }
    
  } catch (error) {
    console.log(`❌ Meeting creation error:`, error.message);
  }
}

manualEndAuctions().catch(console.error);
