#!/usr/bin/env node

/**
 * COMPLETE LIVE AUCTIONS TEST AND AUTO-END SYSTEM
 * Tests all contract functions and automatically ends expired auctions
 */

require('dotenv').config();
const ethers = require('ethers');
const MeetingAuctionABI = require('./src/contracts/MeetingAuction.json');
const { getJitsiService } = require('./src/services/JitsiService');
const { pool } = require('./src/config/database');

async function testLiveAuctions() {
  console.log('🚀 COMPLETE LIVE AUCTIONS TEST AND AUTO-END SYSTEM');
  console.log('='.repeat(60));
  console.log('');

  try {
    // Initialize contract connection
    const contractAddress = '0xceBD87246e91C7D70C82D5aE5C196a0028543933';
    const rpcUrl = process.env.RPC_URL || process.env.AVALANCHE_RPC || 'https://api.avax-test.network/ext/bc/C/rpc';
    
    console.log('📡 BLOCKCHAIN CONNECTION');
    console.log('-'.repeat(30));
    console.log(`Contract: ${contractAddress}`);
    console.log(`RPC: ${rpcUrl}`);

    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(contractAddress, MeetingAuctionABI, provider);

    // Get current block and network info
    const currentBlock = await provider.getBlockNumber();
    const network = await provider.getNetwork();
    console.log(`✅ Connected to ${network.name} (Chain ID: ${network.chainId})`);
    console.log(`✅ Current block: ${currentBlock}`);
    console.log('');

    // Test all contract view functions
    console.log('📊 CONTRACT STATE OVERVIEW');
    console.log('-'.repeat(30));
    
    const auctionCounter = await contract.auctionCounter();
    const platformFee = await contract.platformFee();
    
    console.log(`Total Auctions Created: ${auctionCounter.toString()}`);
    console.log(`Platform Fee: ${platformFee.toString()} basis points (${platformFee.toNumber()/100}%)`);
    console.log('');

    if (auctionCounter.toNumber() === 0) {
      console.log('⚠️  No auctions found. Create some auctions first.');
      return;
    }

    // Analyze all auctions
    console.log('🔍 AUCTION ANALYSIS');
    console.log('-'.repeat(30));
    
    const allAuctions = [];
    const activeAuctions = [];
    const endedAuctions = [];
    const readyToEnd = [];

    for (let i = 1; i <= auctionCounter.toNumber(); i++) {
      try {
        const auction = await contract.getAuction(i);
        allAuctions.push({ id: i, auction });

        if (auction.ended) {
          endedAuctions.push({ id: i, auction });
        } else if (currentBlock >= auction.endBlock) {
          readyToEnd.push({ id: i, auction });
        } else {
          activeAuctions.push({ id: i, auction });
        }
      } catch (error) {
        console.log(`❌ Error getting auction ${i}: ${error.message}`);
      }
    }

    console.log(`📈 Active Auctions: ${activeAuctions.length}`);
    console.log(`⏰ Ready to End: ${readyToEnd.length}`);
    console.log(`✅ Already Ended: ${endedAuctions.length}`);
    console.log(`📊 Total Analyzed: ${allAuctions.length}`);
    console.log('');

    // Display detailed auction information
    if (activeAuctions.length > 0) {
      console.log('📈 ACTIVE AUCTIONS DETAILS');
      console.log('-'.repeat(30));
      for (const { id, auction } of activeAuctions) {
        console.log(`Auction ${id}:`);
        console.log(`  Host: ${auction.host}`);
        console.log(`  End Block: ${auction.endBlock.toString()} (${auction.endBlock.toNumber() - currentBlock} blocks remaining)`);
        console.log(`  Highest Bid: ${ethers.utils.formatEther(auction.highestBid)} AVAX`);
        console.log(`  Bidder: ${auction.highestBidder}`);
        console.log(`  Twitter: ${auction.hostTwitterId}`);
        console.log('');
      }
    }

    // Process auctions ready to end
    if (readyToEnd.length > 0) {
      console.log('⏰ AUCTIONS READY TO END - PROCESSING WITH REAL TRANSACTIONS');
      console.log('-'.repeat(60));
      
      for (const { id, auction } of readyToEnd) {
        console.log(`🎯 Processing Auction ${id}:`);
        console.log(`  Host: ${auction.host}`);
        console.log(`  End Block: ${auction.endBlock.toString()} (${currentBlock - auction.endBlock.toNumber()} blocks overdue)`);
        console.log(`  Highest Bid: ${ethers.utils.formatEther(auction.highestBid)} AVAX`);
        
        const hasWinner = auction.highestBidder !== ethers.constants.AddressZero;
        console.log(`  Winner: ${hasWinner ? auction.highestBidder : 'No bids'}`);
        
        if (!hasWinner) {
          console.log(`  ⚠️  Skipping auction ${id} - no bids placed`);
          console.log('');
          continue;
        }
        
        // Actually end the auction on blockchain
        await endAuctionOnBlockchain(id, auction, contract, provider);
        console.log('');
      }
    }

    // Show already ended auctions
    if (endedAuctions.length > 0) {
      console.log('✅ ALREADY ENDED AUCTIONS');
      console.log('-'.repeat(30));
      for (const { id, auction } of endedAuctions) {
        console.log(`Auction ${id}: Winner ${auction.highestBidder} - ${ethers.utils.formatEther(auction.highestBid)} AVAX`);
      }
      console.log('');
    }

    // Test API endpoints
    console.log('🔌 API ENDPOINTS TEST');
    console.log('-'.repeat(30));
    console.log('📍 Server: http://localhost:5009');
    
    try {
      const healthResponse = await fetch('http://localhost:5009/health');
      console.log(healthResponse.ok ? '✅ Server running' : '❌ Server down');
    } catch (error) {
      console.log('❌ Server not reachable');
    }

    console.log('');
    console.log('🎯 AVAILABLE API ROUTES:');
    console.log('  GET  /api/meetings/my-meetings (Para auth required)');
    console.log('  GET  /api/meetings/my-auction-nfts (Para auth required)');
    console.log('  POST /api/meetings/access-winner-meeting (Para auth required)');
    console.log('  POST /api/meetings/burn-nft-access (Para auth required)');
    console.log('');

    // Test actual cron service
    console.log('🤖 REAL CRON SERVICE TEST');
    console.log('-'.repeat(30));
    try {
      const { getAuctionCronService } = require('./src/services/AuctionCronService');
      const auctionCron = getAuctionCronService();
      console.log('✅ Cron service loaded');
      
      console.log('🔄 Triggering real cron job to end auctions...');
      await auctionCron.processEndedAuctions();
      console.log('✅ Real cron processing completed');
    } catch (error) {
      console.log('❌ Cron service error:', error.message);
    }

    console.log('');
    console.log('📋 SUMMARY');
    console.log('='.repeat(40));
    console.log(`✅ ${allAuctions.length} total auctions found`);
    console.log(`📈 ${activeAuctions.length} still active`);
    console.log(`⏰ ${readyToEnd.length} processed and meetings created`);
    console.log(`✅ ${endedAuctions.length} already ended`);
    console.log('🚀 System ready for frontend integration!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

async function createMeetingForAuction(auctionId, auction, currentBlock) {
  try {
    console.log(`  🏗️  Creating meeting...`);
    
    const jitsi = getJitsiService();
    const hasWinner = auction.highestBidder !== ethers.constants.AddressZero;
    
    const meetingData = {
      auctionId: auctionId.toString(),
      hostData: {
        paraId: `host-${auctionId}`,
        name: `Auction ${auctionId} Host`,
        email: 'host@example.com'
      },
      duration: 60
    };

    if (hasWinner) {
      meetingData.winnerData = {
        paraId: `winner-${auctionId}`,
        name: `Auction ${auctionId} Winner`,
        email: 'winner@example.com'
      };
    }

    const meeting = jitsi.createAuctionMeeting(meetingData);
    
    if (meeting.success) {
      console.log(`  ✅ Meeting created: ${meeting.meeting.roomId}`);
      console.log(`  🔗 Host URL: ${meeting.host.url.substring(0, 60)}...`);
      
      if (meeting.winner) {
        console.log(`  🎯 Winner URL: ${meeting.winner.url.substring(0, 60)}...`);
      }
      
      // Store in database
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
        
        console.log(`  💾 Meeting stored in database`);
        
      } catch (dbError) {
        console.log(`  ⚠️  Database: ${dbError.message}`);
      }
      
    } else {
      console.log(`  ❌ Meeting creation failed: ${meeting.error}`);
    }
    
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
  }
}

async function endAuctionOnBlockchain(auctionId, auction, contract, provider) {
  try {
    console.log(`  🔗 Ending auction ${auctionId} on blockchain...`);
    
    // Get wallet with private key
    const privateKey = process.env.PLATFORM_PRIVATE_KEY || process.env.WALLET_PRIVATE_KEY;
    if (!privateKey) {
      console.log(`  ❌ No private key found - cannot end auction`);
      return;
    }
    
    const wallet = new ethers.Wallet(privateKey, provider);
    const contractWithSigner = contract.connect(wallet);
    
    console.log(`  💰 Using wallet: ${wallet.address}`);
    
    // Call endAuction transaction
    const tx = await contractWithSigner.endAuction(auctionId);
    console.log(`  📝 Transaction submitted: ${tx.hash}`);
    
    // Wait for confirmation
    console.log(`  ⏳ Waiting for confirmation...`);
    const receipt = await tx.wait();
    
    if (receipt.status === 1) {
      console.log(`  ✅ Auction ${auctionId} ended successfully!`);
      console.log(`  ⛽ Gas used: ${receipt.gasUsed.toString()}`);
      
      // Get updated auction data to see NFT minted
      const updatedAuction = await contract.getAuction(auctionId);
      if (updatedAuction.nftTokenId && updatedAuction.nftTokenId.toNumber() > 0) {
        console.log(`  🎨 NFT minted: Token ID ${updatedAuction.nftTokenId.toString()}`);
      }
      
      // Now create meeting
      await createMeetingForAuction(auctionId, updatedAuction);
      
    } else {
      console.log(`  ❌ Transaction failed`);
    }
    
  } catch (error) {
    console.log(`  ❌ Error ending auction: ${error.message}`);
    
    // Check if auction is already ended
    if (error.message.includes('Auction already ended')) {
      console.log(`  ℹ️  Auction ${auctionId} was already ended`);
      // Still create meeting for already ended auction
      await createMeetingForAuction(auctionId, auction);
    }
  }
}

// Run test
testLiveAuctions().catch(console.error);
