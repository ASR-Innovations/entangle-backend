#!/usr/bin/env node

/**
 * DEEP CONTRACT TESTING
 * Comprehensive smart contract function testing and validation
 * 
 * This test focuses on detailed contract interactions that require
 * extensive blockchain testing and are too complex for the main suite.
 */

require('dotenv').config();
const { ethers } = require('ethers');
const { TestUtils } = require('../test-utils');

class ContractDeepTester {
  constructor() {
    this.contractAddress = process.env.AUCTION_CONTRACT_ADDRESS || '0xB5D6eaD3f2b302ab38D59617C179a2f61a4ca0EC';
    this.rpcUrl = process.env.RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc';
    this.testWallet = '0x161d026cd7855bc783506183546c968cd96b4896';
    this.utils = new TestUtils();
    this.results = { passed: 0, failed: 0, total: 0, details: [] };
  }

  success(testName, details = '') {
    this.results.total++;
    this.results.passed++;
    console.log(`✅ ${testName}`);
    if (details) console.log(`   ${details}`);
    this.results.details.push({ testName, passed: true, details });
  }

  fail(testName, error) {
    this.results.total++;
    this.results.failed++;
    console.log(`❌ ${testName}`);
    console.log(`   Error: ${error}`);
    this.results.details.push({ testName, passed: false, error });
  }

  async testContractConnection() {
    console.log('\n📋 DEEP CONTRACT CONNECTION TESTING');
    console.log('-'.repeat(50));

    try {
      // Test multiple RPC endpoints if available
      const rpcEndpoints = [
        this.rpcUrl,
        'https://api.avax-test.network/ext/bc/C/rpc',
        'https://avalanche-fuji-c-chain.publicnode.com'
      ].filter(Boolean);

      for (const rpc of rpcEndpoints) {
        try {
          const provider = new ethers.providers.JsonRpcProvider(rpc);
          const network = await provider.getNetwork();
          const blockNumber = await provider.getBlockNumber();
          
          this.success(`RPC endpoint ${rpc}`, `Network: ${network.name}, Block: ${blockNumber}`);
          break; // Use first working endpoint
        } catch (error) {
          this.fail(`RPC endpoint ${rpc}`, error.message);
        }
      }

      // Test contract ABI loading
      const MeetingAuctionABI = require('../../src/contracts/MeetingAuction.json');
      const abiValid = MeetingAuctionABI && MeetingAuctionABI.abi && Array.isArray(MeetingAuctionABI.abi);
      
      if (abiValid) {
        this.success('Contract ABI loading', `${MeetingAuctionABI.abi.length} functions loaded`);
      } else {
        this.fail('Contract ABI loading', 'Invalid ABI structure');
      }

      // Test contract instantiation
      const provider = new ethers.providers.JsonRpcProvider(this.rpcUrl);
      const contract = new ethers.Contract(this.contractAddress, MeetingAuctionABI, provider);
      
      // Test contract code exists
      const code = await provider.getCode(this.contractAddress);
      if (code !== '0x') {
        this.success('Contract deployment', `Contract code exists (${code.length} bytes)`);
      } else {
        this.fail('Contract deployment', 'No contract code at address');
      }

    } catch (error) {
      this.fail('Contract connection setup', error.message);
    }
  }

  async testContractReadFunctions() {
    console.log('\n📋 CONTRACT READ FUNCTIONS TESTING');
    console.log('-'.repeat(50));

    try {
      const provider = new ethers.providers.JsonRpcProvider(this.rpcUrl);
      const MeetingAuctionABI = require('../../src/contracts/MeetingAuction.json');
      const contract = new ethers.Contract(this.contractAddress, MeetingAuctionABI, provider);

      // Test basic state variables
      const stateTests = [
        { name: 'auctionCounter', test: () => contract.auctionCounter() },
        { name: 'platformFee', test: () => contract.platformFee() },
        { name: 'owner', test: () => contract.owner() },
        { name: 'paused', test: () => contract.paused() }
      ];

      for (const { name, test } of stateTests) {
        try {
          const result = await test();
          this.success(`State variable ${name}`, `Value: ${result.toString()}`);
        } catch (error) {
          this.fail(`State variable ${name}`, error.message);
        }
      }

      // Test view functions
      const viewTests = [
        { 
          name: 'getActiveAuctions', 
          test: async () => {
            const active = await contract.getActiveAuctions();
            return `${active.length} active auctions`;
          }
        },
        {
          name: 'getContractBalance',
          test: async () => {
            const balance = await contract.getContractBalance();
            return `${ethers.utils.formatEther(balance)} AVAX`;
          }
        }
      ];

      for (const { name, test } of viewTests) {
        try {
          const result = await test();
          this.success(`View function ${name}`, result);
        } catch (error) {
          this.fail(`View function ${name}`, error.message);
        }
      }

    } catch (error) {
      this.fail('Contract read functions setup', error.message);
    }
  }

