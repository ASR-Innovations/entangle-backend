const { LitNodeClient } = require('@lit-protocol/lit-node-client');
const { LitNetwork } = require('@lit-protocol/constants');
const { ethers } = require('ethers');
const { pool } = require('../config/database');
const { getContractService } = require('./ContractService');
const logger = require('../utils/logger');

class LitService {
  constructor() {
    this.litNodeClient = null;
    this.network = process.env.LIT_NETWORK || 'habanero';
    this.pkpPublicKey = process.env.LIT_PKP_PUBLIC_KEY;
    this.actionIpfsCid = process.env.LIT_ACTION_IPFS_CID;
    this.initialized = false;
  }

  async initialize() {
    try {
      if (!this.pkpPublicKey || !this.actionIpfsCid) {
        logger.warn('Lit Protocol not fully configured - NFT gating will be disabled');
        return false;
      }

      this.litNodeClient = new LitNodeClient({
        litNetwork: this.network,
        debug: process.env.NODE_ENV === 'development'
      });

      await this.litNodeClient.connect();
      this.initialized = true;
      
      logger.info(`Lit Protocol connected to ${this.network} network`);
      return true;

    } catch (error) {
      logger.error('Failed to initialize Lit Protocol:', error);
      this.initialized = false;
      return false;
    }
  }

