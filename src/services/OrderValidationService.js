const { ethers } = require('ethers');
const logger = require('../utils/logger');
const {
  SignatureError,
  ExpirationError,
  ValidationError,
  OwnershipError,
  PlatformFeeError,
  BlockchainError
} = require('../utils/errors');

/**
 * OrderValidationService
 * 
 * Validates Seaport orders including signature verification, NFT ownership,
 * expiration, price validation, and order hash calculation.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */
class OrderValidationService {
  constructor() {
    this.provider = null;
    this.seaportContractAddress = process.env.SEAPORT_CONTRACT_ADDRESS || '0x0000000000000068F116a894984e2DB1123eB395'; // Seaport 1.6 on Arbitrum Sepolia
    this.chainId = parseInt(process.env.SEAPORT_CHAIN_ID || '421614'); // Arbitrum Sepolia chain ID
    this.rpcUrl = process.env.RPC_URL || process.env.ARBITRUM_SEPOLIA_URL || 'https://sepolia-rollup.arbitrum.io/rpc';
    
    // Platform fee configuration (Requirement 10.5)
    this.platformFeeRecipient = process.env.PLATFORM_FEE_RECIPIENT || null;
    this.platformFeeBasisPoints = parseInt(process.env.PLATFORM_FEE_BASIS_POINTS || '250'); // Default 2.5%
  }

  /**
   * Initialize the provider for blockchain interactions
   */
  async initialize() {
    if (!this.provider) {
      this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
      logger.info('OrderValidationService initialized', {
        chainId: this.chainId,
        seaportContract: this.seaportContractAddress
      });
    }
  }

  /**
   * Validate complete order data
   * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7
   * 
   * @param {Object} orderData - Complete order data including components and signature
   * @returns {Object} Validation result with success flag and errors array
   */
  async validateOrderData(orderData) {
    const errors = [];

    try {
      // Validate required fields
      if (!orderData.orderHash) {
        errors.push('Order hash is required');
      }
      if (!orderData.orderType || !['listing', 'offer'].includes(orderData.orderType)) {
        errors.push('Order type must be "listing" or "offer"');
      }
      if (!orderData.nftContract || !ethers.isAddress(orderData.nftContract)) {
        errors.push('Valid NFT contract address is required');
      }
      if (!orderData.tokenId) {
        errors.push('Token ID is required');
      }
      if (!orderData.maker || !ethers.isAddress(orderData.maker)) {
        errors.push('Valid maker address is required');
      }
      if (!orderData.paymentToken || !ethers.isAddress(orderData.paymentToken)) {
        errors.push('Valid payment token address is required');
      }
      if (!orderData.price) {
        errors.push('Price is required');
      }
      if (!orderData.orderComponents) {
        errors.push('Order components are required');
      }
      if (!orderData.signature) {
        errors.push('Signature is required');
      }

      // If basic validation fails, return early
      if (errors.length > 0) {
        return { valid: false, errors };
      }

      // Validate price (Requirement 2.5)
      const priceValidation = await this.validatePrice(orderData.price);
      if (!priceValidation.valid) {
        errors.push(priceValidation.error);
      }

      // Validate expiration (Requirement 2.4)
      const expirationValidation = await this.validateExpiration(orderData.endTime);
      if (!expirationValidation.valid) {
        errors.push(expirationValidation.error);
      }

      // Verify order signature (Requirements 2.1, 2.2)
      const signatureValidation = await this.verifyOrderSignature(
        orderData.orderComponents,
        orderData.signature,
        orderData.maker
      );
      if (!signatureValidation.valid) {
        errors.push(signatureValidation.error);
      }

      // Calculate and verify order hash (Requirement 2.6)
      const calculatedHash = this.calculateOrderHash(orderData.orderComponents);
      if (calculatedHash.toLowerCase() !== orderData.orderHash.toLowerCase()) {
        errors.push('Order hash does not match calculated hash');
      }

      // Validate platform fee in consideration items (Requirements 10.1, 10.2, 10.5)
      const platformFeeValidation = this.validatePlatformFee(orderData);
      if (!platformFeeValidation.valid) {
        errors.push(platformFeeValidation.error);
      }

      // For listings, validate NFT ownership (Requirement 2.3)
      if (orderData.orderType === 'listing') {
        await this.initialize();
        const ownershipValidation = await this.validateNFTOwnership(
          orderData.nftContract,
          orderData.tokenId,
          orderData.maker
        );
        if (!ownershipValidation.valid) {
          errors.push(ownershipValidation.error);
        }
      }

      return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      logger.error('Error validating order data:', error);
      return {
        valid: false,
        errors: [`Validation error: ${error.message}`]
      };
    }
  }