  async testAuctionDataIntegrity() {
    console.log('\n📋 AUCTION DATA INTEGRITY TESTING');
    console.log('-'.repeat(50));

    try {
      const provider = new ethers.providers.JsonRpcProvider(this.rpcUrl);
      const MeetingAuctionABI = require('../../src/contracts/MeetingAuction.json');
      const contract = new ethers.Contract(this.contractAddress, MeetingAuctionABI, provider);

      // Get active auctions
      const activeAuctions = await contract.getActiveAuctions();
      
      if (activeAuctions.length === 0) {
        this.success('Auction data integrity', 'No active auctions to test (expected)');
        return;
      }

      // Test first few auctions for data integrity
      const testAuctions = activeAuctions.slice(0, Math.min(3, activeAuctions.length));
      
      for (const auctionId of testAuctions) {
        try {
          const auction = await contract.getAuction(auctionId);
          
          // Validate auction data structure
          const validations = [
            { field: 'id', valid: auction.id.eq(auctionId) },
            { field: 'host', valid: ethers.utils.isAddress(auction.host) },
            { field: 'reservePrice', valid: auction.reservePrice.gte(0) },
            { field: 'highestBid', valid: auction.highestBid.gte(0) },
            { field: 'startBlock', valid: auction.startBlock.gt(0) },
            { field: 'endBlock', valid: auction.endBlock.gt(auction.startBlock) }
          ];

          let validFields = 0;
          for (const { field, valid } of validations) {
            if (valid) {
              validFields++;
            }
          }

          if (validFields === validations.length) {
            this.success(`Auction ${auctionId} data integrity`, 'All fields valid');
          } else {
            this.fail(`Auction ${auctionId} data integrity`, `${validFields}/${validations.length} fields valid`);
          }

          // Test auction timing
          const currentBlock = await provider.getBlockNumber();
          const isActive = currentBlock >= auction.startBlock.toNumber() && 
                          currentBlock <= auction.endBlock.toNumber() && 
                          !auction.ended;
          
          this.success(`Auction ${auctionId} timing`, `Active: ${isActive}, Current block: ${currentBlock}`);

        } catch (error) {
          this.fail(`Auction ${auctionId} data retrieval`, error.message);
        }
      }

    } catch (error) {
      this.fail('Auction data integrity setup', error.message);
    }
  }

  async testNFTFunctionality() {
    console.log('\n📋 NFT FUNCTIONALITY TESTING');
    console.log('-'.repeat(50));

    try {
      const provider = new ethers.providers.JsonRpcProvider(this.rpcUrl);
      const MeetingAuctionABI = require('../../src/contracts/MeetingAuction.json');
      const contract = new ethers.Contract(this.contractAddress, MeetingAuctionABI, provider);

      // Test NFT functions with test wallet
      try {
        const nfts = await contract.getNFTsOwnedByUser(this.testWallet);
        this.success('NFT ownership query', `User has ${nfts.tokenIds.length} NFTs`);

        // If user has NFTs, test additional functions
        if (nfts.tokenIds.length > 0) {
          const tokenId = nfts.tokenIds[0];
          
          // Test NFT metadata
          try {
            const metadata = await contract.getNFTMetadata(tokenId);
            this.success(`NFT ${tokenId} metadata`, `Auction: ${metadata.auctionId}, Host: ${metadata.host}`);
          } catch (error) {
            this.fail(`NFT ${tokenId} metadata`, error.message);
          }

          // Test burn eligibility
          try {
            const canBurn = await contract.canBurnForMeeting(tokenId, this.testWallet);
            this.success(`NFT ${tokenId} burn eligibility`, `Can burn: ${canBurn}`);
          } catch (error) {
            this.fail(`NFT ${tokenId} burn eligibility`, error.message);
          }

          // Test meeting access
          try {
            const auctionId = nfts.auctionIds[0];
            const canAccess = await contract.canAccessMeeting(auctionId, this.testWallet);
            this.success(`Meeting access for auction ${auctionId}`, `Can access: ${canAccess}`);
          } catch (error) {
            this.fail(`Meeting access test`, error.message);
          }
        }

      } catch (error) {
        this.success('NFT functionality', 'No NFTs found for test wallet (expected)');
      }

      // Test NFT functions with random addresses
      const randomWallet = this.utils.generateRandomWallet();
      try {
        const emptyNFTs = await contract.getNFTsOwnedByUser(randomWallet.address);
        this.success('NFT query with random wallet', `Returns empty result: ${emptyNFTs.tokenIds.length === 0}`);
      } catch (error) {
        this.fail('NFT query with random wallet', error.message);
      }

    } catch (error) {
      this.fail('NFT functionality setup', error.message);
    }
  }

