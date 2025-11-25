const { ethers } = require('ethers');
const logger = require('../utils/logger');

// Import the updated ABI
const ENTANGLED_ABI = require('../ENTANGLEDABI.js');
const BlockNumberService = require('./BlockNumberService');

// Contract configuration for different networks
const CONTRACT_CONFIG = {
  ARBITRUM_SEPOLIA: {
    address: process.env.CONTRACT_ADDRESS || '0xC189A7E4Aa1dD9eD9a93758898E64aDe8bda5486',
    chainId: 421614,
    rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
    explorer: 'https://sepolia.arbiscan.io',
    blockTime: 10.0 // seconds per block (Measured actual: 10s/block on L2)
  },
  SEPOLIA: {
    address: process.env.CONTRACT_ADDRESS || '0x6783A0B48f44dd244A96e01c435CB5315C2AA5Af',
    chainId: 11155111,
    rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
    explorer: 'https://sepolia.etherscan.io',
    blockTime: 12 // seconds per block
  }
};

class ContractService {
  constructor(network = null) {
    // Auto-detect network from environment or use default
    this.network = network || process.env.BLOCKCHAIN_NETWORK || 'ARBITRUM_SEPOLIA';
    this.config = CONTRACT_CONFIG[this.network];

    if (!this.config) {
      logger.warn(`⚠️  Unknown network: ${this.network}, falling back to ARBITRUM_SEPOLIA`);
      this.network = 'ARBITRUM_SEPOLIA';
      this.config = CONTRACT_CONFIG.ARBITRUM_SEPOLIA;
    }

    this.contractAddress = process.env.CONTRACT_ADDRESS || this.config.address;
    this.rpcUrl = process.env.RPC_URL || process.env.AVALANCHE_RPC || this.config.rpcUrl;
    this.provider = null;
    this.contract = null;
    this.wallet = null;
    this.blockNumberService = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      logger.info(`🔗 Connecting to ${this.network} blockchain at ${this.rpcUrl}...`);
      
      // Initialize provider with timeout
      this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
      
      // Test connection with timeout
      logger.info('🧪 Testing blockchain connection...');
      const networkPromise = this.provider.getNetwork();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('RPC connection timeout after 5 seconds')), 5000)
      );
      
      const network = await Promise.race([networkPromise, timeoutPromise]);
      logger.info(`✅ Connected to chain ID: ${network.chainId}`);
      
      // Initialize wallet if private key is available
      const privateKey = process.env.PLATFORM_PRIVATE_KEY || process.env.WALLET_PRIVATE_KEY || process.env.PRIVATE_KEY;
      if (privateKey) {
        this.wallet = new ethers.Wallet(privateKey, this.provider);
        logger.info('✅ Contract service wallet initialized', {
          walletAddress: this.wallet.address,
          network: this.network
        });
      } else {
        logger.warn('⚠️  No wallet private key provided - read-only mode');
      }
      
      // Initialize contract with updated ABI
      this.contract = new ethers.Contract(
        this.contractAddress,
        ENTANGLED_ABI,
        this.wallet || this.provider
      );

      // Initialize BlockNumberService for L2 block number support (Arbitrum)
      const blockTestAddress = process.env.BLOCKTEST_CONTRACT_ADDRESS;
      this.blockNumberService = new BlockNumberService(this.provider, blockTestAddress);

      if (this.network.includes('ARBITRUM') && blockTestAddress) {
        logger.info('✅ BlockTest contract initialized for L2 block numbers', {
          blockTestAddress
        });
      } else if (this.network.includes('ARBITRUM') && !blockTestAddress) {
        logger.warn('⚠️  BLOCKTEST_CONTRACT_ADDRESS not set - L2 block numbers may be incorrect');
      }

      this.initialized = true;
      logger.info('✅ Contract service fully initialized', {
        contractAddress: this.contractAddress,
        network: this.network,
        hasWallet: !!this.wallet,
        hasBlockNumberService: !!this.blockNumberService
      });

      return true;
    } catch (error) {
      logger.error('❌ Failed to initialize contract service:', error.message);
      if (error.message.includes('timeout')) {
        logger.warn('⚠️  RPC connection timed out - server will continue but blockchain features may be limited');
      }
      // Don't fail - allow server to start without contract service
      this.initialized = false;
      return false;
    }
  }

  // Ensure contract is initialized
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Get current block number (L2 for Arbitrum, regular for others)
   * Uses BlockNumberService to ensure correct block number on L2 networks
   */
  async getCurrentBlock() {
    await this.ensureInitialized();
    return await this.blockNumberService.getCurrentBlock();
  }

  // ========================================
  // AUCTION FUNCTIONS
  // ========================================

  async getAuction(auctionId) {
    await this.ensureInitialized();
    try {
      const auction = await this.contract.getAuction(auctionId);
      
      
      return {
        id: Number(auction.id),
        host: auction.host,
        // NOTE: Auction struct does NOT have startBlock field - removed to fix bug
        endBlock: Number(auction.endBlock),
        reservePrice: ethers.formatEther(auction.reservePrice),
        highestBid: ethers.formatEther(auction.highestBid),
        highestBidder: auction.highestBidder,
        meetingMetadataIPFS: auction.meetingMetadataIPFS,
        hostTwitterId: auction.hostTwitterId,
        ended: auction.ended,
        meetingScheduled: auction.meetingScheduled,
        duration: Number(auction.duration),
        nftTokenId: Number(auction.nftTokenId),
        sellerName: auction.sellerName,
        eventName: auction.eventName,
        eventDate: Number(auction.eventDate),
        eventStartTime: Number(auction.eventStartTime),
        eventEndTime: Number(auction.eventEndTime),
        profilePicture: auction.profilePicture
      };
    } catch (error) {
      logger.error(`Failed to get auction ${auctionId}:`, error);
      throw error;
    }
  }

  async getActiveAuctions(limit = 50) {
    await this.ensureInitialized();
    try {
      const activeAuctions = await this.contract.getActiveAuctions(limit);
      return activeAuctions.map(id => Number(id));
    } catch (error) {
      logger.error('Failed to get active auctions:', error);
      throw error;
    }
  }

  async getAuctionCounter() {
    await this.ensureInitialized();
    try {
      const counter = await this.contract.auctionCounter();
      return Number(counter);
    } catch (error) {
      logger.error('Failed to get auction counter:', error);
      throw error;
    }
  }

  // ========================================
  // NFT FUNCTIONS
  // ========================================

  async getNFTsOwnedByUser(userAddress) {
    await this.ensureInitialized();
    try {
      // Contract function is getUserNFTs, returns [tokens[], auctionIds[]]
      const result = await this.contract.getUserNFTs(userAddress);
      return {
        tokenIds: result[0].map(id => Number(id)),
        auctionIds: result[1].map(id => Number(id))
      };
    } catch (error) {
      logger.error(`Failed to get NFTs for user ${userAddress}:`, error);
      throw error;
    }
  }

  async getNFTMetadata(tokenId) {
    await this.ensureInitialized();
    try {
      const metadata = await this.contract.getNFTMetadata(tokenId);
      return {
        auctionId: Number(metadata.auctionId),
        host: metadata.host,
        hostTwitterId: metadata.hostTwitterId,
        meetingMetadataIPFS: metadata.meetingMetadataIPFS,
        meetingDuration: Number(metadata.meetingDuration),
        mintTimestamp: Number(metadata.mintTimestamp)
      };
    } catch (error) {
      logger.error(`Failed to get NFT metadata for token ${tokenId}:`, error);
      throw error;
    }
  }

  async canBurnForMeeting(tokenId, userAddress) {
    await this.ensureInitialized();
    try {
      // Check 1: Token exists and user owns it
      try {
        const owner = await this.contract.ownerOf(tokenId);
        if (owner.toLowerCase() !== userAddress.toLowerCase()) {
          return { canBurn: false, reason: 'Not the owner of this NFT' };
        }
      } catch (error) {
        return { canBurn: false, reason: 'NFT does not exist or already burned' };
      }
      
      // Check 2: NFT not already used
      const isUsed = await this.contract.nftUsedForMeeting(tokenId);
      if (isUsed) {
        return { canBurn: false, reason: 'NFT already used for meeting access' };
      }
      
      // Check 3: Get auction data and verify meeting is ready
      const metadata = await this.contract.nftMetadata(tokenId);
      const auctionId = metadata.auctionId;
      const auction = await this.contract.getAuction(auctionId);
      
      if (!auction.ended) {
        return { canBurn: false, reason: 'Auction not ended yet' };
      }
      
      // Note: meetingScheduled check removed - meeting can be accessed even if not scheduled on-chain
      // Backend creates meetings automatically via cron
      
      return {
        canBurn: true,
        auctionId: Number(auctionId),
        meetingReady: auction.meetingScheduled
      };
    } catch (error) {
      logger.error(`Failed to check burn eligibility for token ${tokenId}:`, error);
      throw error;
    }
  }

  async canAccessMeeting(auctionId, userAddress) {
    await this.ensureInitialized();
    try {
      return await this.contract.canAccessMeeting(auctionId, userAddress);
    } catch (error) {
      logger.error(`Failed to check meeting access for auction ${auctionId}:`, error);
      throw error;
    }
  }

  async burnNFTForMeeting(tokenId) {
    await this.ensureInitialized();
    if (!this.wallet) {
      throw new Error('Wallet required for burning NFT');
    }
    try {
      const tx = await this.contract.burnNFTForMeeting(tokenId);
      const receipt = await tx.wait();
      return {
        success: receipt.status === 1,
        transactionHash: receipt.hash,
        auctionId: Number(receipt.logs[0]?.args?.auctionId || 0)
      };
    } catch (error) {
      logger.error(`Failed to burn NFT ${tokenId}:`, error);
      throw error;
    }
  }

  // ========================================
  // BIDDING FUNCTIONS
  // ========================================

  async placeBid(auctionId, bidAmount) {
    await this.ensureInitialized();
    if (!this.wallet) {
      throw new Error('Wallet required for placing bid');
    }
    try {
      const tx = await this.contract.placeBid(auctionId, {
        value: ethers.parseEther(bidAmount.toString())
      });
      const receipt = await tx.wait();
      return {
        success: receipt.status === 1,
        transactionHash: receipt.hash,
        gasUsed: receipt.gasUsed.toString()
      };
    } catch (error) {
      logger.error(`Failed to place bid on auction ${auctionId}:`, error);
      throw error;
    }
  }

  async getPendingReturn(auctionId, bidderAddress) {
    await this.ensureInitialized();
    try {
      const amount = await this.contract.getPendingReturn(auctionId, bidderAddress);
      return ethers.formatEther(amount);
    } catch (error) {
      logger.error(`Failed to get pending return for auction ${auctionId}:`, error);
      throw error;
    }
  }

  async withdrawBid(auctionId) {
    await this.ensureInitialized();
    if (!this.wallet) {
      throw new Error('Wallet required for withdrawing bid');
    }
    try {
      const tx = await this.contract.withdrawBid(auctionId);
      const receipt = await tx.wait();
      return {
        success: receipt.status === 1,
        transactionHash: receipt.hash
      };
    } catch (error) {
      logger.error(`Failed to withdraw bid for auction ${auctionId}:`, error);
      throw error;
    }
  }

  // ========================================
  // MEETING FUNCTIONS
  // ========================================

  async scheduleMeeting(auctionId, meetingAccessHash) {
    await this.ensureInitialized();
    if (!this.wallet) {
      throw new Error('Wallet required for scheduling meeting');
    }
    try {
      const tx = await this.contract.scheduleMeeting(auctionId, meetingAccessHash);
      const receipt = await tx.wait();
      return {
        success: receipt.status === 1,
        transactionHash: receipt.hash
      };
    } catch (error) {
      logger.error(`Failed to schedule meeting for auction ${auctionId}:`, error);
      throw error;
    }
  }

  // ========================================
  // AUCTION MANAGEMENT FUNCTIONS
  // ========================================

  async endAuction(auctionId) {
    await this.ensureInitialized();
    if (!this.wallet) {
      throw new Error('Wallet required for ending auction');
    }
    try {
      const tx = await this.contract.endAuction(auctionId);
      const receipt = await tx.wait();
      return {
        success: receipt.status === 1,
        transactionHash: receipt.hash,
        gasUsed: receipt.gasUsed.toString()
      };
    } catch (error) {
      logger.error(`Failed to end auction ${auctionId}:`, error);
      throw error;
    }
  }

  async cancelAuction(auctionId) {
    await this.ensureInitialized();
    if (!this.wallet) {
      throw new Error('Wallet required for canceling auction');
    }
    try {
      const tx = await this.contract.cancelAuction(auctionId);
      const receipt = await tx.wait();
      return {
        success: receipt.status === 1,
        transactionHash: receipt.hash
      };
    } catch (error) {
      logger.error(`Failed to cancel auction ${auctionId}:`, error);
      throw error;
    }
  }

  // ========================================
  // USER DASHBOARD FUNCTIONS
  // ========================================

  async getUserDashboardCategorized(userAddress) {
    await this.ensureInitialized();
    try {
      const result = await this.contract.getUserDashboardCategorized(userAddress);
      return {
        upcomingEvents: result.upcomingEvents.map(auction => this.formatAuction(auction)),
        eventsInAuction: result.eventsInAuction.map(auction => this.formatAuction(auction)),
        pastEvents: result.pastEvents.map(auction => this.formatAuction(auction))
      };
    } catch (error) {
      logger.error(`Failed to get user dashboard for ${userAddress}:`, error);
      throw error;
    }
  }

  async getHostDashboardCategorized(hostAddress) {
    await this.ensureInitialized();
    try {
      const result = await this.contract.getHostDashboardCategorized(hostAddress);
      return {
        upcomingEvents: result.upcomingEvents.map(auction => this.formatAuction(auction)),
        eventsInAuction: result.eventsInAuction.map(auction => this.formatAuction(auction)),
        pastEvents: result.pastEvents.map(auction => this.formatAuction(auction))
      };
    } catch (error) {
      logger.error(`Failed to get host dashboard for ${hostAddress}:`, error);
      throw error;
    }
  }

  // ========================================
  // UTILITY FUNCTIONS
  // ========================================

  formatAuction(auction) {
    return {
      id: Number(auction.id),
      host: auction.host,
      // NOTE: Auction struct does NOT have startBlock field - removed to fix bug
      endBlock: Number(auction.endBlock),
      reservePrice: ethers.formatEther(auction.reservePrice),
      highestBid: ethers.formatEther(auction.highestBid),
      highestBidder: auction.highestBidder,
      meetingMetadataIPFS: auction.meetingMetadataIPFS,
      hostTwitterId: auction.hostTwitterId,
      ended: auction.ended,
      meetingScheduled: auction.meetingScheduled,
      duration: Number(auction.duration),
      nftTokenId: Number(auction.nftTokenId),
      sellerName: auction.sellerName,
      eventName: auction.eventName,
      eventDate: Number(auction.eventDate),
      eventStartTime: Number(auction.eventStartTime),
      eventEndTime: Number(auction.eventEndTime),
      profilePicture: auction.profilePicture
    };
  }

  async getContractStats() {
    await this.ensureInitialized();
    try {
      const [auctionCounter, platformFee, owner, paused] = await Promise.all([
        this.contract.auctionCounter(),
        this.contract.platformFee(),
        this.contract.owner(),
        this.contract.paused()
      ]);
      
      return {
        auctionCounter: Number(auctionCounter),
        platformFee: Number(platformFee),
        owner,
        paused
      };
    } catch (error) {
      logger.error('Failed to get contract stats:', error);
      throw error;
    }
  }

  async getContractBalance() {
    await this.ensureInitialized();
    try {
      const balance = await this.contract.getContractBalance();
      return ethers.formatEther(balance);
    } catch (error) {
      logger.error('Failed to get contract balance:', error);
      throw error;
    }
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  // Get contract instance
  getContract() {
    return this.contract;
  }

  // Get provider
  getProvider() {
    return this.provider;
  }

  // Get wallet
  getWallet() {
    return this.wallet;
  }

  // Get network configuration
  getNetworkConfig() {
    return this.config;
  }

  // Get block time for the current network
  getBlockTime() {
    return this.config.blockTime || 12; // Default to 12 seconds (Ethereum)
  }

  // Get wallet balance
  async getBalance() {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }
    try {
      const balance = await this.wallet.getBalance();
      return ethers.formatEther(balance);
    } catch (error) {
      logger.error('Failed to get wallet balance:', error);
      throw error;
    }
  }

  // Monitor contract events
  async monitorEvents() {
    await this.ensureInitialized();
    logger.info('🎧 Starting event monitoring...');
    
    // Monitor AuctionCreated events
    this.contract.on('AuctionCreated', (auctionId, host, twitterId, reservePrice, endBlock, metadataIPFS) => {
      logger.info('🎉 New auction created:', {
        auctionId: auctionId.toString(),
        host,
        twitterId,
        reservePrice: ethers.formatEther(reservePrice),
        endBlock: endBlock.toString(),
        metadataIPFS
      });
    });
    
    // Monitor BidPlaced events
    this.contract.on('BidPlaced', (auctionId, bidder, amount, newEndBlock) => {
      logger.info('💰 New bid placed:', {
        auctionId: auctionId.toString(),
        bidder,
        amount: ethers.formatEther(amount),
        newEndBlock: newEndBlock.toString()
      });
    });
    
    // Monitor AuctionEnded events
    this.contract.on('AuctionEnded', (auctionId, winner, host, winningBid, nftTokenId) => {
      logger.info('🏆 Auction ended:', {
        auctionId: auctionId.toString(),
        winner,
        host,
        winningBid: ethers.formatEther(winningBid),
        nftTokenId: nftTokenId.toString()
      });
    });
    
    // Monitor MeetingScheduled events
    this.contract.on('MeetingScheduled', (auctionId, meetingAccessHash) => {
      logger.info('📅 Meeting scheduled:', {
        auctionId: auctionId.toString(),
        meetingAccessHash
      });
    });

    // Monitor NFT events
    this.contract.on('NFTBurnedForMeeting', (tokenId, auctionId, user) => {
      logger.info('🔥 NFT burned for meeting:', {
        tokenId: tokenId.toString(),
        auctionId: auctionId.toString(),
        user
      });
    });

    this.contract.on('NFTTransferred', (tokenId, from, to, auctionId) => {
      logger.info('🔄 NFT transferred:', {
        tokenId: tokenId.toString(),
        from,
        to,
        auctionId: auctionId.toString()
      });
    });
  }

  // Stop event monitoring
  stopEventMonitoring() {
    if (this.contract) {
      this.contract.removeAllListeners();
      logger.info('🛑 Event monitoring stopped');
    }
  }
}

// Singleton instance
let contractService = null;

function getContractService() {
  if (!contractService) {
    contractService = new ContractService();
  }
  return contractService;
}

module.exports = {
  ContractService,
  getContractService
};