  /**
   * Verify order signature using EIP-712
   * Requirements: 2.1, 2.2
   * 
   * @param {Object} orderComponents - Seaport order components
   * @param {string} signature - Order signature
   * @param {string} maker - Expected maker address
   * @returns {Object} Validation result
   */
  async verifyOrderSignature(orderComponents, signature, maker) {
    try {
      // Log received data for debugging
      logger.debug('Verifying order signature', {
        offerer: orderComponents.offerer,
        startTime: orderComponents.startTime,
        startTimeType: typeof orderComponents.startTime,
        maker
      });

      // Build EIP-712 domain - MUST match frontend exactly
      const domain = {
        name: 'Seaport',
        version: '1.6',  // ✅ FIXED: Changed from 1.5 to 1.6 to match Seaport 1.6 frontend
        chainId: this.chainId,
        verifyingContract: this.seaportContractAddress
      };

      // Define Seaport order types for EIP-712
      const types = {
        OrderComponents: [
          { name: 'offerer', type: 'address' },
          { name: 'zone', type: 'address' },
          { name: 'offer', type: 'OfferItem[]' },
          { name: 'consideration', type: 'ConsiderationItem[]' },
          { name: 'orderType', type: 'uint8' },
          { name: 'startTime', type: 'uint256' },
          { name: 'endTime', type: 'uint256' },
          { name: 'zoneHash', type: 'bytes32' },
          { name: 'salt', type: 'uint256' },
          { name: 'conduitKey', type: 'bytes32' },
          { name: 'counter', type: 'uint256' }
        ],
        OfferItem: [
          { name: 'itemType', type: 'uint8' },
          { name: 'token', type: 'address' },
          { name: 'identifierOrCriteria', type: 'uint256' },
          { name: 'startAmount', type: 'uint256' },
          { name: 'endAmount', type: 'uint256' }
        ],
        ConsiderationItem: [
          { name: 'itemType', type: 'uint8' },
          { name: 'token', type: 'address' },
          { name: 'identifierOrCriteria', type: 'uint256' },
          { name: 'startAmount', type: 'uint256' },
          { name: 'endAmount', type: 'uint256' },
          { name: 'recipient', type: 'address' }
        ]
      };

      // ✅ FIXED: Convert string fields to numbers for EIP-712 hash calculation
      // JSON serialization sends numbers as strings, but EIP-712 requires actual numbers
      const orderComponentsForHashing = {
        offerer: orderComponents.offerer,
        zone: orderComponents.zone,
        offer: orderComponents.offer,
        consideration: orderComponents.consideration,
        orderType: orderComponents.orderType,
        startTime: parseInt(orderComponents.startTime, 10),
        endTime: parseInt(orderComponents.endTime, 10),
        zoneHash: orderComponents.zoneHash,
        salt: orderComponents.salt,
        conduitKey: orderComponents.conduitKey,
        counter: parseInt(orderComponents.counter, 10)
      };

      // Recover signer from signature
      const recoveredAddress = ethers.verifyTypedData(
        domain,
        types,
        orderComponentsForHashing,  // Use converted values with numbers
        signature
      );

      logger.debug('Signature verification result', {
        recoveredAddress,
        expected: maker,
        match: recoveredAddress.toLowerCase() === maker.toLowerCase()
      });

      // Verify recovered address matches maker
      const isValid = recoveredAddress.toLowerCase() === maker.toLowerCase();

      if (!isValid) {
        logger.warn('Signature verification failed', {
          expected: maker,
          recovered: recoveredAddress
        });
        return {
          valid: false,
          error: 'Invalid order signature'
        };
      }

      return { valid: true };

    } catch (error) {
      logger.error('Error verifying signature:', error);
      return {
        valid: false,
        error: `Signature verification failed: ${error.message}`
      };
    }
  }

