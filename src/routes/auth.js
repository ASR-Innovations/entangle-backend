const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const paraService = require('../services/ParaService');
const { getTwitterService } = require('../services/TwitterService');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Get Twitter service instance
const twitterService = getTwitterService();

// Para verification token authentication (Step 1: Basic Auth)
// Now accepts twitterUsername to fetch and store Twitter profile data
router.post('/para-auth', async (req, res) => {
  try {
    const { verificationToken, walletAddress, twitterUsername } = req.body;
    
    if (!verificationToken) {
      return res.status(400).json({ 
        error: 'Verification token is required',
        required: 'Frontend: const token = await para.getVerificationToken(); then send { verificationToken: token, walletAddress?, twitterUsername? }'
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
    
    // Track the effective wallet address for creator profile
    let effectiveWalletAddress = user.wallet_address;
    
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
          // Don't fail - still use this wallet for creator profile lookup
          // The wallet is valid, just owned by a different Para session
          effectiveWalletAddress = normalizedWallet;
        } else {
          // Update wallet if not already assigned or if it's the same user
          await pool.query(
            'UPDATE users SET wallet_address = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [normalizedWallet, user.id]
          );
          user.wallet_address = normalizedWallet;
          effectiveWalletAddress = normalizedWallet;
          logger.info(`Wallet address updated for user ${user.id}`);
        }
      } catch (error) {
        logger.warn('Failed to update wallet address:', error.message);
        // Still try to use the provided wallet for creator profile
        effectiveWalletAddress = walletAddress.toLowerCase();
      }
    }
    
    // Fetch and store Twitter profile data if twitterUsername provided
    let twitterProfile = null;
    let creatorProfile = null;
    
    if (twitterUsername && effectiveWalletAddress) {
      try {
        logger.info(`🐦 Fetching Twitter data for: ${twitterUsername}`);
        
        // Fetch Twitter profile data from Entangle Twitter API
        const twitterData = await twitterService.getTwitterUser(twitterUsername);
        
        if (twitterData) {
          logger.info(`✅ Twitter data fetched for: ${twitterUsername}`);
          
          // Create/update creator profile with Twitter data
          // Use effectiveWalletAddress which may be from another user's record
          creatorProfile = await createOrUpdateCreatorProfile(
            user.id,
            user.para_user_id,
            effectiveWalletAddress,
            twitterData
          );
          
          // Format Twitter profile for response
          twitterProfile = {
            id: twitterData.id,
            username: twitterData.username,
            name: twitterData.name,
            bio: twitterData.bio || '',
            profileImageUrl: twitterData.profileImageUrl,
            verified: twitterData.verified || false,
            followersCount: twitterData.followersCount || 0,
            followingCount: twitterData.followingCount || 0,
            tweetCount: twitterData.tweetCount || 0
          };
          
          logger.info(`✅ Creator profile created/updated for: ${twitterUsername}`);
        } else {
          logger.warn(`⚠️ Could not fetch Twitter data for: ${twitterUsername}`);
        }
      } catch (error) {
        logger.error(`❌ Error processing Twitter data for ${twitterUsername}:`, error.message);
        // Don't fail auth - just continue without Twitter data
      }
    } else if (twitterUsername && !effectiveWalletAddress) {
      logger.warn('Twitter username provided but no wallet address - skipping creator profile creation');
    }
    
    // Generate JWT token with Twitter info if available
    const tokenPayload = {
      userId: user.id,
      paraUserId: user.para_user_id,
      authType: user.auth_type,
      identifier,
      email: user.email,
      displayName: twitterProfile?.name || user.display_name,
      walletAddress: user.wallet_address || null,
      role: 'para_user',
      hasWallet: !!user.wallet_address,
      twitterUsername: twitterProfile?.username || null,
      isCreator: !!creatorProfile
    };
    
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    logger.info(`Para verification auth successful for user: ${user.para_user_id}${twitterProfile ? ` (Twitter: @${twitterProfile.username})` : ''}`);
    
    // Build response
    const response = {
      success: true,
      token,
      session: {
        userId: user.para_user_id,
        walletAddress: user.wallet_address || null,
        displayName: twitterProfile?.name || user.display_name,
        email: user.email
      },
      user: {
        id: user.id,
        paraUserId: user.para_user_id,
        email: user.email,
        authType: user.auth_type,
        oAuthMethod: user.oauth_method,
        displayName: twitterProfile?.name || user.display_name,
        walletAddress: user.wallet_address,
        role: 'para_user',
        hasWallet: !!user.wallet_address,
        isCreator: !!creatorProfile
      }
    };
    
    // Add Twitter profile to response if available
    if (twitterProfile) {
      response.twitterProfile = twitterProfile;
      response.user.twitterUsername = twitterProfile.username;
      response.user.twitterId = twitterProfile.id;
      response.user.profileImage = twitterProfile.profileImageUrl;
    }
    
    response.note = twitterProfile 
      ? 'Authentication complete with Twitter profile.'
      : 'Basic authentication complete. Use /import-session for wallet operations.';
    
    res.json(response);
    
  } catch (error) {
    logger.error('Para auth error:', error);
    res.status(500).json({ 
      error: 'Authentication failed', 
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * Create or update creator profile with Twitter data
 * Links to user table and stores full Twitter profile
 */
async function createOrUpdateCreatorProfile(userId, paraUserId, walletAddress, twitterData) {
  try {
    const normalizedWallet = walletAddress.toLowerCase();
    
    // Check if creator profile already exists
    const existingProfile = await pool.query(
      'SELECT id FROM creator_profiles WHERE LOWER(wallet_address) = $1',
      [normalizedWallet]
    );
    
    if (existingProfile.rows.length > 0) {
      // Update existing profile
      const result = await pool.query(`
        UPDATE creator_profiles SET
          twitter_username = $1,
          twitter_id = $2,
          twitter_followers_count = $3,
          twitter_following_count = $4,
          twitter_tweet_count = $5,
          twitter_verified = $6,
          bio = $7,
          profile_image = $8,
          last_synced_at = NOW(),
          updated_at = NOW()
        WHERE LOWER(wallet_address) = $9
        RETURNING *
      `, [
        twitterData.username,
        twitterData.id,
        twitterData.followersCount || 0,
        twitterData.followingCount || 0,
        twitterData.tweetCount || 0,
        twitterData.verified || false,
        twitterData.bio || '',
        twitterData.profileImageUrl,
        normalizedWallet
      ]);
      
      logger.info(`✅ Updated creator profile for wallet: ${normalizedWallet}`);
      return result.rows[0];
    } else {
      // Create new profile
      const result = await pool.query(`
        INSERT INTO creator_profiles (
          wallet_address,
          twitter_username,
          twitter_id,
          twitter_followers_count,
          twitter_following_count,
          twitter_tweet_count,
          twitter_verified,
          bio,
          profile_image,
          twitter_url,
          last_synced_at,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW(), NOW())
        RETURNING *
      `, [
        normalizedWallet,
        twitterData.username,
        twitterData.id,
        twitterData.followersCount || 0,
        twitterData.followingCount || 0,
        twitterData.tweetCount || 0,
        twitterData.verified || false,
        twitterData.bio || '',
        twitterData.profileImageUrl,
        `https://twitter.com/${twitterData.username}`
      ]);
      
      logger.info(`✅ Created new creator profile for wallet: ${normalizedWallet}`);
      return result.rows[0];
    }
  } catch (error) {
    logger.error('Failed to create/update creator profile:', error.message);
    throw error;
  }
}

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
