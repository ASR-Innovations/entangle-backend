const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const paraService = require('../services/ParaService');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();




// Para verification token authentication (Step 1: Basic Auth)
router.post('/para-auth', async (req, res) => {
  try {
    const { verificationToken, walletAddress } = req.body;
    
    if (!verificationToken) {
      return res.status(400).json({ 
        error: 'Verification token is required',
        required: 'Frontend: const token = await para.getVerificationToken(); then send { verificationToken: token }'
      });
    }
    
    // Verify with Para API
    const verification = await paraService.verifySession(verificationToken);
    
    if (!verification.success) {
      return res.status(401).json({ 
        error: 'Para verification failed', 
        details: verification.error,
        hint: 'Ensure frontend provides valid verification token from authenticated Para session'
      });
    }
    
    const { authType, identifier, oAuthMethod } = verification.userData;
    
    // Store user in database
    const userStore = await paraService.storeVerificationUser(verification.userData);
    
    if (!userStore.success) {
      return res.status(500).json({ 
        error: 'Failed to store user data',
        details: userStore.error
      });
    }
    
    const user = userStore.user;
    
    // Update wallet address if provided
    if (walletAddress) {
      try {
        const normalizedWallet = walletAddress.toLowerCase();
        
        // Check if this wallet belongs to another user
        const existingWallet = await pool.query(
          'SELECT id, para_user_id FROM users WHERE wallet_address = $1',
          [normalizedWallet]
        );
        
        if (existingWallet.rows.length > 0 && existingWallet.rows[0].id !== user.id) {
          logger.warn(`Wallet ${normalizedWallet} already belongs to user ${existingWallet.rows[0].para_user_id}`);
          // Don't fail - just skip wallet update
        } else {
          // Update wallet if not already assigned or if it's the same user
          await pool.query(
            'UPDATE users SET wallet_address = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [normalizedWallet, user.id]
          );
          user.wallet_address = normalizedWallet;
          logger.info(`Wallet address updated for user ${user.id}`);
        }
      } catch (error) {
        logger.warn('Failed to update wallet address:', error.message);
        // Don't fail the auth - just continue without wallet update
      }
    }
    
    // Generate JWT token
    const token = jwt.sign({
      userId: user.id,
      paraUserId: user.para_user_id,
      authType: user.auth_type,
      identifier,
      email: user.email,
      displayName: user.display_name,
      walletAddress: user.wallet_address || null,
      role: 'para_user',
      hasWallet: !!user.wallet_address
    }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    logger.info(`Para verification auth successful for user: ${user.para_user_id}`);
    
    res.json({
      success: true,
      token,
      session: {
        userId: user.para_user_id,
        walletAddress: user.wallet_address || null,
        displayName: user.display_name,
        email: user.email
      },
      user: {
        id: user.id,
        paraUserId: user.para_user_id,
        email: user.email,
        authType: user.auth_type,
        oAuthMethod: user.oauth_method,
        displayName: user.display_name,
        walletAddress: user.wallet_address,
        role: 'para_user',
        hasWallet: !!user.wallet_address
      },
      note: 'Basic authentication complete. Use /import-session for wallet operations.'
    });
    
  } catch (error) {
    logger.error('Para auth error:', error);
    res.status(500).json({ 
      error: 'Authentication failed', 
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Para session import (Step 2: Full Session with Wallet Access)
router.post('/import-session', async (req, res) => {
  try {
    const { session } = req.body; // Note: 'session' not 'serializedSession' per Para docs
    
    if (!session) {
      return res.status(400).json({ 
        error: 'Session is required',
        required: 'Frontend: const session = await para.exportSession(); then send { session }'
      });
    }
    
    const sessionResult = await paraService.importSession(session);
    
    if (!sessionResult.success) {
      return res.status(401).json({ 
        error: 'Session import failed',
        details: sessionResult.error,
        hint: 'Ensure frontend provides valid session from para.exportSession()'
      });
    }
    
    // Store full user data with wallet info
    const userStore = await paraService.storeUserFromJWT(sessionResult.userData);
    
    if (!userStore.success) {
      return res.status(500).json({ 
        error: 'Failed to store user data',
        details: userStore.error
      });
    }
    
    const user = userStore.user;
    const primaryWallet = userStore.primaryWallet;
    
    // Generate JWT with full wallet access
    const token = jwt.sign({
      userId: user.id,
      paraUserId: user.para_user_id,
      authType: user.auth_type,
      email: user.email,
      displayName: user.display_name,
      walletAddress: primaryWallet.address.toLowerCase(),
      hasWallet: true,
      sessionActive: true,
      role: 'para_user'
    }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    logger.info(`Para session imported successfully for user: ${user.para_user_id}`);
    
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        paraUserId: user.para_user_id,
        email: user.email,
        authType: user.auth_type,
        displayName: user.display_name,
        walletAddress: primaryWallet.address,
        hasWallet: true,
        role: 'para_user'
      },
      wallet: {
        address: primaryWallet.address,
        type: primaryWallet.type
      },
      note: 'Full session imported. User can perform wallet operations.'
    });
    
  } catch (error) {
    logger.error('Para session import error:', error);
    res.status(500).json({ 
      error: 'Session import failed',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Verify token
router.get('/verify', authenticateToken, (req, res) => {
  res.json({ 
    success: true, 
    user: req.user,
    timestamp: new Date().toISOString()
  });
});



module.exports = router;