  /**
   * Validate NFT ownership
   * Requirement: 2.3
   * 
   * @param {string} nftContract - NFT contract address
   * @param {string} tokenId - Token ID
   * @param {string} owner - Expected owner address
   * @returns {Object} Validation result
   */
  async validateNFTOwnership(nftContract, tokenId, owner) {
    try {
      await this.initialize();

      // ERC721 ownerOf function ABI
      const erc721ABI = [
        'function ownerOf(uint256 tokenId) view returns (address)'
      ];

      const nftContractInstance = new ethers.Contract(
        nftContract,
        erc721ABI,
        this.provider
      );

      // Query current owner
      const currentOwner = await nftContractInstance.ownerOf(tokenId);

      // Verify ownership
      const isOwner = currentOwner.toLowerCase() === owner.toLowerCase();

      if (!isOwner) {
        logger.warn('NFT ownership validation failed', {
          nftContract,
          tokenId,
          expectedOwner: owner,
          actualOwner: currentOwner
        });
        return {
          valid: false,
          error: 'Maker does not own the NFT'
        };
      }

      return { valid: true };

    } catch (error) {
      logger.error('Error validating NFT ownership:', error);
      
      // Handle common errors
      if (error.message.includes('ERC721: invalid token ID') || 
          error.message.includes('owner query for nonexistent token')) {
        return {
          valid: false,
          error: 'NFT does not exist'
        };
      }

      return {
        valid: false,
        error: `NFT ownership validation failed: ${error.message}`
      };
    }
  }

  /**
   * Validate order expiration time
   * Requirement: 2.4
   * 
   * @param {number} endTime - Order end time (Unix timestamp in seconds)
   * @returns {Object} Validation result
   */
  async validateExpiration(endTime) {
    try {
      const currentTime = Math.floor(Date.now() / 1000);
      const endTimeNum = parseInt(endTime);

      if (isNaN(endTimeNum)) {
        return {
          valid: false,
          error: 'Invalid expiration time format'
        };
      }

      if (endTimeNum <= currentTime) {
        return {
          valid: false,
          error: 'Order has expired'
        };
      }

      return { valid: true };

    } catch (error) {
      logger.error('Error validating expiration:', error);
      return {
        valid: false,
        error: `Expiration validation failed: ${error.message}`
      };
    }
  }

  /**
   * Validate order price
   * Requirement: 2.5
   * 
   * @param {string} price - Order price (in wei or smallest token unit)
   * @returns {Object} Validation result
   */
  async validatePrice(price) {
    try {
      // Convert to BigInt for validation
      const priceBigInt = BigInt(price);

      if (priceBigInt <= 0n) {
        return {
          valid: false,
          error: 'Price must be greater than zero'
        };
      }

      return { valid: true };

    } catch (error) {
      logger.error('Error validating price:', error);
      return {
        valid: false,
        error: 'Invalid price format'
      };
    }
  }

  /**
   * Validate platform fee in order consideration items
   * Requirements: 10.1, 10.2, 10.5
   * 
   * @param {Object} orderData - Order data including components
   * @returns {Object} Validation result
   */
  validatePlatformFee(orderData) {
    try {
      // Skip validation if platform fee recipient is not configured
      if (!this.platformFeeRecipient) {
        logger.debug('Platform fee recipient not configured, skipping validation');
        return { valid: true };
      }

      const { orderComponents, price, platformFeeAmount, platformFeeRecipient } = orderData;

      // Validate platform fee recipient matches configuration (Requirement 10.5)
      if (platformFeeRecipient && platformFeeRecipient.toLowerCase() !== this.platformFeeRecipient.toLowerCase()) {
        return {
          valid: false,
          error: `Platform fee recipient must be ${this.platformFeeRecipient}`
        };
      }

      // Check consideration items for platform fee (Requirement 10.1)
      const consideration = orderComponents.consideration || [];
      
      // Find platform fee item in consideration
      const platformFeeItem = consideration.find(item => 
        item.recipient && item.recipient.toLowerCase() === this.platformFeeRecipient.toLowerCase()
      );

      if (!platformFeeItem) {
        return {
          valid: false,
          error: 'Platform fee must be included in consideration items'
        };
      }

      // Validate platform fee amount (Requirement 10.2)
      const expectedFeeAmount = this.calculateExpectedPlatformFee(price);
      const actualFeeAmount = BigInt(platformFeeItem.startAmount);

      // Allow some tolerance for rounding (within 1%)
      const tolerance = expectedFeeAmount / 100n;
      const difference = actualFeeAmount > expectedFeeAmount 
        ? actualFeeAmount - expectedFeeAmount 
        : expectedFeeAmount - actualFeeAmount;

      if (difference > tolerance) {
        return {
          valid: false,
          error: `Platform fee amount incorrect. Expected approximately ${expectedFeeAmount.toString()}, got ${actualFeeAmount.toString()}`
        };
      }

      // Validate that platformFeeAmount in orderData matches consideration item
      if (platformFeeAmount && BigInt(platformFeeAmount) !== actualFeeAmount) {
        return {
          valid: false,
          error: 'Platform fee amount mismatch between order data and consideration items'
        };
      }

      logger.debug('Platform fee validation passed', {
        expectedFee: expectedFeeAmount.toString(),
        actualFee: actualFeeAmount.toString(),
        recipient: this.platformFeeRecipient
      });

      return { valid: true };

    } catch (error) {
      logger.error('Error validating platform fee:', error);
      return {
        valid: false,
        error: `Platform fee validation failed: ${error.message}`
      };
    }
  }

