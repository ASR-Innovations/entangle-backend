const { Para: ParaServer } = require('@getpara/server-sdk');
const axios = require('axios');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

class ParaService {
  constructor() {
    this.environment = process.env.PARA_ENVIRONMENT || 'beta';
    // Para SDK expects just the API key as a string
    this.paraServer = new ParaServer(process.env.PARA_API_KEY);
    this.secretApiKey = process.env.PARA_SECRET_API_KEY;
    this.baseUrl = `https://api.${this.environment}.getpara.com`;
  }
  
  // Verify session using Para's verification token approach
  async verifySession(verificationToken) {
    try {
      if (!verificationToken) {
        throw new Error('Verification token is required');
      }
      
      const response = await axios.post(`${this.baseUrl}/sessions/verify`, {
        verificationToken
      }, {
        headers: {
          'content-type': 'application/json',
          'x-external-api-key': this.secretApiKey
        },
        timeout: 5000
      });
      
      if (response.status === 403) {
        return {
          success: false,
          error: 'Session expired'
        };
      }
      
      // Response format: { authType, identifier, oAuthMethod? }
      const userData = response.data;
      
      logger.info(`Para session verified for user: ${userData.identifier}`);
      
      return {
        success: true,
        userData: {
          authType: userData.authType,
          identifier: userData.identifier,
          oAuthMethod: userData.oAuthMethod || null
        }
      };
      
    } catch (error) {
      if (error.response?.status === 403) {
        return {
          success: false,
          error: 'Session expired'
        };
      }
      
      logger.error('Para session verification failed:', error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }
  
  // Import and process full session (official Para documentation approach)
  async importSession(serializedSession) {
    try {
      if (!serializedSession) {
        throw new Error('Serialized session is required');
      }
      
      // Create new Para instance for this session (prevent conflicts)
      const userParaServer = new ParaServer(process.env.PARA_API_KEY);
      
      logger.info('Importing Para session...');
      
      // Import the session from client
      await userParaServer.importSession(serializedSession);
      
      // Check if session is still active
      const isActive = await userParaServer.isSessionActive();
      
      if (!isActive) {
        return {
          success: false,
          error: 'Session expired or inactive'
        };
      }
      
      logger.info('Para session imported successfully');
      
      // Issue JWT token with user data and wallets
      const jwtResult = await userParaServer.issueJwt();
      const { token, keyId } = jwtResult;
      
      // Decode to get user information
      const jwt = require('jsonwebtoken');
      const decoded = jwt.decode(token);
      
      if (!decoded || !decoded.data) {
        throw new Error('Invalid JWT token received from Para');
      }
      
      logger.info(`Para session active for user: ${decoded.sub}`);
      
      return {
        success: true,
        userParaServer,
        paraJwtToken: token,
        keyId,
        userData: decoded.data
      };
      
    } catch (error) {
      logger.error('Para session import failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  // Verify wallet ownership
  async verifyWalletOwnership(walletAddress) {
    try {
      const response = await axios.post(`${this.baseUrl}/wallets/verify`, {
        address: walletAddress
      }, {
        headers: {
          'content-type': 'application/json',
          'x-external-api-key': this.secretApiKey
        },
        timeout: 5000
      });
      
      if (response.status === 404) {
        return {
          success: false,
          error: 'Wallet not found'
        };
      }
      
      const { walletId } = response.data;
      
      return {
        success: true,
        walletId
      };
      
    } catch (error) {
      if (error.response?.status === 404) {
        return {
          success: false,
          error: 'Wallet not found'
        };
      }
      
      logger.error('Para wallet verification failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  // Store user data from Para JWT (saves to database for future use)
  async storeUserFromJWT(jwtData) {
    try {
      const { userId, wallets, email, authType, identifier, oAuthMethod } = jwtData;
      
      // Get primary wallet (EVM first, then others)
      const primaryWallet = wallets?.find(w => w.type === 'EVM') || wallets?.[0];
      
      if (!primaryWallet) {
        throw new Error('No wallet found in Para user data');
      }
      
      // Store/update user in database for future reference
      const userQuery = `
        INSERT INTO users (
          para_user_id, wallet_address, email, auth_type, 
          oauth_method, display_name, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
        ON CONFLICT (para_user_id) 
        DO UPDATE SET 
          wallet_address = EXCLUDED.wallet_address,
          email = EXCLUDED.email,
          auth_type = EXCLUDED.auth_type,
          oauth_method = EXCLUDED.oauth_method,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;
      
      const displayName = email || identifier || `User ${userId.slice(0, 8)}`;
      
      const userResult = await pool.query(userQuery, [
        userId,
        primaryWallet.address.toLowerCase(),
        email || null,
        authType,
        oAuthMethod || null,
        displayName
      ]);
      
      logger.info(`User stored in database: ${userId}`);
      
      return {
        success: true,
        user: userResult.rows[0],
        primaryWallet
      };
      
    } catch (error) {
      logger.error('Failed to store Para user data:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  // Store verification-only user (from verification token approach)
  async storeVerificationUser(userData) {
    try {
      const { authType, identifier, oAuthMethod } = userData;
      
      // Create Para user ID from verification data
      const paraUserId = `${authType}_${Buffer.from(identifier).toString('base64').slice(0, 16)}`;
      
      // Store user without wallet info (verification endpoint doesn't provide wallets)
      const userQuery = `
        INSERT INTO users (
          para_user_id, email, auth_type, oauth_method, 
          display_name, updated_at
        ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        ON CONFLICT (para_user_id) 
        DO UPDATE SET 
          email = EXCLUDED.email,
          auth_type = EXCLUDED.auth_type,
          oauth_method = EXCLUDED.oauth_method,
          display_name = EXCLUDED.display_name,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;
      
      const displayName = authType === 'email' ? identifier : `User ${paraUserId.slice(-8)}`;
      const email = authType === 'email' ? identifier : null;
      
      const userResult = await pool.query(userQuery, [
        paraUserId,
        email,
        authType,
        oAuthMethod,
        displayName
      ]);
      
      logger.info(`Verification user stored: ${paraUserId}`);
      
      return {
        success: true,
        user: userResult.rows[0]
      };
      
    } catch (error) {
      logger.error('Failed to store verification user:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  

}

module.exports = new ParaService();

