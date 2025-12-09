#!/usr/bin/env node

require('dotenv').config();
const ethers = require('ethers');
const MeetingAuctionABI = require('./src/contracts/MeetingAuction.json');

async function checkContract() {
  const contractAddress = process.env.CONTRACT_ADDRESS;
  const rpcUrl = process.env.RPC_URL;
  
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const contract = new ethers.Contract(contractAddress, MeetingAuctionABI, provider);
  
  console.log('📊 CONTRACT STATUS');
  console.log('='.repeat(60));
  
  // Check contract balance
  const balance = await provider.getBalance(contractAddress);
  console.log(`Contract Balance: ${ethers.formatEther(balance)} ETH`);
  
  // Check auction 18 details
  const auction = await contract.getAuction(18);
  console.log('');
  console.log('📋 AUCTION 18 DETAILS:');
  console.log(`Host: ${auction.host}`);
  console.log(`Highest Bid: ${ethers.formatEther(auction.highestBid)} ETH`);
  console.log(`Highest Bidder: ${auction.highestBidder}`);
  console.log(`Ended: ${auction.ended}`);
  console.log(`NFT Token ID: ${auction.nftTokenId?.toString() || 'N/A'}`);
  
  // Check if contract has enough balance to pay
  const bidAmount = auction.highestBid;
  console.log('');
  console.log('💰 BALANCE CHECK:');
  console.log(`Contract has: ${ethers.formatEther(balance)} ETH`);
  console.log(`Needs to pay: ${ethers.formatEther(bidAmount)} ETH`);
  console.log(`Sufficient: ${balance >= bidAmount ? '✅ YES' : '❌ NO'}`);
}

checkContract().catch(console.error);
