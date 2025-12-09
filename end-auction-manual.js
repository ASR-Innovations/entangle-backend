#!/usr/bin/env node

/**
 * Manually end an auction on the blockchain
 */

require('dotenv').config();
const ethers = require('ethers');
const MeetingAuctionABI = require('./src/contracts/MeetingAuction.json');

async function endAuction(auctionId) {
  console.log(`🎯 MANUALLY ENDING AUCTION ${auctionId}`);
  console.log('='.repeat(60));
  console.log('');

  try {
    const contractAddress = process.env.CONTRACT_ADDRESS;
    const rpcUrl = process.env.RPC_URL;
    const privateKey = process.env.PLATFORM_PRIVATE_KEY || process.env.PRIVATE_KEY;

    if (!privateKey) {
      console.error('❌ No private key found in environment variables');
      process.exit(1);
    }

    console.log('📡 Connecting to blockchain...');
    console.log(`Contract: ${contractAddress}`);
    
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(contractAddress, MeetingAuctionABI, wallet);

    console.log(`💼 Using wallet: ${wallet.address}`);
    console.log('');

    // Check auction status first
    console.log('🔍 Checking auction status...');
    const auction = await contract.getAuction(auctionId);
    
    if (auction.ended) {
      console.log('⚠️  Auction is already ended!');
      return;
    }

    const currentBlock = await provider.getBlockNumber();
    const endBlock = Number(auction.endBlock);
    
    console.log(`Current Block: ${currentBlock}`);
    console.log(`End Block: ${endBlock}`);
    console.log(`Highest Bid: ${ethers.formatEther(auction.highestBid)} ETH`);
    console.log(`Winner: ${auction.highestBidder}`);
    console.log('');

    if (currentBlock < endBlock) {
      console.log(`⚠️  Auction has not ended yet! ${endBlock - currentBlock} blocks remaining.`);
      return;
    }

    // End the auction
    console.log('⛓️  Sending endAuction transaction...');
    const tx = await contract.endAuction(auctionId);
    console.log(`📝 Transaction submitted: ${tx.hash}`);
    console.log('⏳ Waiting for confirmation...');

    const receipt = await tx.wait();

    if (receipt.status === 1) {
      console.log('');
      console.log('✅ AUCTION ENDED SUCCESSFULLY!');
      console.log(`⛽ Gas used: ${receipt.gasUsed.toString()}`);
      console.log(`🔗 Transaction: ${receipt.hash}`);
      
      // Get updated auction data
      const updatedAuction = await contract.getAuction(auctionId);
      if (updatedAuction.nftTokenId && Number(updatedAuction.nftTokenId) > 0) {
        console.log(`🎨 NFT minted! Token ID: ${updatedAuction.nftTokenId.toString()}`);
      }
      
      console.log('');
      console.log('📊 Final Auction Status:');
      console.log(`   Ended: ${updatedAuction.ended}`);
      console.log(`   Winner: ${updatedAuction.highestBidder}`);
      console.log(`   Winning Bid: ${ethers.formatEther(updatedAuction.highestBid)} ETH`);
    } else {
      console.log('❌ Transaction failed!');
    }

  } catch (error) {
    console.error('❌ Error ending auction:', error.message);
    if (error.reason) {
      console.error('Reason:', error.reason);
    }
  }
}

// Get auction ID from command line
const auctionId = process.argv[2];
if (!auctionId) {
  console.log('Usage: node end-auction-manual.js <auction_id>');
  console.log('Example: node end-auction-manual.js 18');
  process.exit(1);
}

endAuction(auctionId).catch(console.error);
