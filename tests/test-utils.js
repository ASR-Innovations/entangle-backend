/**
 * TEST UTILITIES
 * Reusable helper functions for testing
 */

let jwt, ethers;

try {
  jwt = require('jsonwebtoken');
  ethers = require('ethers');
} catch (error) {
  console.warn('Some dependencies not available, using fallbacks');
  jwt = null;
  ethers = null;
}

class TestUtils {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'test-secret';
    this.contractAddress = process.env.AUCTION_CONTRACT_ADDRESS || '0xB5D6eaD3f2b302ab38D59617C179a2f61a4ca0EC';
    this.rpcUrl = process.env.RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc';
  }

  /**
   * Generate a test JWT token
   */
  generateTestJWT(userData = {}) {
    if (!jwt) {
      return 'mock-jwt-token-' + Date.now();
    }

    const defaultData = {
      userId: Math.floor(Math.random() * 10000),
      paraUserId: 'test_user_' + Date.now(),
      email: 'test@example.com',
      walletAddress: '0x161d026cd7855bc783506183546c968cd96b4896',
      role: 'para_user'
    };

    const payload = { ...defaultData, ...userData };
    
    return jwt.sign(payload, this.jwtSecret, { expiresIn: '1h' });
  }

  /**
   * Generate test auction data
   */
  generateTestAuction(overrides = {}) {
    const defaultAuction = {
      title: 'Test Auction ' + Date.now(),
      description: 'Test auction description',
      duration: 60,
      reservePrice: 0.1,
      meetingDuration: 30,
      creatorWallet: '0x161d026cd7855bc783506183546c968cd96b4896',
      transactionHash: '0x' + Math.random().toString(16).substr(2, 64)
    };

    return { ...defaultAuction, ...overrides };
  }

  /**
   * Generate test meeting data
   */
  generateTestMeeting(overrides = {}) {
    const defaultMeeting = {
      hostName: 'Test Host',
      hostEmail: 'host@test.com',
      guestName: 'Test Guest',
      guestEmail: 'guest@test.com',
      meetingName: 'Test Meeting ' + Date.now(),
      duration: 30
    };

    return { ...defaultMeeting, ...overrides };
  }

  /**
   * Generate mock Para verification token
   */
  generateMockParaToken(userData = {}) {
    const defaultData = {
      authType: 'email',
      identifier: 'test@example.com',
      oAuthMethod: 'google',
      timestamp: Date.now()
    };

    const data = { ...defaultData, ...userData };
    return Buffer.from(JSON.stringify(data)).toString('base64');
  }

  /**
   * Generate mock Para session
   */
  generateMockParaSession(userData = {}) {
    const defaultSession = {
      user: {
        id: 'test-user-' + Date.now(),
        email: 'test@example.com',
        name: 'Test User'
      },
      wallets: [{
        id: 'wallet-' + Date.now(),
        type: 'EVM',
        address: '0x161d026cd7855bc783506183546c968cd96b4896',
        publicKey: '0x04872f...'
      }]
    };

    return { ...defaultSession, ...userData };
  }

  /**
   * Wait for a specified amount of time
   */
  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Retry a function with exponential backoff
   */
  async retry(fn, maxAttempts = 3, baseDelay = 1000) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === maxAttempts) {
          throw error;
        }
        
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`   Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await this.wait(delay);
      }
    }
  }

  /**
   * Check if server is running
   */
  async isServerRunning(baseUrl, timeout = 5000) {
    try {
      const axios = require('axios');
      const response = await axios.get(`${baseUrl}/health`, { timeout });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate random wallet address
   */
  generateRandomWallet() {
    if (!ethers) {
      return {
        address: '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
        privateKey: '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
        publicKey: '0x04' + Array.from({ length: 128 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
      };
    }

    const wallet = ethers.Wallet.createRandom();
    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
      publicKey: wallet.publicKey
    };
  }

  /**
   * Generate random transaction hash
   */
  generateRandomTxHash() {
    return '0x' + Array.from({ length: 64 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }

  /**
   * Validate JWT token structure
   */
  validateJWT(token) {
    if (!jwt) {
      return {
        valid: token && token.startsWith('mock-jwt-token'),
        payload: { mock: true },
        header: { mock: true }
      };
    }

    try {
      const decoded = jwt.decode(token, { complete: true });
      return {
        valid: !!(decoded && decoded.payload),
        payload: decoded?.payload,
        header: decoded?.header
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Format test results for display
   */
  formatTestResults(results) {
    const { passed, failed, total } = results;
    const successRate = total > 0 ? ((passed / total) * 100).toFixed(1) : 0;
    
    return {
      summary: `${passed}/${total} tests passed (${successRate}%)`,
      status: failed === 0 ? 'PASS' : 'FAIL',
      successRate: parseFloat(successRate)
    };
  }

  /**
   * Create test database cleanup function
   */
  createCleanupFunction(pool, testData) {
    return async () => {
      try {
        // Clean up test meetings
        if (testData.meetings && testData.meetings.length > 0) {
          const meetingIds = testData.meetings.map(m => m.id);
          await pool.query('DELETE FROM meetings WHERE id = ANY($1)', [meetingIds]);
        }

        // Clean up test auctions
        if (testData.auctions && testData.auctions.length > 0) {
          const auctionIds = testData.auctions.map(a => a.id);
          await pool.query('DELETE FROM auctions WHERE id = ANY($1)', [auctionIds]);
        }

        // Clean up test users
        if (testData.users && testData.users.length > 0) {
          const userEmails = testData.users.map(u => u.email);
          await pool.query('DELETE FROM users WHERE email = ANY($1)', [userEmails]);
        }

        console.log('✅ Test data cleanup completed');
      } catch (error) {
        console.log('⚠️  Test data cleanup failed:', error.message);
      }
    };
  }

  /**
   * Validate API response structure
   */
  validateAPIResponse(response, expectedFields = []) {
    const validation = {
      valid: true,
      errors: []
    };

    // Check status code
    if (response.status < 200 || response.status >= 300) {
      validation.valid = false;
      validation.errors.push(`Invalid status code: ${response.status}`);
    }

    // Check response data exists
    if (!response.data) {
      validation.valid = false;
      validation.errors.push('Response data is missing');
      return validation;
    }

    // Check expected fields
    expectedFields.forEach(field => {
      if (!(field in response.data)) {
        validation.valid = false;
        validation.errors.push(`Missing field: ${field}`);
      }
    });

    return validation;
  }

  /**
   * Create mock contract interaction
   */
  createMockContract() {
    const mockBigNumber = (value) => ({
      toString: () => value.toString(),
      from: (val) => mockBigNumber(val)
    });

    return {
      auctionCounter: () => Promise.resolve(mockBigNumber('10')),
      platformFee: () => Promise.resolve(mockBigNumber('250')),
      owner: () => Promise.resolve('0x1234567890123456789012345678901234567890'),
      getActiveAuctions: () => Promise.resolve([
        mockBigNumber('1'),
        mockBigNumber('2')
      ]),
      getAuction: (id) => Promise.resolve({
        id: mockBigNumber(id),
        host: '0x161d026cd7855bc783506183546c968cd96b4896',
        ended: false,
        highestBid: mockBigNumber('100000000000000000'),
        highestBidder: '0x9876543210987654321098765432109876543210'
      }),
      getNFTsOwnedByUser: (address) => Promise.resolve({
        tokenIds: [],
        auctionIds: []
      })
    };
  }

  /**
   * Log test progress
   */
  logTestProgress(testName, step, total) {
    const progress = Math.round((step / total) * 100);
    console.log(`\n[${progress}%] ${testName}`);
  }
}

module.exports = { TestUtils };