  /**
   * Calculate expected platform fee based on price
   * 
   * @param {string} price - Order price in wei
   * @returns {BigInt} Expected platform fee amount
   */
  calculateExpectedPlatformFee(price) {
    try {
      const priceBigInt = BigInt(price);
      const basisPoints = BigInt(this.platformFeeBasisPoints);
      
      // Calculate fee: (price * basisPoints) / 10000
      const feeAmount = (priceBigInt * basisPoints) / 10000n;
      
      return feeAmount;
    } catch (error) {
      logger.error('Error calculating platform fee:', error);
      throw error;
    }
  }

  /**
   * Calculate order hash from order components
   * Requirement: 2.6
   * 
   * @param {Object} orderComponents - Seaport order components
   * @returns {string} Order hash (keccak256)
   */
  calculateOrderHash(orderComponents) {
    try {
      // Log for debugging
      logger.debug('Calculating order hash', {
        offerer: orderComponents.offerer,
        startTime: orderComponents.startTime,
        startTimeType: typeof orderComponents.startTime
      });

      // Build EIP-712 domain - MUST match frontend exactly
      const domain = {
        name: 'Seaport',
        version: '1.6',  // ✅ FIXED: Changed from 1.5 to 1.6 to match Seaport 1.6 frontend
        chainId: this.chainId,
        verifyingContract: this.seaportContractAddress
      };

      // Define Seaport order types for EIP-712
      const types = {
        OrderComponents: [
          { name: 'offerer', type: 'address' },
          { name: 'zone', type: 'address' },
          { name: 'offer', type: 'OfferItem[]' },
          { name: 'consideration', type: 'ConsiderationItem[]' },
          { name: 'orderType', type: 'uint8' },
          { name: 'startTime', type: 'uint256' },
          { name: 'endTime', type: 'uint256' },
          { name: 'zoneHash', type: 'bytes32' },
          { name: 'salt', type: 'uint256' },
          { name: 'conduitKey', type: 'bytes32' },
          { name: 'counter', type: 'uint256' }
        ],
        OfferItem: [
          { name: 'itemType', type: 'uint8' },
          { name: 'token', type: 'address' },
          { name: 'identifierOrCriteria', type: 'uint256' },
          { name: 'startAmount', type: 'uint256' },
          { name: 'endAmount', type: 'uint256' }
        ],
        ConsiderationItem: [
          { name: 'itemType', type: 'uint8' },
          { name: 'token', type: 'address' },
          { name: 'identifierOrCriteria', type: 'uint256' },
          { name: 'startAmount', type: 'uint256' },
          { name: 'endAmount', type: 'uint256' },
          { name: 'recipient', type: 'address' }
        ]
      };

      // ✅ FIXED: Convert string fields to numbers for EIP-712 hash calculation
      // JSON serialization sends numbers as strings, but EIP-712 requires actual numbers
      const orderComponentsForHashing = {
        offerer: orderComponents.offerer,
        zone: orderComponents.zone,
        offer: orderComponents.offer,
        consideration: orderComponents.consideration,
        orderType: orderComponents.orderType,
        startTime: parseInt(orderComponents.startTime, 10),
        endTime: parseInt(orderComponents.endTime, 10),
        zoneHash: orderComponents.zoneHash,
        salt: orderComponents.salt,
        conduitKey: orderComponents.conduitKey,
        counter: parseInt(orderComponents.counter, 10)
      };

      // Calculate the EIP-712 hash
      const orderHash = ethers.TypedDataEncoder.hash(domain, types, orderComponentsForHashing);

      logger.debug('Calculated order hash', { orderHash });

      return orderHash;

    } catch (error) {
      logger.error('Error calculating order hash:', error);
      throw new Error(`Order hash calculation failed: ${error.message}`);
    }
  }
}

// Singleton instance
let orderValidationService = null;

function getOrderValidationService() {
  if (!orderValidationService) {
    orderValidationService = new OrderValidationService();
  }
  return orderValidationService;
}

module.exports = {
  OrderValidationService,
  getOrderValidationService
};