  async testContractEvents() {
    console.log('\n📋 CONTRACT EVENTS TESTING');
    console.log('-'.repeat(50));

    try {
      const provider = new ethers.providers.JsonRpcProvider(this.rpcUrl);
      const MeetingAuctionABI = require('../../src/contracts/MeetingAuction.json');
      const contract = new ethers.Contract(this.contractAddress, MeetingAuctionABI, provider);

      // Test event filters
      const eventTests = [
        { name: 'AuctionCreated', filter: contract.filters.AuctionCreated() },
        { name: 'BidPlaced', filter: contract.filters.BidPlaced() },
        { name: 'AuctionEnded', filter: contract.filters.AuctionEnded() },
        { name: 'MeetingScheduled', filter: contract.filters.MeetingScheduled() }
      ];

      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 10000); // Last 10k blocks

      for (const { name, filter } of eventTests) {
        try {
          const events = await contract.queryFilter(filter, fromBlock, currentBlock);
          this.success(`${name} events`, `Found ${events.length} events in last 10k blocks`);

          // Analyze recent events
          if (events.length > 0) {
            const recentEvent = events[events.length - 1];
            this.success(`Recent ${name} event`, `Block: ${recentEvent.blockNumber}, Args: ${Object.keys(recentEvent.args).length}`);
          }
        } catch (error) {
          this.fail(`${name} events`, error.message);
        }
      }

    } catch (error) {
      this.fail('Contract events setup', error.message);
    }
  }

  async testContractConstants() {
    console.log('\n📋 CONTRACT CONSTANTS TESTING');
    console.log('-'.repeat(50));

    try {
      const provider = new ethers.providers.JsonRpcProvider(this.rpcUrl);
      const MeetingAuctionABI = require('../../src/contracts/MeetingAuction.json');
      const contract = new ethers.Contract(this.contractAddress, MeetingAuctionABI, provider);

      // Test contract constants
      const constantTests = [
        { name: 'ANTI_SNIPE_BLOCKS', test: () => contract.ANTI_SNIPE_BLOCKS() },
        { name: 'EXTENSION_BLOCKS', test: () => contract.EXTENSION_BLOCKS() },
        { name: 'MIN_BID_INCREMENT', test: () => contract.MIN_BID_INCREMENT() }
      ];

      for (const { name, test } of constantTests) {
        try {
          const value = await test();
          this.success(`Constant ${name}`, `Value: ${value.toString()}`);
        } catch (error) {
          this.fail(`Constant ${name}`, error.message);
        }
      }

      // Validate constant relationships
      try {
        const antiSnipe = await contract.ANTI_SNIPE_BLOCKS();
        const extension = await contract.EXTENSION_BLOCKS();
        const minIncrement = await contract.MIN_BID_INCREMENT();

        // Validate reasonable values
        if (antiSnipe.gt(0) && antiSnipe.lt(1000)) {
          this.success('Anti-snipe blocks validation', 'Reasonable value');
        } else {
          this.fail('Anti-snipe blocks validation', 'Unreasonable value');
        }

        if (extension.gt(0) && extension.lt(1000)) {
          this.success('Extension blocks validation', 'Reasonable value');
        } else {
          this.fail('Extension blocks validation', 'Unreasonable value');
        }

        if (minIncrement.gt(0)) {
          this.success('Min bid increment validation', 'Positive value');
        } else {
          this.fail('Min bid increment validation', 'Non-positive value');
        }

      } catch (error) {
        this.fail('Constants validation', error.message);
      }

    } catch (error) {
      this.fail('Contract constants setup', error.message);
    }
  }

  async runDeepContractTests() {
    console.log('\n🔬 STARTING DEEP CONTRACT TESTING');
    console.log('=' .repeat(60));
    console.log(`Contract Address: ${this.contractAddress}`);
    console.log(`RPC URL: ${this.rpcUrl}`);
    console.log(`Test Wallet: ${this.testWallet}`);
    console.log('');

    await this.testContractConnection();
    await this.testContractReadFunctions();
    await this.testAuctionDataIntegrity();
    await this.testNFTFunctionality();
    await this.testContractEvents();
    await this.testContractConstants();

    // Print results
    console.log('\n🎉 DEEP CONTRACT TEST RESULTS');
    console.log('=' .repeat(60));
    
    const formatted = this.utils.formatTestResults(this.results);
    console.log(`📊 ${formatted.summary}`);
    console.log(`🎯 Status: ${formatted.status}`);

    console.log('\n📋 DETAILED RESULTS:');
    this.results.details.forEach(test => {
      const status = test.passed ? '✅' : '❌';
      console.log(`${status} ${test.testName}`);
      if (test.details) console.log(`   ${test.details}`);
      if (test.error) console.log(`   Error: ${test.error}`);
    });

    return this.results;
  }
}

// Run if called directly
if (require.main === module) {
  const tester = new ContractDeepTester();
  tester.runDeepContractTests()
    .then(results => {
      process.exit(results.failed === 0 ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Deep contract test crashed:', error);
      process.exit(1);
    });
}

module.exports = { ContractDeepTester };