  // Generate Lit Gate Pass for NFT ownership verification
  async generateGatePass({ userAddress, auctionId, nftTokenId, signature }) {
    if (!this.initialized) {
      throw new Error('Lit Protocol not initialized');
    }

    try {
      // Create unique nonce
      const nonce = `${auctionId}_${nftTokenId}_${Date.now()}_${Math.random().toString(36)}`;
      
      // Create access control conditions
      const accessControlConditions = [
        {
          contractAddress: process.env.AUCTION_CONTRACT_ADDRESS,
          standardContractType: 'ERC721',
          chain: 'ethereum',
          method: 'ownerOf',
          parameters: [nftTokenId.toString()],
          returnValueTest: {
            comparator: '=',
            value: userAddress
          }
        }
      ];

      // Create the payload to be signed
      const payload = {
        auctionId,
        nftTokenId,
        userAddress,
        nonce,
        timestamp: Date.now(),
        action: 'meeting_access'
      };

      const payloadHash = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes(JSON.stringify(payload))
      );

      // Store the gate pass in database
      await pool.query(`
        INSERT INTO lit_gate_passes (
          nonce, user_para_id, wallet_address, auction_id,
          payload_hash, signature, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        nonce,
        'unknown', // Will be filled when user authenticates
        userAddress.toLowerCase(),
        auctionId,
        payloadHash,
        signature,
        new Date(Date.now() + (24 * 60 * 60 * 1000)) // 24 hours
      ]);

      logger.info(`Lit gate pass generated for auction ${auctionId}, NFT ${nftTokenId}`);

      return {
        success: true,
        gatePass: {
          nonce,
          payload,
          payloadHash,
          accessControlConditions,
          signature,
          expiresAt: new Date(Date.now() + (24 * 60 * 60 * 1000))
        }
      };

    } catch (error) {
      logger.error('Failed to generate Lit gate pass:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Verify NFT ownership and burn authorization
  async verifyNFTAccess({ nonce, userAddress, auctionId, nftTokenId }) {
    if (!this.initialized) {
      throw new Error('Lit Protocol not initialized');
    }

    try {
      // Get gate pass from database
      const gatePassQuery = `
        SELECT * FROM lit_gate_passes 
        WHERE nonce = $1 AND used = false AND expires_at > NOW()
      `;
      const gatePassResult = await pool.query(gatePassQuery, [nonce]);

      if (gatePassResult.rows.length === 0) {
        return {
          success: false,
          error: 'Invalid or expired gate pass'
        };
      }

      const gatePass = gatePassResult.rows[0];

      // Verify auction and NFT match
      if (gatePass.auction_id !== auctionId || 
          gatePass.wallet_address !== userAddress.toLowerCase()) {
        return {
          success: false,
          error: 'Gate pass mismatch'
        };
      }

      // Check NFT ownership via ContractService
      const contractService = getContractService();
      await contractService.initialize();
      const nftOwner = await contractService.contract.ownerOf(nftTokenId);
      
      if (nftOwner.toLowerCase() !== userAddress.toLowerCase()) {
        return {
          success: false,
          error: 'NFT not owned by user'
        };
      }

      // Check if NFT was already used
      const isUsed = await web3Service.isNFTUsed(nftTokenId);
      if (isUsed) {
        return {
          success: false,
          error: 'NFT already used for meeting access'
        };
      }

      // Mark gate pass as used
      await pool.query(
        'UPDATE lit_gate_passes SET used = true WHERE nonce = $1',
        [nonce]
      );

      logger.info(`NFT access verified for auction ${auctionId}, NFT ${nftTokenId}`);

      return {
        success: true,
        verified: true,
        canBurn: true,
        gatePass: {
          nonce: gatePass.nonce,
          auctionId: gatePass.auction_id,
          nftTokenId,
          userAddress
        }
      };

    } catch (error) {
      logger.error('Failed to verify NFT access:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Execute Lit Action for NFT burn verification
  async executeLitAction({ nonce, userSignature, burnTransactionHash }) {
    if (!this.initialized) {
      throw new Error('Lit Protocol not initialized');
    }

    try {
      // Get gate pass
      const gatePassQuery = `
        SELECT * FROM lit_gate_passes 
        WHERE nonce = $1 AND used = true
      `;
      const gatePassResult = await pool.query(gatePassQuery, [nonce]);

      if (gatePassResult.rows.length === 0) {
        return {
          success: false,
          error: 'Gate pass not found or not verified'
        };
      }

      const gatePass = gatePassResult.rows[0];

      // Create Lit Action parameters
      const litActionParams = {
        auctionId: gatePass.auction_id,
        nftTokenId: gatePass.nft_token_id,
        userAddress: gatePass.wallet_address,
        burnTxHash: burnTransactionHash,
        timestamp: Date.now()
      };

      // Execute Lit Action (simplified for demo)
      const litActionResult = {
        success: true,
        actionId: `action_${nonce}_${Date.now()}`,
        result: {
          burnVerified: true,
          meetingAccessGranted: true,
          timestamp: Date.now()
        }
      };

      // In a real implementation, this would:
      // 1. Execute the Lit Action with PKP
      // 2. Verify the burn transaction on-chain
      // 3. Return cryptographic proof of verification

      logger.info(`Lit Action executed for gate pass ${nonce}`);

      return {
        success: true,
        litActionResult,
        meetingAccessGranted: true
      };

    } catch (error) {
      logger.error('Failed to execute Lit Action:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Comprehensive NFT-gated meeting access flow
  async verifyMeetingAccess({ userAddress, auctionId, nftTokenId, burnTransactionHash, userParaId }) {
    try {
      // Step 1: Verify NFT ownership
      const contractService = getContractService();
      await contractService.initialize();
      
      // Check if burn transaction is valid
      const receipt = await contractService.provider.getTransactionReceipt(burnTransactionHash);
      if (!receipt || receipt.status !== true) {
        return {
          success: false,
          error: 'Invalid burn transaction'
        };
      }

      // Verify NFT burn event in transaction
      const burnEvent = receipt.logs.find(log => {
        try {
          const decoded = web3Service.web3.eth.abi.decodeLog(
            [
              { type: 'uint256', name: 'tokenId', indexed: true },
              { type: 'uint256', name: 'auctionId', indexed: true },
              { type: 'address', name: 'user', indexed: true }
            ],
            log.data,
            log.topics
          );
          return decoded.tokenId === nftTokenId.toString() && 
                 decoded.auctionId === auctionId.toString() &&
                 decoded.user.toLowerCase() === userAddress.toLowerCase();
        } catch {
          return false;
        }
      });

      if (!burnEvent) {
        return {
          success: false,
          error: 'NFT burn event not found in transaction'
        };
      }

      // Log the access
      await pool.query(`
        INSERT INTO meeting_access_logs (
          auction_id, user_para_id, wallet_address, nft_token_id,
          transaction_hash, lit_gate_pass_hash, access_method, accessed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'nft_burn_lit', NOW())
      `, [
        auctionId,
        userParaId,
        userAddress.toLowerCase(),
        nftTokenId,
        burnTransactionHash,
        receipt.transactionHash
      ]);

      logger.info(`Meeting access granted via Lit Protocol for auction ${auctionId}`);

      return {
        success: true,
        accessGranted: true,
        method: 'nft_burn_lit',
        transactionHash: burnTransactionHash,
        timestamp: new Date()
      };

    } catch (error) {
      logger.error('Failed to verify meeting access:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get user's gate passes
  async getUserGatePasses(userAddress) {
    try {
      const query = `
        SELECT lgp.*, a.title as auction_title
        FROM lit_gate_passes lgp
        JOIN auctions a ON lgp.auction_id = a.id
        WHERE lgp.wallet_address = $1
        ORDER BY lgp.created_at DESC
        LIMIT 50
      `;
      
      const result = await pool.query(query, [userAddress.toLowerCase()]);
      
      return {
        success: true,
        gatePasses: result.rows
      };

    } catch (error) {
      logger.error('Failed to get user gate passes:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Cleanup expired gate passes
  async cleanupExpiredGatePasses() {
    try {
      const result = await pool.query(`
        DELETE FROM lit_gate_passes 
        WHERE expires_at < NOW() AND used = false
      `);

      logger.info(`Cleaned up ${result.rowCount} expired gate passes`);
      return result.rowCount;

    } catch (error) {
      logger.error('Failed to cleanup expired gate passes:', error);
      return 0;
    }
  }
}

let litService;

async function initializeLitService() {
  if (!litService) {
    litService = new LitService();
    await litService.initialize();
  }
  return litService;
}

function getLitService() {
  if (!litService) {
    throw new Error('Lit service not initialized');
  }
  return litService;
}

module.exports = { LitService, initializeLitService, getLitService };
