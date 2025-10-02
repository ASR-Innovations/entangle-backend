#!/usr/bin/env node

/**
 * TEST REAL API FUNCTIONALITY
 * Start a minimal server and test actual API calls
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { getParaService } = require('./src/services/ParaService');
const { getJitsiService } = require('./src/services/JitsiService');
const authRoutes = require('./src/routes/auth');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

// Add routes
app.use('/api/auth', authRoutes);

// Test endpoint for Jitsi
app.post('/api/test/jitsi', (req, res) => {
  try {
    const jitsiService = getJitsiService();
    
    // Create room
    const room = jitsiService.createRoom({
      roomName: 'test-meeting-' + Date.now(),
      displayName: 'Test Meeting',
      duration: 30
    });
    
    // Try to generate JWT
    const token = jitsiService.generateToken({
      roomName: room.roomId,
      userId: 'test-user-123',
      userName: 'Test User',
      email: 'test@example.com',
      role: 'participant'
    });
    
    res.json({
      success: true,
      room: {
        id: room.roomId,
        url: room.url
      },
      jwtGenerated: !!token,
      jwtToken: token || 'No JWT - missing JITSI_KID'
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test endpoint for Para session
app.post('/api/test/para', async (req, res) => {
  try {
    const { sessionCookie } = req.body;
    
    if (!sessionCookie) {
      return res.status(400).json({
        error: 'Session cookie required'
      });
    }
    
    const paraService = getParaService();
    
    // Try to verify with Para API
    const axios = require('axios');
    const result = await axios.post(`${paraService.baseUrl}/sessions/verify`, {}, {
      headers: {
        'content-type': 'application/json',
        'x-external-api-key': paraService.secretApiKey,
        'Cookie': sessionCookie
      },
      timeout: 10000
    }).catch(err => ({
      error: true,
      status: err.response?.status || 500,
      data: err.response?.data || { error: err.message }
    }));
    
    res.json({
      success: !result.error,
      paraResponse: result.data,
      status: result.status
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test endpoint for contract calls
app.get('/api/test/contract/:auctionId', async (req, res) => {
  try {
    const { auctionId } = req.params;
    const { Web3 } = require('web3');
    const contractABI = require('./src/contracts/MeetingAuction.json');
    
    const web3 = new Web3(process.env.ETH_HTTP_ENDPOINT);
    const contract = new web3.eth.Contract(
      contractABI.abi,
      process.env.AUCTION_CONTRACT_ADDRESS
    );
    
    // Test contract call
    const auction = await contract.methods.getAuction(auctionId).call();
    
    res.json({
      success: true,
      auction: {
        id: auction.id,
        host: auction.host,
        ended: auction.ended,
        highestBid: auction.highestBid,
        highestBidder: auction.highestBidder
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      para: 'ready',
      jitsi: 'ready',
      web3: 'connected'
    }
  });
});

const PORT = process.env.PORT || 5001; // Use 5001 to avoid conflicts

app.listen(PORT, () => {
  console.log(`🚀 Test API Server running on port ${PORT}`);
  console.log(`\n📋 Available Test Endpoints:`);
  console.log(`GET  http://localhost:${PORT}/health`);
  console.log(`POST http://localhost:${PORT}/api/test/jitsi`);
  console.log(`POST http://localhost:${PORT}/api/test/para`);
  console.log(`GET  http://localhost:${PORT}/api/test/contract/1`);
  console.log(`\n🧪 Test Commands:`);
  console.log(`curl http://localhost:${PORT}/health`);
  console.log(`curl -X POST http://localhost:${PORT}/api/test/jitsi`);
  console.log(`curl -X POST -H "Content-Type: application/json" -d '{"sessionCookie":"YOUR_PARA_COOKIE"}' http://localhost:${PORT}/api/test/para`);
  console.log(`curl http://localhost:${PORT}/api/test/contract/1`);
});

module.exports = app;
