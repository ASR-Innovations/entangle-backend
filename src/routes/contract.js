const express = require('express');
const { getContractService } = require('../services/ContractService');
const logger = require('../utils/logger');

const router = express.Router();

// Get contract statistics
router.get('/stats', async (req, res) => {
  try {
    const contractService = getContractService();
    await contractService.initialize();
    
    const stats = await contractService.getContractStats();
    const balance = await contractService.getContractBalance();
    
    res.json({
      success: true,
      stats: {
        ...stats,
        contractBalance: balance.toString()
      }
    });
  } catch (error) {
    logger.error('Contract stats error:', error);
    res.status(500).json({ error: 'Failed to get contract stats', message: error.message });
  }
});

// Get all auctions from contract
router.get('/auctions', async (req, res) => {
  try {
    const contractService = getContractService();
    await contractService.initialize();
    
    const auctions = await contractService.getActiveAuctions();
    
    res.json({
      success: true,
      auctions: auctions,
      total: auctions.length
    });
  } catch (error) {
    logger.error('Contract auctions error:', error);
    res.status(500).json({ error: 'Failed to get contract auctions', message: error.message });
  }
});

// Get NFTs owned by user
router.get('/nfts/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    const contractService = getContractService();
    await contractService.initialize();
    
    const nfts = await contractService.getNFTsOwnedByUser(address);
    
    res.json({
      success: true,
      nfts: nfts,
      total: nfts.length
    });
  } catch (error) {
    logger.error('User NFTs error:', error);
    res.status(500).json({ error: 'Failed to get user NFTs', message: error.message });
  }
});

// Get NFT metadata
router.get('/nft/:tokenId', async (req, res) => {
  try {
    const { tokenId } = req.params;
    
    if (!tokenId || isNaN(tokenId)) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    const contractService = getContractService();
    await contractService.initialize();
    
    const metadata = await contractService.getNFTMetadata(tokenId);
    
    res.json({
      success: true,
      metadata: metadata
    });
  } catch (error) {
    logger.error('NFT metadata error:', error);
    res.status(500).json({ error: 'Failed to get NFT metadata', message: error.message });
  }
});

// Check if user can burn NFT for meeting
router.get('/can-burn/:tokenId/:userAddress', async (req, res) => {
  try {
    const { tokenId, userAddress } = req.params;
    
    if (!tokenId || isNaN(tokenId)) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }
    
    if (!userAddress || !userAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    const contractService = getContractService();
    await contractService.initialize();
    
    const canBurn = await contractService.canBurnForMeeting(tokenId, userAddress);
    
    res.json({
      success: true,
      canBurn: canBurn
    });
  } catch (error) {
    logger.error('Can burn check error:', error);
    res.status(500).json({ error: 'Failed to check burn eligibility', message: error.message });
  }
});

// Get user dashboard data
router.get('/dashboard/user/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    const contractService = getContractService();
    await contractService.initialize();
    
    const dashboard = await contractService.getUserDashboardCategorized(address);
    
    res.json({
      success: true,
      dashboard: dashboard
    });
  } catch (error) {
    logger.error('User dashboard error:', error);
    res.status(500).json({ error: 'Failed to get user dashboard', message: error.message });
  }
});

// Get host dashboard data
router.get('/dashboard/host/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    const contractService = getContractService();
    await contractService.initialize();
    
    const dashboard = await contractService.getHostDashboardCategorized(address);
    
    res.json({
      success: true,
      dashboard: dashboard
    });
  } catch (error) {
    logger.error('Host dashboard error:', error);
    res.status(500).json({ error: 'Failed to get host dashboard', message: error.message });
  }
});

module.exports = router;




